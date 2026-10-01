/* eslint-disable @typescript-eslint/no-explicit-any -- normaliza JSON de una API externa cuya forma no controlamos; se valida campo a campo */
import { pedirJson } from "./http";
import type { Env, Fuente, OpcionesFuente } from "./tipos";

// Launch Library 2 (The Space Devs), versión 2.3.0. Sin clave tiene límite por hora; `LAUNCH_LIBRARY_KEY` es opcional.

const VERSION = "2.3.0";

export interface ConsultaLanzamientos {
  /** Cantidad de lanzamientos próximos (por defecto 5). */
  max?: number;
}

export interface Lanzamiento {
  id: string;
  nombre: string;
  mision: string;
  cohete: string;
  proveedor: string | null;
  lugar: string | null;
  /** Fecha objetivo (NET), ISO 8601. */
  fecha: string;
  estado: string;
  descripcion: string | null;
}

export function normalizarLanzamientos(json: unknown, ahora: Date = new Date()): Lanzamiento[] {
  const filas = ((json as { results?: Record<string, any>[] })?.results ?? []) as Record<string, any>[];
  const salida: Lanzamiento[] = [];
  for (const r of filas) {
    const fecha = typeof r.net === "string" ? r.net : "";
    if (!r.id || !fecha || Number.isNaN(Date.parse(fecha))) continue;
    const [coheteNombre, ...resto] = String(r.name ?? "").split(" | ");
    salida.push({
      id: String(r.id),
      nombre: String(r.name ?? ""),
      mision: String(r.mission?.name ?? resto.join(" | ") ?? "").trim() || String(r.name ?? ""),
      cohete: String(r.rocket?.configuration?.full_name ?? r.rocket?.configuration?.name ?? coheteNombre).trim(),
      proveedor: r.launch_service_provider?.name ?? null,
      lugar: r.pad?.location?.name ?? null,
      fecha,
      estado: String(r.status?.name ?? ""),
      descripcion: typeof r.mission?.description === "string" ? r.mission.description : null,
    });
  }
  // Solo lo que aún no ocurrió, del más próximo al más lejano.
  return salida.filter((l) => Date.parse(l.fecha) > ahora.getTime()).sort((a, b) => Date.parse(a.fecha) - Date.parse(b.fecha));
}

const clave = (env: Env) => env.LAUNCH_LIBRARY_KEY?.trim() || undefined;

export function crearLanzamientos(op: OpcionesFuente = {}): Fuente<ConsultaLanzamientos, Lanzamiento[]> {
  const env = () => op.env ?? process.env;
  return {
    id: "lanzamientos",
    ttl: 3600,
    habilitada: () => true,
    async consultar(q, señal) {
      const k = clave(env());
      const url = `https://ll.thespacedevs.com/${VERSION}/launches/upcoming/?${new URLSearchParams({ limit: String(q.max ?? 5), mode: "normal" })}`;
      const headers: Record<string, string> = k ? { Authorization: `Token ${k}` } : {};
      return normalizarLanzamientos(await pedirJson({ fuente: "lanzamientos", url, señal, headers, secretos: k ? [k] : [] }, op));
    },
    credito: () => "The Space Devs · Launch Library 2",
  };
}
