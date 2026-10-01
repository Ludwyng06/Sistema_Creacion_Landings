import { pedirJson } from "./http";
import type { Fuente, OpcionesFuente } from "./tipos";

// Where the ISS at? (api.wheretheiss.at). Sin clave.

export interface PosicionIss {
  latitud: number;
  longitud: number;
  altitudKm: number;
  velocidadKmh: number;
  visibilidad: string | null;
  /** ISO 8601. */
  medidoEn: string;
}

export function normalizarIss(json: unknown): PosicionIss {
  const j = json as Record<string, unknown>;
  const latitud = Number(j.latitude);
  const longitud = Number(j.longitude);
  const altitudKm = Number(j.altitude);
  const velocidadKmh = Number(j.velocity);
  const t = Number(j.timestamp);
  if (![latitud, longitud, altitudKm, velocidadKmh, t].every(Number.isFinite)) throw new Error("La respuesta de la ISS está incompleta.");
  return { latitud, longitud, altitudKm, velocidadKmh, visibilidad: typeof j.visibility === "string" ? j.visibility : null, medidoEn: new Date(t * 1000).toISOString() };
}

export function crearIss(op: OpcionesFuente = {}): Fuente<Record<string, never>, PosicionIss> {
  return {
    id: "iss",
    ttl: 30,
    habilitada: () => true,
    async consultar(_q, señal) {
      return normalizarIss(await pedirJson({ fuente: "iss", url: "https://api.wheretheiss.at/v1/satellites/25544", señal }, op));
    },
    credito: () => "wheretheiss.at",
  };
}
