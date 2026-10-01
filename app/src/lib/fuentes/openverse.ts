/* eslint-disable @typescript-eslint/no-explicit-any -- normaliza JSON de una API externa cuya forma no controlamos; se valida campo a campo */
import { pedirJson } from "./http";
import type { Fuente, OpcionesFuente } from "./tipos";

// Openverse (api.openverse.org): buscador de imágenes con licencia abierta (Flickr, Wikimedia y otros). Sin clave.
// Solo CC0, dominio público, CC BY y CC BY-SA: se descartan las NC (uso comercial) y las ND, porque recortar o
// reencuadrar una imagen es una obra derivada.

export interface ConsultaOpenverse {
  q: string;
  max?: number;
}

export type LicenciaOpenverse = "cc0" | "cc-by-4.0" | "cc-by" | "cc-by-sa";

export interface FotoOpenverse {
  idFuente: string;
  titulo: string;
  url: string;
  ancho: number | null;
  alto: number | null;
  autor: string;
  licencia: LicenciaOpenverse;
  /** «CC BY 2.0», tal como la publica el autor. */
  licenciaTexto: string;
  /** De dónde viene (flickr, wikimedia…). */
  origen: string;
  credito: string;
  etiquetas: string[];
  urlOrigen: string;
}

const NOMBRE_LICENCIA: Record<string, string> = { by: "CC BY", "by-sa": "CC BY-SA", cc0: "CC0", pdm: "Dominio público" };

/** `null` si la licencia no sirve para las landings. */
export function licenciaOpenverse(licencia: string, version?: string): LicenciaOpenverse | null {
  switch (licencia.toLowerCase()) {
    case "cc0":
    case "pdm":
      return "cc0";
    case "by":
      return version === "4.0" ? "cc-by-4.0" : "cc-by";
    case "by-sa":
      return "cc-by-sa";
    default:
      return null; // by-nd, by-nc, by-nc-sa, by-nc-nd…
  }
}

export function normalizarOpenverse(json: unknown): FotoOpenverse[] {
  const filas = ((json as { results?: Record<string, any>[] })?.results ?? []) as Record<string, any>[];
  const salida: FotoOpenverse[] = [];
  for (const r of filas) {
    const licencia = licenciaOpenverse(String(r.license ?? ""), r.license_version ? String(r.license_version) : undefined);
    if (!licencia || !r.id || typeof r.url !== "string" || !/^https:\/\//.test(r.url)) continue;
    const version = r.license_version ? ` ${r.license_version}` : "";
    const licenciaTexto = `${NOMBRE_LICENCIA[String(r.license).toLowerCase()] ?? String(r.license).toUpperCase()}${["cc0", "pdm"].includes(String(r.license).toLowerCase()) ? "" : version}`;
    const autor = String(r.creator ?? "").trim() || "Autor sin identificar";
    const origen = String(r.source ?? r.provider ?? "");
    salida.push({
      idFuente: String(r.id),
      titulo: String(r.title ?? "").trim() || "Sin título",
      url: r.url,
      ancho: Number.isFinite(Number(r.width)) && Number(r.width) > 0 ? Number(r.width) : null,
      alto: Number.isFinite(Number(r.height)) && Number(r.height) > 0 ? Number(r.height) : null,
      autor,
      licencia,
      licenciaTexto,
      origen,
      credito: `${autor} · ${licenciaTexto} · Openverse${origen ? `/${origen}` : ""}`,
      etiquetas: ((r.tags ?? []) as { name?: string }[]).map((t) => String(t.name ?? "")).filter(Boolean).slice(0, 8),
      urlOrigen: String(r.foreign_landing_url ?? r.url),
    });
  }
  return salida;
}

export function crearOpenverse(op: OpcionesFuente = {}): Fuente<ConsultaOpenverse, FotoOpenverse[]> {
  return {
    id: "openverse",
    ttl: 7 * 24 * 3600,
    habilitada: () => true,
    async consultar(q, señal) {
      const params = new URLSearchParams({ q: q.q, license_type: "commercial,modification", page_size: String(Math.min(20, (q.max ?? 10) * 2)), mature: "false" });
      return normalizarOpenverse(await pedirJson({ fuente: "openverse", url: `https://api.openverse.org/v1/images/?${params}`, señal }, op)).slice(0, q.max ?? 10);
    },
    credito: (item) => (item as FotoOpenverse).credito,
  };
}
