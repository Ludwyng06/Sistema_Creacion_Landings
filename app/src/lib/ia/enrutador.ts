import { createHash } from "node:crypto";
import type { ZodType } from "zod";
import { ESPERA_MAXIMA_CUPO_MS, ESPERA_MAXIMA_MS, ErrorNoCabe, esperaSugeridaMs } from "./errores-http";
import { armarPromptManual } from "./manual";
import { proveedoresDisponibles } from "./registro";
import {
  ErrorCascadaAgotada,
  ErrorIA,
  type IntentoIA,
  type ProveedorAmpliado,
  type ModoIA,
  type ImagenIA,
  type ProveedorId,
  type ProveedorIA,
  type RegistradorUso,
  type ResultadoIA,
  type TareaIA,
} from "./tipos";

export interface PeticionIA<T> {
  tarea: TareaIA;
  sistema: string;
  usuario: string;
  esquema: ZodType<T>;
  maxTokens?: number;
  temperatura?: number;
  /** Proveedor(es) que se dejan al final de la lista (p. ej. el que generó la landing, para el crítico o el juez). */
  evitar?: string | string[];
  /** Usa solo este proveedor, sin respaldo (modo duelo: cada lado compite con el suyo). */
  forzar?: ProveedorId;
  /** No lee ni escribe la caché: para respuestas que se validan después (una respuesta mala guardada se repetiría siempre). */
  sinCache?: boolean;
  /** Entrada más corta para los proveedores con cupo por minuto pequeño (Groq): reemplaza sistema, usuario y `maxTokens`. */
  compacta?: { sistema: string; usuario: string; maxTokens?: number };
  /** Tope total de la tarea en ms, sumando proveedores y reintentos; al agotarse la cascada termina sin seguir. */
  plazoMs?: number;
  /** Tope de cada intento dentro del plazo: un proveedor lento no se come el plazo de los demás. */
  plazoIntentoMs?: number;
  /** Tarea liviana (el crítico): los adaptadores usan su camino rápido. */
  rapido?: boolean;
  /** Imagen del mensaje: la tarea solo se envía a proveedores con `soportaImagen` y la caché distingue una imagen de otra. */
  imagen?: ImagenIA;
}

/** Caché de respuestas validadas, por hash de (sistema + usuario + proveedor + modelo + tarea). */
export interface AlmacenCache {
  leer(hash: string): Promise<string | null>;
  escribir(hash: string, valor: string): Promise<void>;
}

export const TTL_CACHE_MS = 7 * 24 * 60 * 60 * 1000;
const PREFIJO_CACHE = "cache:";

/** Caché en la tabla `Ajuste` con la clave `cache:<hash>` (import perezoso: los tests no tocan la base). */
export const almacenCacheAjuste: AlmacenCache = {
  async leer(hash) {
    const { db } = await import("@/lib/db");
    return (await db.ajuste.findUnique({ where: { clave: PREFIJO_CACHE + hash } }))?.valor ?? null;
  },
  async escribir(hash, valor) {
    const { db } = await import("@/lib/db");
    await db.ajuste.upsert({ where: { clave: PREFIJO_CACHE + hash }, update: { valor }, create: { clave: PREFIJO_CACHE + hash, valor } });
  },
};

export function hashCache(p: { sistema: string; usuario: string; proveedor: string; modelo: string; tarea: string }): string {
  return createHash("sha256").update(JSON.stringify([p.sistema, p.usuario, p.proveedor, p.modelo, p.tarea])).digest("hex");
}

export type TablaTareas = Partial<Record<TareaIA, ProveedorId>>;

/** Proveedor preferido por tarea en modo simultáneo (docs/07 §5). */
export const TABLA_TAREAS_POR_DEFECTO: Record<TareaIA, ProveedorId> = {
  // Texto: Cerebras (gpt-oss-120b, 1.000.000 de tokens al día, cola de 5 por minuto). Gemini queda para visión y de respaldo.
  objeciones: "cerebras",
  landing: "cerebras",
  "prompts-grok": "cerebras",
  "corregir-lista-negra": "cerebras",
  humanizar: "cerebras",
  critico: "cerebras",
  "mejorar-prompt": "cerebras",
  "juez-duelo": "groq",
  investigar: "groq",
  "identificar-producto": "gemini",
  "describir-medio": "groq",
  "dato-curioso": "groq",
  estrategia: "cerebras",
  "plan-secciones": "cerebras",
  "redactar-seccion": "cerebras",
  "prompts-imagen": "cerebras",
  "validar-imagen": "gemini",
  intake: "cerebras",
};

const CLAVE_TABLA = "ia.tareas";

/** Lee la tabla guardada en `Ajuste` (clave `ia.tareas`) sobre los valores por defecto. */
export async function cargarTablaTareas(): Promise<Record<TareaIA, ProveedorId>> {
  try {
    const { db } = await import("@/lib/db");
    const fila = await db.ajuste.findUnique({ where: { clave: CLAVE_TABLA } });
    if (fila) return { ...TABLA_TAREAS_POR_DEFECTO, ...(JSON.parse(fila.valor) as TablaTareas) };
  } catch {
    // sin base o JSON dañado: valen los valores por defecto
  }
  return { ...TABLA_TAREAS_POR_DEFECTO };
}

export async function guardarTablaTareas(tabla: TablaTareas): Promise<void> {
  const { db } = await import("@/lib/db");
  const valor = JSON.stringify(tabla);
  await db.ajuste.upsert({ where: { clave: CLAVE_TABLA }, update: { valor }, create: { clave: CLAVE_TABLA, valor } });
}

/** Modo y cascada guardados desde /ajustes (`Ajuste` `ia.modo` e `ia.cascada`); mandan sobre IA_MODO e IA_CASCADA. */
export interface ConfigIA {
  modo?: ModoIA;
  cascada?: ProveedorId[];
}

export async function cargarConfigIA(): Promise<ConfigIA> {
  try {
    const { db } = await import("@/lib/db");
    const filas = await db.ajuste.findMany({ where: { clave: { in: ["ia.modo", "ia.cascada"] } } });
    const valor = (k: string) => filas.find((f) => f.clave === k)?.valor;
    const modo = valor("ia.modo");
    const cascada = valor("ia.cascada");
    return {
      ...(modo && MODOS.includes(modo as ModoIA) && { modo: modo as ModoIA }),
      ...(cascada && { cascada: JSON.parse(cascada) as ProveedorId[] }),
    };
  } catch {
    return {};
  }
}

export interface DepsEnrutador {
  /** Configuración de modo y cascada; por defecto se lee de `Ajuste` (salvo que se inyecten proveedores). */
  config?: ConfigIA;
  /** Almacén de la caché. Por defecto `Ajuste`, salvo que se inyecten proveedores (tests): entonces no hay caché. */
  cache?: AlmacenCache;
  /** Reloj inyectable para el TTL de la caché. */
  ahora?: () => number;
  /** Tabla tarea → proveedor preferido; por defecto se lee de `Ajuste`. */
  tablaTareas?: TablaTareas;
  proveedores?: ProveedorIA[];
  registrarUso?: RegistradorUso;
  /** Espera antes del reintento por límite o saturación (429/503); los tests inyectan una inmediata. */
  espera?: (ms: number) => Promise<void>;
  modo?: ModoIA;
  env?: Record<string, string | undefined>;
}

const MODOS: readonly ModoIA[] = ["cascada", "simultaneo", "duelo"];

/** Por defecto escribe en UsoIA; el import perezoso evita abrir la base en los tests. */
const registrarEnBase: RegistradorUso = async (u) => {
  const { db } = await import("@/lib/db");
  await db.usoIA.create({
    data: {
      tarea: u.tarea,
      proveedor: u.proveedor,
      modelo: u.modelo,
      ms: Math.round(u.ms),
      ok: u.ok,
      error: u.error?.slice(0, 500) ?? null,
    },
  });
};

function aErrorIA(e: unknown): ErrorIA {
  if (e instanceof ErrorIA) return e;
  return new ErrorIA("red", e instanceof Error ? e.message : String(e));
}

type Salida<T> = { ok: true; resultado: ResultadoIA<T> } | { ok: false; error: ErrorIA };

/** Pone primero al proveedor preferido de la tarea y deja el resto en el orden de la cascada. */
function preferidoPrimero(proveedores: ProveedorIA[], preferido?: string): ProveedorIA[] {
  const p = proveedores.find((x) => x.id === preferido);
  return p ? [p, ...proveedores.filter((x) => x !== p)] : proveedores;
}

/** Deja al final al proveedor que se quiere evitar (solo se usa si no hay otro). */
function aplicarEvitar(proveedores: ProveedorIA[], evitar?: string | string[]): ProveedorIA[] {
  const lista = evitar === undefined ? [] : Array.isArray(evitar) ? evitar : [evitar];
  if (lista.length === 0) return proveedores;
  return [...proveedores.filter((x) => !lista.includes(x.id)), ...proveedores.filter((x) => lista.includes(x.id))];
}

/** Nombre del modelo si el adaptador lo expone (entra en el hash de la caché). */
const modeloDe = (p: ProveedorIA) => (p as ProveedorIA & { modelo?: string }).modelo ?? "";

async function cascada<T>(
  p: PeticionIA<T>,
  proveedores: ProveedorIA[],
  registrar: RegistradorUso,
  cache: { almacen: AlmacenCache; ahora: () => number } | null = null,
  espera: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<ResultadoIA<T>> {
  const intentos: IntentoIA[] = [];
  const limite = p.plazoMs !== undefined ? performance.now() + p.plazoMs : Infinity;
  const restante = () => limite - performance.now();

  const huellaImagen = p.imagen ? `
#imagen:${createHash("sha256").update(p.imagen.base64).digest("hex")}` : "";
  const claveCache = (proveedor: ProveedorIA, usuario: string) =>
    hashCache({ sistema: p.sistema, usuario: usuario + huellaImagen, proveedor: proveedor.id, modelo: modeloDe(proveedor), tarea: p.tarea });

  /** Respuesta guardada y vigente que además sigue cumpliendo el esquema; si no, `null`. */
  const desdeCache = async (proveedor: ProveedorIA, usuario: string): Promise<ResultadoIA<T> | null> => {
    if (!cache) return null;
    try {
      const crudo = await cache.almacen.leer(claveCache(proveedor, usuario));
      if (!crudo) return null;
      const guardado = JSON.parse(crudo) as { t: number; resultado: ResultadoIA<unknown> };
      if (cache.ahora() - guardado.t > TTL_CACHE_MS) return null;
      const v = p.esquema.safeParse(guardado.resultado.datos);
      return v.success ? { ...guardado.resultado, datos: v.data, ms: 0 } : null;
    } catch (e) {
      console.warn("Caché de IA no disponible:", e instanceof Error ? e.message : e);
      return null;
    }
  };

  const guardarEnCache = async (proveedor: ProveedorIA, usuario: string, resultado: ResultadoIA<T>) => {
    if (!cache) return;
    try {
      await cache.almacen.escribir(claveCache(proveedor, usuario), JSON.stringify({ t: cache.ahora(), resultado }));
    } catch (e) {
      console.warn("No se pudo guardar en la caché de IA:", e instanceof Error ? e.message : e);
    }
  };

  const intentar = async (proveedor: ProveedorIA, usuario: string): Promise<Salida<T>> => {
    const acierto = await desdeCache(proveedor, usuario);
    if (acierto) return { ok: true, resultado: acierto };
    const inicio = performance.now();
    let salida: Salida<T>;
    try {
      // Los proveedores con cupo por minuto pequeño reciben la entrada compacta (su corrección por esquema va igual).
      const ampliado = proveedor as ProveedorAmpliado;
      const compacta = ampliado.limiteTokensMinuto && p.compacta ? p.compacta : null;
      const resultado = await ampliado.generarJSON({
        sistema: compacta?.sistema ?? p.sistema,
        usuario: compacta ? usuario.replace(p.usuario, () => compacta.usuario) : usuario,
        esquema: p.esquema,
        maxTokens: compacta ? (compacta.maxTokens ?? p.maxTokens) : p.maxTokens,
        temperatura: p.temperatura,
        ...(p.rapido && { rapido: true }),
        ...(p.imagen && { imagen: p.imagen }),
        ...((limite !== Infinity || p.plazoIntentoMs !== undefined) && { timeoutMs: Math.max(1, Math.floor(Math.min(restante(), p.plazoIntentoMs ?? Infinity))) }),
      });
      salida = { ok: true, resultado };
      await guardarEnCache(proveedor, usuario, resultado);
    } catch (e) {
      salida = { ok: false, error: aErrorIA(e) };
    }
    try {
      await registrar({
        tarea: p.tarea,
        proveedor: proveedor.id,
        modelo: salida.ok ? salida.resultado.modelo : "desconocido",
        ms: salida.ok ? salida.resultado.ms : performance.now() - inicio,
        ok: salida.ok,
        ...(!salida.ok && { error: `${salida.error.tipo}: ${salida.error.message}` }),
      });
    } catch (e) {
      // registrar el uso nunca debe tumbar ni bloquear la generación: solo va a consola
      console.warn("No se pudo registrar el uso de IA:", e instanceof Error ? e.message : e);
    }
    if (!salida.ok)
      intentos.push({ proveedor: proveedor.id, tipo: salida.error.tipo, mensaje: salida.error.message });
    return salida;
  };

  /** Un intento y, si da 429/503, un reintento tras la espera sugerida (hasta 40 s si es el cupo por minuto y cabe en el plazo). */
  const conEspera = async (proveedor: ProveedorIA, usuario: string): Promise<Salida<T>> => {
    let r = await intentar(proveedor, usuario);
    // Los límites por minuto se liberan poco a poco: hasta 2 esperas seguidas si el proveedor aún no tiene cupo.
    for (let vez = 0; vez < 2 && !r.ok && r.error.tipo === "limite" && !(r.error instanceof ErrorNoCabe); vez++) {
      const ms = esperaSugeridaMs(r.error.message);
      const tope = /tokens per minute|TPM/i.test(r.error.message) ? ESPERA_MAXIMA_CUPO_MS : ESPERA_MAXIMA_MS;
      if (ms > tope || ms >= restante() || (vez > 0 && tope === ESPERA_MAXIMA_MS)) break;
      await espera(ms);
      r = await intentar(proveedor, usuario);
    }
    return r;
  };

  for (const proveedor of proveedores) {
    if (restante() <= 0) {
      intentos.push({ proveedor: proveedor.id, tipo: "timeout", mensaje: `${proveedor.id}: se agotó el plazo de ${Math.round((p.plazoMs ?? 0) / 1000)} s de la tarea.` });
      break;
    }
    let r = await conEspera(proveedor, p.usuario);
    if (!r.ok && r.error.tipo === "json" && restante() > 0) {
      const correccion =
        `${p.usuario}

Tu respuesta anterior no cumplió el esquema. ` +
        `Corrige estos errores y responde solo con el JSON:
${r.error.message}`;
      r = await conEspera(proveedor, correccion);
    }
    if (r.ok) return r.resultado;
  }
  throw new ErrorCascadaAgotada(intentos, armarPromptManual(p));
}

export async function ejecutar<T>(p: PeticionIA<T>, deps: DepsEnrutador = {}): Promise<ResultadoIA<T>> {
  const env = deps.env ?? process.env;
  const config = deps.config ?? (deps.proveedores ? {} : await cargarConfigIA());
  const envEfectivo = config.cascada?.length ? { ...env, IA_CASCADA: config.cascada.join(",") } : env;
  const disponibles = (deps.proveedores ?? proveedoresDisponibles(envEfectivo)).filter((x) => x.disponible());
  // El orden guardado en /ajustes también ordena (y filtra) a los proveedores inyectados.
  const proveedores = deps.proveedores && config.cascada?.length
    ? config.cascada.flatMap((id) => disponibles.filter((x) => x.id === id))
    : disponibles;
  const registrar = deps.registrarUso ?? registrarEnBase;
  const almacen = deps.cache ?? (deps.proveedores ? undefined : almacenCacheAjuste);
  const cache = almacen && env.IA_CACHE !== "0" && !p.sinCache ? { almacen, ahora: deps.ahora ?? Date.now } : null;
  const conForzado = p.forzar ? proveedores.filter((x) => x.id === p.forzar) : proveedores;
  const candidatos = p.imagen ? conForzado.filter((x) => (x as ProveedorAmpliado).soportaImagen) : conForzado;
  const pedido = deps.modo ?? config.modo ?? env.IA_MODO;
  const modo: ModoIA = MODOS.includes(pedido as ModoIA) ? (pedido as ModoIA) : "cascada";

  switch (modo) {
    case "simultaneo": {
      const tabla = deps.tablaTareas ?? (await cargarTablaTareas());
      return cascada(p, aplicarEvitar(preferidoPrimero(candidatos, tabla[p.tarea]), p.evitar), registrar, cache, deps.espera);
    }
    case "duelo": // llega el día 5; mientras tanto usa la cascada
    case "cascada":
      return cascada(p, aplicarEvitar(candidatos, p.evitar), registrar, cache, deps.espera);
  }
}
