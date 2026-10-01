import { db } from "@/lib/db";

// Resumen del historial `UsoIA` para /ajustes, con el aviso de 80 % de los límites diarios (docs/07 §1 y §7).

/**
 * Peticiones por día del plan gratuito. Groq: 1.000/día; OpenRouter: 50/día; Cerebras: 5 RPM
 * (≈ 7.200/día como techo de peticiones). Gemini depende del modelo (ver AI Studio): se fija con
 * `GEMINI_LIMITE_DIARIO` en .env.local; sin él no hay aviso.
 */
export const LIMITES_DIARIOS: Record<string, number | null> = {
  gemini: null,
  groq: 1000,
  cerebras: 7200,
  openrouter: 50,
};

export const UMBRAL_AVISO = 0.8;

export interface FilaUso {
  proveedor: string;
  ok: boolean;
  ms: number;
  error: string | null;
  creadoEn: Date;
}

export interface ResumenProveedor {
  proveedor: string;
  total: number;
  ok: number;
  errores: number;
  msPromedio: number;
  limiteDiario: number | null;
  usoHoy: number;
  porcentajeHoy: number | null;
  aviso80: boolean;
}

export interface ResumenUso {
  dias: number;
  desde: string;
  porProveedor: ResumenProveedor[];
  porDia: { fecha: string; total: number; errores: number; proveedores: Record<string, number> }[];
  /** Una fila por día y proveedor (de la más reciente a la más antigua), para la tabla de /ajustes. */
  porDiaProveedor: { fecha: string; proveedor: string; total: number; errores: number; msPromedio: number }[];
  errores: { proveedor: string; tipo: string; cantidad: number; ultimo: string }[];
  avisos: string[];
}

const dia = (d: Date) => d.toISOString().slice(0, 10);

export function limiteDe(proveedor: string, env: Record<string, string | undefined> = process.env): number | null {
  if (proveedor === "gemini") {
    const n = Number(env.GEMINI_LIMITE_DIARIO);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return LIMITES_DIARIOS[proveedor] ?? null;
}

/** Agrega las filas de uso de los últimos `dias` días (el día de `ahora` cuenta como el último). */
export function resumirUso(filas: FilaUso[], dias: number, ahora = new Date(), env: Record<string, string | undefined> = process.env): ResumenUso {
  const desdeFecha = new Date(ahora);
  desdeFecha.setUTCDate(desdeFecha.getUTCDate() - (dias - 1));
  const desde = dia(desdeFecha);
  const hoy = dia(ahora);
  const enRango = filas.filter((f) => dia(f.creadoEn) >= desde && dia(f.creadoEn) <= hoy);

  const proveedores = [...new Set(enRango.map((f) => f.proveedor))].sort();
  const porProveedor = proveedores.map<ResumenProveedor>((proveedor) => {
    const suyas = enRango.filter((f) => f.proveedor === proveedor);
    const usoHoy = suyas.filter((f) => dia(f.creadoEn) === hoy).length;
    const limiteDiario = limiteDe(proveedor, env);
    const porcentajeHoy = limiteDiario ? Math.round((usoHoy / limiteDiario) * 1000) / 10 : null;
    return {
      proveedor,
      total: suyas.length,
      ok: suyas.filter((f) => f.ok).length,
      errores: suyas.filter((f) => !f.ok).length,
      msPromedio: Math.round(suyas.reduce((t, f) => t + f.ms, 0) / suyas.length),
      limiteDiario,
      usoHoy,
      porcentajeHoy,
      aviso80: limiteDiario !== null && usoHoy / limiteDiario >= UMBRAL_AVISO,
    };
  });

  const porDia = [...new Set(enRango.map((f) => dia(f.creadoEn)))].sort().map((fecha) => {
    const delDia = enRango.filter((f) => dia(f.creadoEn) === fecha);
    const conteo: Record<string, number> = {};
    for (const f of delDia) conteo[f.proveedor] = (conteo[f.proveedor] ?? 0) + 1;
    return { fecha, total: delDia.length, errores: delDia.filter((f) => !f.ok).length, proveedores: conteo };
  });

  const porDiaProveedor = [...new Set(enRango.map((f) => `${dia(f.creadoEn)}|${f.proveedor}`))]
    .sort()
    .reverse()
    .map((clave) => {
      const [fecha, proveedor] = clave.split("|");
      const suyas = enRango.filter((f) => dia(f.creadoEn) === fecha && f.proveedor === proveedor);
      return {
        fecha,
        proveedor,
        total: suyas.length,
        errores: suyas.filter((f) => !f.ok).length,
        msPromedio: Math.round(suyas.reduce((t, f) => t + f.ms, 0) / suyas.length),
      };
    });

  const grupos = new Map<string, { proveedor: string; tipo: string; cantidad: number; ultimo: string; fecha: Date }>();
  for (const f of enRango.filter((x) => !x.ok)) {
    const tipo = (f.error ?? "desconocido").split(":")[0].trim() || "desconocido";
    const clave = `${f.proveedor}|${tipo}`;
    const g = grupos.get(clave) ?? { proveedor: f.proveedor, tipo, cantidad: 0, ultimo: "", fecha: new Date(0) };
    g.cantidad++;
    if (f.creadoEn >= g.fecha) Object.assign(g, { fecha: f.creadoEn, ultimo: f.error ?? "" });
    grupos.set(clave, g);
  }
  const errores = [...grupos.values()]
    .sort((x, y) => y.cantidad - x.cantidad)
    .map(({ proveedor, tipo, cantidad, ultimo }) => ({ proveedor, tipo, cantidad, ultimo }));

  const avisos = porProveedor
    .filter((p) => p.aviso80)
    .map((p) => `${p.proveedor} lleva ${p.usoHoy} de ${p.limiteDiario} peticiones hoy (${p.porcentajeHoy} %).`);

  return { dias, desde, porProveedor, porDia, porDiaProveedor, errores, avisos };
}

export async function obtenerUso(dias: number, ahora = new Date()): Promise<ResumenUso> {
  const desde = new Date(ahora);
  desde.setUTCDate(desde.getUTCDate() - dias);
  const filas = await db.usoIA.findMany({ where: { creadoEn: { gte: desde } }, orderBy: { creadoEn: "asc" } });
  return resumirUso(filas, dias, ahora);
}
