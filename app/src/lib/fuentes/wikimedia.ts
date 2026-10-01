/* eslint-disable @typescript-eslint/no-explicit-any -- normaliza JSON de una API externa cuya forma no controlamos; se valida campo a campo */
import { pedirJson } from "./http";
import type { Fuente, OpcionesFuente } from "./tipos";

// Wikimedia Commons: fotos libres. Se descartan las que no sean CC0, CC BY o CC BY-SA (o dominio público). Sin clave.

export interface ConsultaWikimedia {
  q: string;
  max?: number;
  /** Ancho de la miniatura que se pide (por defecto 1600). */
  ancho?: number;
}

export type LicenciaWikimedia = "cc0" | "cc-by-4.0" | "cc-by" | "cc-by-sa";

export interface FotoWikimedia {
  /** Título del archivo en Commons (`File:…`). */
  idFuente: string;
  titulo: string;
  url: string;
  ancho: number;
  alto: number;
  autor: string;
  licencia: LicenciaWikimedia;
  /** Texto de la licencia tal como la declara Commons («CC BY-SA 4.0»). */
  licenciaTexto: string;
  credito: string;
  descripcion: string;
  urlOrigen: string;
}

const quitarHtml = (t: string) =>
  t
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** `null` si la licencia no permite el uso comercial con crédito (CC BY-NC, CC BY-ND, todos los derechos reservados…). */
export function licenciaPermitida(texto: string): LicenciaWikimedia | null {
  const t = texto.trim().toLowerCase();
  if (/\b(nc|nd)\b|non-?commercial|no derivatives|all rights reserved|fair use/.test(t)) return null;
  if (/^cc0|public domain|dominio p[uú]blico|^pd\b|cc-?zero/.test(t)) return "cc0";
  if (/^cc[- ]by[- ]sa/.test(t)) return "cc-by-sa";
  if (/^cc[- ]by\b/.test(t)) return /4\.0/.test(t) ? "cc-by-4.0" : "cc-by";
  return null;
}

export function normalizarWikimedia(json: unknown): FotoWikimedia[] {
  const paginas = Object.values((json as { query?: { pages?: Record<string, any> } })?.query?.pages ?? {}) as Record<string, any>[];
  paginas.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const salida: FotoWikimedia[] = [];
  for (const p of paginas) {
    const info = p.imageinfo?.[0];
    const meta = (info?.extmetadata ?? {}) as Record<string, { value?: unknown }>;
    const licenciaTexto = quitarHtml(String(meta.LicenseShortName?.value ?? ""));
    const licencia = licenciaPermitida(licenciaTexto);
    const url = info?.thumburl ?? info?.url;
    if (!info || !licencia || typeof url !== "string" || !/^image\/(jpeg|png|webp)$/.test(String(info.mime ?? "image/jpeg"))) continue;
    const autor = quitarHtml(String(meta.Artist?.value ?? "")) || "Autor sin identificar";
    const titulo = String(p.title ?? "").replace(/^File:/, "").replace(/\.[a-z]{3,4}$/i, "");
    salida.push({
      idFuente: String(p.title),
      titulo: quitarHtml(String(meta.ObjectName?.value ?? "")) || titulo,
      url,
      ancho: Number(info.thumbwidth ?? info.width),
      alto: Number(info.thumbheight ?? info.height),
      autor,
      licencia,
      licenciaTexto,
      credito: `${autor} · ${licenciaTexto} · Wikimedia Commons`,
      descripcion: quitarHtml(String(meta.ImageDescription?.value ?? "")).slice(0, 300),
      urlOrigen: String(info.descriptionurl ?? `https://commons.wikimedia.org/wiki/${encodeURIComponent(String(p.title))}`),
    });
  }
  return salida;
}

export function crearWikimedia(op: OpcionesFuente = {}): Fuente<ConsultaWikimedia, FotoWikimedia[]> {
  return {
    id: "wikimedia",
    ttl: 7 * 24 * 3600,
    habilitada: () => true,
    async consultar(q, señal) {
      const params = new URLSearchParams({
        action: "query",
        generator: "search",
        gsrsearch: `${q.q} filetype:bitmap`,
        gsrnamespace: "6",
        gsrlimit: String((q.max ?? 10) * 2), // se descartan las de licencia no permitida
        prop: "imageinfo",
        iiprop: "url|size|mime|extmetadata",
        iiurlwidth: String(q.ancho ?? 1600),
        format: "json",
        origin: "*",
      });
      return normalizarWikimedia(await pedirJson({ fuente: "wikimedia", url: `https://commons.wikimedia.org/w/api.php?${params}`, señal }, op)).slice(0, q.max ?? 10);
    },
    credito: (item) => (item as FotoWikimedia).credito,
  };
}
