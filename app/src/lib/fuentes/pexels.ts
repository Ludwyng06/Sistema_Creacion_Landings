/* eslint-disable @typescript-eslint/no-explicit-any -- normaliza JSON de una API externa cuya forma no controlamos; se valida campo a campo */
import { pedirJson } from "./http";
import type { Env, Fuente, OpcionesFuente } from "./tipos";

// Pexels: fotos de ambiente. Solo con PEXELS_API_KEY; sin clave se omite sin error. https://www.pexels.com/api/

export interface ConsultaPexels {
  q: string;
  max?: number;
  orientacion?: "landscape" | "portrait" | "square";
}

export interface FotoPexels {
  idFuente: string;
  url: string;
  ancho: number;
  alto: number;
  autor: string;
  alt: string;
  colorPromedio: string | null;
  credito: string;
  urlOrigen: string;
}

const clave = (env: Env) => env.PEXELS_API_KEY?.trim() || undefined;

export function normalizarPexels(json: unknown): FotoPexels[] {
  const fotos = ((json as { photos?: Record<string, any>[] })?.photos ?? []) as Record<string, any>[];
  const salida: FotoPexels[] = [];
  for (const f of fotos) {
    const url = f.src?.large2x ?? f.src?.large ?? f.src?.original;
    if (f.id === undefined || typeof url !== "string") continue;
    const autor = String(f.photographer ?? "Autor sin identificar");
    salida.push({
      idFuente: String(f.id),
      url,
      ancho: Number(f.width),
      alto: Number(f.height),
      autor,
      alt: String(f.alt ?? ""),
      colorPromedio: typeof f.avg_color === "string" ? f.avg_color : null,
      credito: `${autor} · Pexels`,
      urlOrigen: String(f.url ?? `https://www.pexels.com/photo/${f.id}/`),
    });
  }
  return salida;
}

export function crearPexels(op: OpcionesFuente = {}): Fuente<ConsultaPexels, FotoPexels[]> {
  const env = () => op.env ?? process.env;
  return {
    id: "pexels",
    ttl: 7 * 24 * 3600,
    habilitada: () => clave(env()) !== undefined,
    async consultar(q, señal) {
      const k = clave(env())!;
      const params = new URLSearchParams({ query: q.q, per_page: String(q.max ?? 15), locale: "es-ES" });
      if (q.orientacion) params.set("orientation", q.orientacion);
      return normalizarPexels(await pedirJson({ fuente: "pexels", url: `https://api.pexels.com/v1/search?${params}`, señal, headers: { Authorization: k }, secretos: [k] }, op));
    },
    credito: (item) => (item as FotoPexels).credito,
  };
}
