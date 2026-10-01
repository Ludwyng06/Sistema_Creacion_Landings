import { pedirJson } from "./http";
import type { Fuente, OpcionesFuente } from "./tipos";

// NASA Image and Video Library (images-api.nasa.gov). Sin clave. Imágenes de dominio público en general,
// pero nunca se usan los logos de NASA ni se sugiere respaldo (docs/v2 §14.5).

const BASE = "https://images-api.nasa.gov";

export interface ConsultaNasa {
  q: string;
  /** Máximo de resultados (por defecto 20). */
  max?: number;
}

export interface ImagenNasa {
  nasaId: string;
  titulo: string;
  descripcion: string;
  fecha: string | null;
  centro: string | null;
  credito: string;
  /** `false` si la ficha menciona derechos de terceros: nunca se ofrece. */
  usoComercial: boolean;
  miniatura: string | null;
  urlOrigen: string;
}

type ItemBusqueda = {
  data?: { nasa_id?: string; title?: string; description?: string; date_created?: string; center?: string; photographer?: string; secondary_creator?: string; media_type?: string }[];
  links?: { href?: string; rel?: string; render?: string }[];
};

const TERCEROS = /copyright|©|getty|shutterstock|reuters|associated press|used with permission|con permiso/i;

const limpiarHtml = (t: string) => t.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

/** Crédito: fotógrafo o creador secundario y el centro; siempre menciona a NASA como fuente. */
export function creditoNasa(d: { photographer?: string; secondary_creator?: string; center?: string }): string {
  const persona = (d.photographer ?? d.secondary_creator ?? "").trim();
  const centro = (d.center ?? "").trim();
  if (persona && /nasa/i.test(persona)) return persona; // «ISRO/NASA/JPL-Caltech»: ya nombra a NASA
  if (persona && centro) return `${persona} / NASA ${centro}`;
  if (persona) return `${persona} / NASA`;
  if (centro) return `NASA/${centro}`;
  return "NASA";
}

export function normalizarBusquedaNasa(json: unknown): ImagenNasa[] {
  const items = ((json as { collection?: { items?: ItemBusqueda[] } })?.collection?.items ?? []) as ItemBusqueda[];
  const salida: ImagenNasa[] = [];
  for (const it of items) {
    const d = it.data?.[0];
    if (!d?.nasa_id || d.media_type !== "image") continue;
    const texto = `${d.description ?? ""} ${d.photographer ?? ""} ${d.secondary_creator ?? ""}`;
    salida.push({
      nasaId: d.nasa_id,
      titulo: limpiarHtml(d.title ?? d.nasa_id),
      descripcion: limpiarHtml(d.description ?? ""),
      fecha: d.date_created ?? null,
      centro: d.center ?? null,
      credito: creditoNasa(d),
      usoComercial: !TERCEROS.test(texto),
      miniatura: it.links?.find((l) => l.rel === "preview")?.href ?? null,
      urlOrigen: `https://images.nasa.gov/details/${encodeURIComponent(d.nasa_id)}`,
    });
  }
  return salida;
}

export function crearNasaImagenes(op: OpcionesFuente = {}): Fuente<ConsultaNasa, ImagenNasa[]> {
  return {
    id: "nasa-imagenes",
    ttl: 7 * 24 * 3600,
    habilitada: () => true,
    async consultar(q, señal) {
      const url = `${BASE}/search?${new URLSearchParams({ q: q.q, media_type: "image", page_size: String(q.max ?? 20) })}`;
      return normalizarBusquedaNasa(await pedirJson({ fuente: "nasa-imagenes", url, señal }, op)).slice(0, q.max ?? 20);
    },
    credito: (item) => (item as ImagenNasa).credito,
  };
}

/** `/asset/{nasa_id}`: las imágenes descargables, de la mejor a la peor. Prefiere el JPEG original, luego la versión grande y la mediana. */
export async function urlsImagenNasa(nasaId: string, op: OpcionesFuente = {}, señal?: AbortSignal): Promise<string[]> {
  const json = (await pedirJson({ fuente: "nasa-imagenes", url: `${BASE}/asset/${encodeURIComponent(nasaId)}`, señal }, op)) as {
    collection?: { items?: { href?: string }[] };
  };
  const urls = (json.collection?.items ?? []).map((i) => (i.href ?? "").replace(/^http:/, "https:")).filter(Boolean);
  return [/~orig\.jpe?g$/i, /~large\.jpe?g$/i, /~medium\.jpe?g$/i].flatMap((re) => urls.filter((u) => re.test(u)).slice(0, 1));
}

/** La mejor imagen de `/asset/{nasa_id}` (el JPEG original si existe). */
export async function resolverImagenNasa(nasaId: string, op: OpcionesFuente = {}, señal?: AbortSignal): Promise<string | null> {
  return (await urlsImagenNasa(nasaId, op, señal))[0] ?? null;
}
