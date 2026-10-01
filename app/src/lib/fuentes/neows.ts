/* eslint-disable @typescript-eslint/no-explicit-any -- normaliza JSON de una API externa cuya forma no controlamos; se valida campo a campo */
import { pedirJson } from "./http";
import type { Env, Fuente, OpcionesFuente } from "./tipos";

// NASA NeoWs (asteroides cercanos). Usa NASA_API_KEY y, si falta, DEMO_KEY.

export interface ConsultaNeoWs {
  /** AAAA-MM-DD, en UTC. */
  fecha: string;
}

export interface Asteroide {
  nombre: string;
  distanciaKm: number;
  diametroMaxM: number;
  velocidadKmh: number;
  peligroso: boolean;
  fechaAcercamiento: string;
}

export interface AsteroidesDelDia {
  fecha: string;
  cantidad: number;
  /** Ordenados del más cercano al más lejano. */
  asteroides: Asteroide[];
}

const clave = (env: Env) => env.NASA_API_KEY?.trim() || "DEMO_KEY";

export function normalizarNeoWs(json: unknown, fecha: string): AsteroidesDelDia {
  const j = json as { element_count?: number; near_earth_objects?: Record<string, Record<string, any>[]> };
  const del = j.near_earth_objects?.[fecha] ?? Object.values(j.near_earth_objects ?? {}).flat();
  const asteroides: Asteroide[] = [];
  for (const a of del) {
    const ap = a.close_approach_data?.[0];
    if (!ap) continue;
    asteroides.push({
      nombre: String(a.name ?? "").replace(/^\(|\)$/g, ""),
      distanciaKm: Number(ap.miss_distance?.kilometers ?? NaN),
      diametroMaxM: Number(a.estimated_diameter?.meters?.estimated_diameter_max ?? NaN),
      velocidadKmh: Number(ap.relative_velocity?.kilometers_per_hour ?? NaN),
      peligroso: Boolean(a.is_potentially_hazardous_asteroid),
      fechaAcercamiento: String(ap.close_approach_date_full ?? ap.close_approach_date ?? ""),
    });
  }
  const validos = asteroides.filter((a) => Number.isFinite(a.distanciaKm) && Number.isFinite(a.diametroMaxM));
  validos.sort((a, b) => a.distanciaKm - b.distanciaKm);
  return { fecha, cantidad: j.element_count ?? validos.length, asteroides: validos };
}

export function crearNeoWs(op: OpcionesFuente = {}): Fuente<ConsultaNeoWs, AsteroidesDelDia> {
  const env = () => op.env ?? process.env;
  return {
    id: "neows",
    ttl: 12 * 3600,
    habilitada: () => true,
    async consultar(q, señal) {
      const k = clave(env());
      const url = `https://api.nasa.gov/neo/rest/v1/feed?${new URLSearchParams({ start_date: q.fecha, end_date: q.fecha, api_key: k })}`;
      return normalizarNeoWs(await pedirJson({ fuente: "neows", url, señal, secretos: [k] }, op), q.fecha);
    },
    credito: () => "NASA/JPL · NeoWs",
  };
}
