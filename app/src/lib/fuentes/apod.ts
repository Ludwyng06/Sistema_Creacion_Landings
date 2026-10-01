import { pedirJson } from "./http";
import type { Env, Fuente, OpcionesFuente } from "./tipos";

// NASA APOD. Solo con NASA_API_KEY (con DEMO_KEY agota el tiempo). Excluye las que traigan `copyright` de terceros.

export interface ConsultaApod {
  /** Cantidad de imágenes al azar (por defecto 10). */
  cantidad?: number;
}

export interface ImagenApod {
  fecha: string;
  titulo: string;
  explicacion: string;
  url: string;
  urlHd: string | null;
  credito: string;
  usoComercial: true;
}

const claveNasa = (env: Env) => env.NASA_API_KEY?.trim() || undefined;

export function normalizarApod(json: unknown): ImagenApod[] {
  const lista = Array.isArray(json) ? json : [json];
  const salida: ImagenApod[] = [];
  for (const r of lista as Record<string, unknown>[]) {
    if (!r || r.media_type !== "image" || typeof r.url !== "string") continue;
    if (typeof r.copyright === "string" && r.copyright.trim()) continue; // fotógrafo de terceros: no se ofrece
    salida.push({
      fecha: String(r.date ?? ""),
      titulo: String(r.title ?? ""),
      explicacion: String(r.explanation ?? ""),
      url: r.url,
      urlHd: typeof r.hdurl === "string" ? r.hdurl : null,
      credito: "NASA · Astronomy Picture of the Day",
      usoComercial: true,
    });
  }
  return salida;
}

export function crearApod(op: OpcionesFuente = {}): Fuente<ConsultaApod, ImagenApod[]> {
  const env = () => op.env ?? process.env;
  return {
    id: "apod",
    ttl: 24 * 3600,
    habilitada: () => claveNasa(env()) !== undefined,
    async consultar(q, señal) {
      const clave = claveNasa(env())!;
      const url = `https://api.nasa.gov/planetary/apod?${new URLSearchParams({ api_key: clave, count: String(q.cantidad ?? 10), thumbs: "false" })}`;
      return normalizarApod(await pedirJson({ fuente: "apod", url, señal, secretos: [clave] }, op));
    },
    credito: (item) => (item as ImagenApod).credito,
  };
}
