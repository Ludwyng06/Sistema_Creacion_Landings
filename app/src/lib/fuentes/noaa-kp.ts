import { pedirJson } from "./http";
import type { Fuente, OpcionesFuente } from "./tipos";

// NOAA SWPC: índice Kp planetario (services.swpc.noaa.gov). Sin clave.

export type NivelAuroras = "baja" | "moderada" | "alta" | "muy-alta";

export interface IndiceKp {
  kp: number;
  nivel: NivelAuroras;
  /** ISO 8601, en UTC. */
  medidoEn: string;
}

/** Menos de 4 baja, de 4 a menos de 5 moderada, de 5 a menos de 7 alta (tormenta geomagnética), 7 o más muy alta. */
export function nivelDeKp(kp: number): NivelAuroras {
  if (kp < 4) return "baja";
  if (kp < 5) return "moderada";
  if (kp < 7) return "alta";
  return "muy-alta";
}

export function normalizarKp(json: unknown): IndiceKp {
  const filas = Array.isArray(json) ? (json as Record<string, unknown>[]) : [];
  for (let i = filas.length - 1; i >= 0; i--) {
    const kp = Number(filas[i]?.Kp ?? filas[i]?.kp_index);
    const t = String(filas[i]?.time_tag ?? "");
    if (Number.isFinite(kp) && t) return { kp, nivel: nivelDeKp(kp), medidoEn: /Z$|[+-]\d\d:?\d\d$/.test(t) ? t : `${t}Z` };
  }
  throw new Error("La respuesta de NOAA no trae ningún índice Kp.");
}

export function crearNoaaKp(op: OpcionesFuente = {}): Fuente<Record<string, never>, IndiceKp> {
  return {
    id: "noaa-kp",
    ttl: 15 * 60,
    habilitada: () => true,
    async consultar(_q, señal) {
      const json = await pedirJson({ fuente: "noaa-kp", url: "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json", señal }, op);
      return normalizarKp(json);
    },
    credito: () => "NOAA Space Weather Prediction Center",
  };
}
