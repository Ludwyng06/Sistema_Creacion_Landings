/* eslint-disable @typescript-eslint/no-explicit-any -- normaliza JSON de una API externa cuya forma no controlamos; se valida campo a campo */
import { pedirJson } from "./http";
import type { Env, Fuente, OpcionesFuente } from "./tipos";

// Pixabay: fotos de uso comercial sin atribución obligatoria (Pixabay Content License). Solo con PIXABAY_API_KEY;
// sin clave se omite sin error. https://pixabay.com/api/docs/

export interface ConsultaPixabay {
  q: string;
  max?: number;
  orientacion?: "horizontal" | "vertical" | "all";
}

export interface FotoPixabay {
  idFuente: string;
  titulo: string;
  url: string;
  ancho: number;
  alto: number;
  autor: string;
  credito: string;
  etiquetas: string[];
  urlOrigen: string;
}

const clave = (env: Env) => env.PIXABAY_API_KEY?.trim() || undefined;

export function normalizarPixabay(json: unknown): FotoPixabay[] {
  const filas = ((json as { hits?: Record<string, any>[] })?.hits ?? []) as Record<string, any>[];
  const salida: FotoPixabay[] = [];
  for (const r of filas) {
    const url = r.largeImageURL ?? r.webformatURL;
    if (r.id === undefined || typeof url !== "string") continue;
    const autor = String(r.user ?? "Autor sin identificar");
    const etiquetas = String(r.tags ?? "").split(",").map((t) => t.trim()).filter(Boolean);
    salida.push({
      idFuente: String(r.id),
      titulo: etiquetas.slice(0, 3).join(", ") || "Foto de Pixabay",
      url,
      ancho: Number(r.imageWidth ?? r.webformatWidth),
      alto: Number(r.imageHeight ?? r.webformatHeight),
      autor,
      credito: `${autor} · Pixabay`,
      etiquetas,
      urlOrigen: String(r.pageURL ?? `https://pixabay.com/photos/id-${r.id}/`),
    });
  }
  return salida;
}

export function crearPixabay(op: OpcionesFuente = {}): Fuente<ConsultaPixabay, FotoPixabay[]> {
  const env = () => op.env ?? process.env;
  return {
    id: "pixabay",
    ttl: 24 * 3600, // los términos de Pixabay piden no guardar las respuestas más de 24 horas
    habilitada: () => clave(env()) !== undefined,
    async consultar(q, señal) {
      const k = clave(env())!;
      const params = new URLSearchParams({ key: k, q: q.q, image_type: "photo", per_page: String(Math.max(3, Math.min(50, q.max ?? 15))), safesearch: "true", lang: "en" });
      if (q.orientacion && q.orientacion !== "all") params.set("orientation", q.orientacion);
      return normalizarPixabay(await pedirJson({ fuente: "pixabay", url: `https://pixabay.com/api/?${params}`, señal, secretos: [k] }, op)).slice(0, q.max ?? 15);
    },
    credito: (item) => (item as FotoPixabay).credito,
  };
}
