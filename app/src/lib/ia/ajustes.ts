import { z } from "zod";
import { db } from "@/lib/db";
import { obtenerDepsEnrutador } from "./deps";
import {
  TABLA_TAREAS_POR_DEFECTO,
  cargarConfigIA,
  CLAVE_CASCADA_OPENAI,
  cargarTablaTareas,
  ejecutar,
  guardarTablaTareas,
} from "./enrutador";
import { CASCADA_ID_POR_DEFECTO, infoProveedor } from "./registro";
import type { ModoIA, ProveedorId, TareaIA } from "./tipos";
import { limiteDe, resumirUso } from "./uso";

// Lógica de /ajustes (docs/07): proveedores con semáforo, prueba de conexión, modo, cascada y tabla de tareas.
// Las claves nunca salen de aquí: solo se informa si existen.

export const PROVEEDORES_CON_CLAVE = ["openai", "gemini", "cerebras", "groq", "openrouter"] as const;
export const TODOS_LOS_PROVEEDORES: readonly ProveedorId[] = [...PROVEEDORES_CON_CLAVE, "manual"];
export const TAREAS: readonly TareaIA[] = Object.keys(TABLA_TAREAS_POR_DEFECTO) as TareaIA[];
export const MODOS_IA: readonly ModoIA[] = ["cascada", "simultaneo", "duelo"];
export const TIMEOUT_PRUEBA_MS = 15_000;
/** Un 429 cuenta como «límite alcanzado» durante 1 hora. */
export const VENTANA_LIMITE_MS = 60 * 60 * 1000;

export type EstadoProveedor = "sin-clave" | "conectado" | "limite" | "error" | "sin-probar";

export interface ProveedorAjuste {
  id: ProveedorId;
  nombre: string;
  modelo: string;
  tieneClave: boolean;
  estado: EstadoProveedor;
  ultimoError?: string;
  usoHoy: number;
  limiteDiario: number | null;
  porcentaje: number | null;
}

export interface ResultadoPrueba {
  id: ProveedorId;
  ok: boolean;
  ms: number;
  error?: string;
}

interface PruebaGuardada extends ResultadoPrueba {
  en: string;
  tipo?: string;
}

const clavePrueba = (id: string) => `prueba:${id}`;

// ---------- Proveedores ----------

export async function listarProveedores(env: Record<string, string | undefined> = process.env, ahora = new Date()): Promise<ProveedorAjuste[]> {
  const pruebas = await db.ajuste.findMany({ where: { clave: { startsWith: "prueba:" } } });
  const filasHoy = await db.usoIA.findMany({ where: { creadoEn: { gte: new Date(ahora.getTime() - 86_400_000) } }, orderBy: { creadoEn: "asc" } });
  const uso = resumirUso(filasHoy, 1, ahora, env);

  return TODOS_LOS_PROVEEDORES.map((id) => {
    const info = infoProveedor(id, env);
    const u = uso.porProveedor.find((p) => p.proveedor === id);
    const base = { ...info, usoHoy: u?.usoHoy ?? 0, limiteDiario: limiteDe(id, env), porcentaje: u?.porcentajeHoy ?? null };
    if (!info.tieneClave) return { ...base, estado: "sin-clave" as const };
    if (id === "manual") return { ...base, estado: "conectado" as const };

    // Lo más reciente entre la última prueba guardada y el último uso decide el semáforo.
    const guardada = pruebas.find((p) => p.clave === clavePrueba(id));
    const prueba = guardada ? (JSON.parse(guardada.valor) as PruebaGuardada) : undefined;
    const ultimoUso = [...filasHoy].reverse().find((f) => f.proveedor === id);
    const tPrueba = prueba ? new Date(prueba.en).getTime() : 0;
    const tUso = ultimoUso ? ultimoUso.creadoEn.getTime() : 0;
    if (!prueba && !ultimoUso) return { ...base, estado: "sin-probar" as const };

    const usoEsReciente = tUso > tPrueba;
    const ok = usoEsReciente ? ultimoUso!.ok : prueba!.ok;
    if (ok) return { ...base, estado: "conectado" as const };
    const error = usoEsReciente ? (ultimoUso!.error ?? "Error desconocido") : (prueba!.error ?? "Error desconocido");
    const tipo = usoEsReciente ? error.split(":")[0].trim() : (prueba!.tipo ?? error.split(":")[0].trim());
    const t = usoEsReciente ? tUso : tPrueba;
    if (tipo === "limite") {
      return ahora.getTime() - t <= VENTANA_LIMITE_MS ? { ...base, estado: "limite" as const, ultimoError: error } : { ...base, estado: "sin-probar" as const };
    }
    return { ...base, estado: "error" as const, ultimoError: error };
  });
}

// ---------- Probar ----------

const Ping = z.object({ ok: z.literal(true) });

async function probarUno(id: ProveedorId, env: Record<string, string | undefined>): Promise<ResultadoPrueba> {
  const info = infoProveedor(id, env);
  if (!info.tieneClave) return { id, ok: false, ms: 0, error: "Falta la clave en .env.local." };
  const inicio = performance.now();
  const deps = obtenerDepsEnrutador();
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<never>((_, rechazar) => {
    temporizador = setTimeout(() => rechazar(new Error("timeout: la prueba superó los 15 s.")), TIMEOUT_PRUEBA_MS);
  });
  try {
    await Promise.race([
      ejecutar(
        {
          tarea: "mejorar-prompt",
          sistema: "Responde solo con el JSON pedido.",
          usuario: 'Devuelve { "ok": true }.',
          esquema: Ping,
          maxTokens: 200,
          temperatura: 0,
          forzar: id,
        },
        { ...deps, modo: "cascada", config: {}, env: { ...env, IA_CACHE: "0" }, cache: undefined },
      ),
      limite,
    ]);
    return { id, ok: true, ms: Math.round(performance.now() - inicio) };
  } catch (e) {
    const cascada = e as { intentos?: { tipo: string; mensaje: string }[] };
    const intento = cascada.intentos?.at(-1);
    const mensaje = intento ? `${intento.tipo}: ${intento.mensaje}` : e instanceof Error ? e.message : String(e);
    return { id, ok: false, ms: Math.round(performance.now() - inicio), error: mensaje };
  } finally {
    clearTimeout(temporizador);
  }
}

/** «Probar todos» (sin `id`) o uno solo. Guarda cada resultado en `Ajuste` (`prueba:<id>`). */
export async function probarProveedores(id?: ProveedorId, env: Record<string, string | undefined> = process.env): Promise<ResultadoPrueba[]> {
  const ids = id ? [id] : [...PROVEEDORES_CON_CLAVE];
  const resultados = await Promise.all(ids.map((x) => probarUno(x, env)));
  await Promise.all(
    resultados
      .filter((r) => infoProveedor(r.id, env).tieneClave)
      .map((r) => {
        const guardada: PruebaGuardada = { ...r, en: new Date().toISOString(), ...(r.error && { tipo: r.error.split(":")[0].trim() }) };
        const valor = JSON.stringify(guardada);
        return db.ajuste.upsert({ where: { clave: clavePrueba(r.id) }, update: { valor }, create: { clave: clavePrueba(r.id), valor } });
      }),
  );
  return resultados;
}

// ---------- Modo y cascada ----------

export const EsquemaModo = z.object({
  modo: z.enum(["cascada", "simultaneo", "duelo"]),
  cascada: z
    .array(z.enum(PROVEEDORES_CON_CLAVE))
    .min(1, "La cascada necesita al menos un proveedor")
    .refine((c) => new Set(c).size === c.length, "La cascada tiene proveedores repetidos"),
});
export type ModoCascada = z.infer<typeof EsquemaModo>;

/** Modo y cascada efectivos: lo guardado en /ajustes manda sobre IA_MODO e IA_CASCADA. */
export async function obtenerModo(env: Record<string, string | undefined> = process.env): Promise<ModoCascada> {
  const guardado = await cargarConfigIA();
  const modoEnv = MODOS_IA.includes(env.IA_MODO as ModoIA) ? (env.IA_MODO as ModoIA) : undefined;
  const cascadaEnv = (env.IA_CASCADA ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is (typeof PROVEEDORES_CON_CLAVE)[number] => (PROVEEDORES_CON_CLAVE as readonly string[]).includes(s));
  return {
    modo: guardado.modo ?? modoEnv ?? "cascada",
    cascada: (guardado.cascada as ModoCascada["cascada"] | undefined) ?? (cascadaEnv.length ? [...new Set(cascadaEnv)] : (CASCADA_ID_POR_DEFECTO as ModoCascada["cascada"])),
  };
}

export async function guardarModo(m: ModoCascada): Promise<void> {
  const guardar = (clave: string, valor: string) => db.ajuste.upsert({ where: { clave }, update: { valor }, create: { clave, valor } });
  await Promise.all([guardar("ia.modo", m.modo), guardar("ia.cascada", JSON.stringify(m.cascada)), guardar(CLAVE_CASCADA_OPENAI, "1")]);
}

// ---------- Tabla tarea → proveedor ----------

export const EsquemaTareas = z.object({
  tareas: z.strictObject(Object.fromEntries(TAREAS.map((t) => [t, z.enum(PROVEEDORES_CON_CLAVE).optional()]))),
});

export async function obtenerTareas(): Promise<Record<TareaIA, ProveedorId>> {
  return cargarTablaTareas();
}

export async function guardarTareas(tareas: Partial<Record<TareaIA, ProveedorId>>): Promise<Record<TareaIA, ProveedorId>> {
  const limpia = Object.fromEntries(Object.entries(tareas).filter(([, v]) => v !== undefined)) as Partial<Record<TareaIA, ProveedorId>>;
  await guardarTablaTareas(limpia);
  return cargarTablaTareas();
}
