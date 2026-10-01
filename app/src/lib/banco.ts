import type { BloquePrompt, FuenteMedio, LandingDoc, TecnicaId } from "@/lib/contratos";
import type { LandingCompleta } from "@/lib/landings";
import { modulos } from "@/lib/tecnicas/modulos";
import { varianteDe } from "@/secciones/variantes";

// Lógica pura de /banco: qué muestra cada tarjeta y cómo se filtran. Sin base de datos ni React.

export const BLOQUES_PROMPT: BloquePrompt[] = ["rol", "tarea", "contexto", "formato"];

export const NOMBRE_TECNICA = (id: string) => modulos.find((m) => m.id === id)?.nombre ?? id;

export type Tematica = "espacio" | "producto";

export const NOMBRE_TEMATICA: Record<Tematica, string> = { espacio: "Espacio", producto: "Producto" };

const FUENTES_ESPACIALES: readonly FuenteMedio[] = ["nasa-images", "apod", "epic"];

const NOMBRE_FUENTE_MEDIO: Partial<Record<FuenteMedio, string>> = {
  "nasa-images": "NASA",
  apod: "NASA",
  epic: "NASA",
  wikimedia: "Wikimedia",
  "open-food-facts": "Open Food Facts",
  "open-beauty-facts": "Open Beauty Facts",
  pexels: "Pexels",
};

/** De dónde sale el dato de cada widget en vivo (variante de `dato-en-vivo`). */
const FUENTE_WIDGET = {
  auroras: "NOAA",
  "fase-lunar": "USNO",
  iss: "ISS",
  "cuenta-regresiva-lanzamiento": "Launch Library",
  asteroides: "NASA",
} as const;

/**
 * Espacio o Producto. Manda `meta.tematica` si el motor la escribe; si no, es «Espacio» cuando la landing usa un widget
 * en vivo o imágenes de la NASA.
 */
export function tematicaDe(doc: LandingDoc): Tematica {
  const declarada = (doc.meta as { tematica?: unknown }).tematica;
  if (declarada === "espacio" || declarada === "producto") return declarada;
  const conWidget = doc.secciones.some((s) => s.tipo === "dato-en-vivo");
  const conNasa = doc.assets.some((a) => a.fuente && FUENTES_ESPACIALES.includes(a.fuente));
  return conWidget || conNasa ? "espacio" : "producto";
}

/**
 * Fuentes de datos y medios que usa la landing, sin repetir y en orden de aparición («NASA», «NOAA»…).
 * Si el motor guarda `meta.fuentes` (lista de nombres), esa lista manda.
 */
export function fuentesDe(doc: LandingDoc): string[] {
  const declaradas = (doc.meta as { fuentes?: unknown }).fuentes;
  if (Array.isArray(declaradas) && declaradas.every((f) => typeof f === "string")) return [...new Set(declaradas as string[])];
  const nombres: string[] = [];
  for (const asset of doc.assets) {
    const nombre = asset.ruta && asset.fuente ? NOMBRE_FUENTE_MEDIO[asset.fuente] : undefined;
    if (nombre) nombres.push(nombre);
  }
  for (const seccion of doc.secciones) {
    if (seccion.tipo === "dato-en-vivo") nombres.push(FUENTE_WIDGET[varianteDe("dato-en-vivo", seccion.variante)]);
  }
  return [...new Set(nombres)];
}

/** Ruta de la imagen del héroe (el fondo del banco o el producto), si ya tiene archivo: respaldo de la miniatura. */
export function imagenHeroeDe(doc: LandingDoc): string | null {
  const heroe = doc.secciones.find((s) => s.tipo === "heroe");
  if (!heroe) return null;
  const { slot, slots } = heroe.ajustes as { slot?: string; slots?: string[] };
  for (const nombre of [...(slots ?? []), slot]) {
    const ruta = nombre ? doc.assets.find((a) => a.slot === nombre && a.tipo === "imagen")?.ruta : undefined;
    if (ruta) return ruta;
  }
  return null;
}

export interface TarjetaBanco {
  id: string;
  slug: string;
  nombre: string;
  producto: string;
  proveedor: string;
  /** ISO 8601 de creación. */
  creadoEn: string;
  tecnicas: TecnicaId[];
  /** Puntaje del crítico (0 a 10) o `null` si no hubo crítico. */
  puntaje: number | null;
  /** Intensidad de efectos de los tokens (1 a 3). */
  intensidad: 1 | 2 | 3;
  miniatura: string | null;
  /** Imagen del héroe: se muestra si la captura falta o no carga. */
  imagenHeroe: string | null;
  tematica: Tematica;
  /** Secciones visibles de la landing. */
  secciones: number;
  /** Fuentes de datos y medios («NASA», «NOAA»…). */
  fuentes: string[];
  favorita: boolean;
  /** Los 4 bloques del prompt, resumidos para el reverso de la tarjeta. */
  resumen: Record<BloquePrompt, string>;
}

/** Colapsa espacios y recorta en el último espacio antes de `max`, con «…». */
export function resumirTexto(texto: string, max: number): string {
  const limpio = texto
    .replace(/[`*#>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (limpio.length <= max) return limpio;
  const corte = limpio.lastIndexOf(" ", max);
  return `${limpio.slice(0, corte > max * 0.6 ? corte : max).trimEnd()}…`;
}

export const LARGO_RESUMEN = 170;

export function aTarjeta(l: LandingCompleta): TarjetaBanco {
  return {
    id: l.id,
    slug: l.slug,
    nombre: l.nombre,
    producto: l.doc.meta.producto,
    proveedor: l.proveedor,
    creadoEn: l.creadoEn,
    tecnicas: l.tecnicas,
    puntaje: l.puntaje,
    intensidad: l.doc.tokens.intensidad,
    miniatura: l.miniatura,
    imagenHeroe: imagenHeroeDe(l.doc),
    tematica: tematicaDe(l.doc),
    secciones: l.doc.secciones.filter((x) => x.visible).length,
    fuentes: fuentesDe(l.doc),
    favorita: l.favorita,
    resumen: {
      rol: resumirTexto(l.promptBloques.rol, LARGO_RESUMEN),
      tarea: resumirTexto(l.promptBloques.tarea, LARGO_RESUMEN),
      contexto: resumirTexto(l.promptBloques.contexto, LARGO_RESUMEN),
      formato: resumirTexto(l.promptBloques.formato, LARGO_RESUMEN),
    },
  };
}

export type OrdenBanco = "recientes" | "puntaje";

export interface FiltrosBanco {
  busqueda: string;
  /** `""` = todas. */
  tecnica: TecnicaId | "";
  proveedor: string;
  /** `""` = todas. */
  tematica: Tematica | "";
  /** `0` = todas. */
  intensidad: 0 | 1 | 2 | 3;
  soloFavoritas: boolean;
  orden: OrdenBanco;
}

export const FILTROS_VACIOS: FiltrosBanco = { busqueda: "", tecnica: "", proveedor: "", tematica: "", intensidad: 0, soloFavoritas: false, orden: "recientes" };

/** Minúsculas y sin tildes, para buscar «postura» y «Póstura» por igual. */
export const normalizar = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function filtrarTarjetas(tarjetas: TarjetaBanco[], f: FiltrosBanco): TarjetaBanco[] {
  const palabras = normalizar(f.busqueda).split(/\s+/).filter(Boolean);
  const coincide = (t: TarjetaBanco) => {
    if (f.tecnica && !t.tecnicas.includes(f.tecnica)) return false;
    if (f.proveedor && t.proveedor !== f.proveedor) return false;
    if (f.tematica && t.tematica !== f.tematica) return false;
    if (f.intensidad && t.intensidad !== f.intensidad) return false;
    if (f.soloFavoritas && !t.favorita) return false;
    if (palabras.length === 0) return true;
    const pajar = normalizar([t.nombre, t.producto, t.proveedor, NOMBRE_TEMATICA[t.tematica], ...t.fuentes, ...t.tecnicas.map(NOMBRE_TECNICA)].join(" "));
    return palabras.every((p) => pajar.includes(p));
  };
  const lista = tarjetas.filter(coincide);
  return f.orden === "puntaje"
    ? [...lista].sort((a, b) => (b.puntaje ?? -1) - (a.puntaje ?? -1) || b.creadoEn.localeCompare(a.creadoEn))
    : [...lista].sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
}

/** Opciones de los filtros a partir de lo que hay en el banco (solo valores que existen). */
export function opcionesFiltro(tarjetas: TarjetaBanco[]) {
  const unicos = <T>(xs: T[]) => [...new Set(xs)];
  return {
    tecnicas: unicos(tarjetas.flatMap((t) => t.tecnicas)).sort() as TecnicaId[],
    proveedores: unicos(tarjetas.map((t) => t.proveedor)).sort(),
    tematicas: unicos(tarjetas.map((t) => t.tematica)).sort() as Tematica[],
    intensidades: unicos(tarjetas.map((t) => t.intensidad)).sort() as (1 | 2 | 3)[],
  };
}

export const NOMBRE_INTENSIDAD: Record<1 | 2 | 3, string> = { 1: "sobria", 2: "media", 3: "de otro mundo" };

/** «29 sep 2026» en español, en hora de Colombia para que servidor y navegador coincidan. */
export function formatearFecha(iso: string): string {
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Bogota" }).format(new Date(iso)).replace(/\./g, "");
}

/** «29 sep, 17:32» con hora de 24 horas: el servidor y el navegador dan el mismo texto (sin «a. m.» con espacios especiales). */
export function formatearFechaHora(iso: string): string {
  const d = new Date(iso);
  const dia = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", timeZone: "America/Bogota" }).format(d).replace(/\./g, "");
  const hora = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "America/Bogota" }).format(d);
  return `${dia}, ${hora}`;
}
