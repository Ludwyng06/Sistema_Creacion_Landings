// Filtro del catálogo de tipografías (tarea 10-A). Función pura: recibe la respuesta de la API de Google Fonts
// (`webfonts/v1/webfonts?sort=popularity&capability=WOFF2&capability=VF`) y devuelve las 200 mejores para español.
// La usa `npm run fuentes`; los tests la corren con un fixture grabado de la API.

export type CategoriaFuente = "sans-serif" | "serif" | "display" | "handwriting" | "monospace";
export type UsoSugerido = "titulos" | "cuerpo" | "ambos";

/** Lo que usamos de cada familia que devuelve la API. */
export interface FamiliaApi {
  family: string;
  /** `regular`, `italic`, `700`, `700italic`… */
  variants: string[];
  subsets: string[];
  category: string;
  axes?: { tag: string; start: number; end: number }[];
}

export interface EntradaFuente {
  familia: string;
  categoria: CategoriaFuente;
  pesos: number[];
  variable: boolean;
  cursiva: boolean;
  /** Puesto en la lista de popularidad de Google Fonts (1 = la más usada). */
  popularidad: number;
  usoSugerido: UsoSugerido;
  /** Trae también el subconjunto `latin-ext` (más acentos y letras raras). */
  latinExt: boolean;
}

export const CATEGORIAS: readonly CategoriaFuente[] = ["sans-serif", "serif", "display", "handwriting", "monospace"];
/** Cuántas de cada categoría (suman 200). */
export const CUPO_POR_CATEGORIA: Record<CategoriaFuente, number> = { "sans-serif": 80, serif: 55, display: 35, handwriting: 15, monospace: 15 };
export const TOTAL_CATALOGO = 200;
export const MIN_PESOS = 3;

/** Alfabetos que conviven con el latino en una misma familia sin que sea «de otro alfabeto» (Open Sans trae hebreo, Poppins devanagari). */
const SUBSETS_COMPATIBLES = new Set([
  "latin", "latin-ext", "cyrillic", "cyrillic-ext", "greek", "greek-ext", "vietnamese", "math", "symbols", "symbols2",
  "hebrew", "devanagari", "emoji", "gothic", "old-italic", "runic", "kayah-li",
]);
/** Familias con alfabeto latino propio de primera clase que aun así traen otro alfabeto duro. */
const EXCEPCIONES_ALFABETO = new Set(["Rubik", "Noto Sans", "Noto Serif"]);
const NOTO_LATINAS = new Set(["Noto Sans", "Noto Serif", "Noto Sans Display", "Noto Serif Display", "Noto Sans Mono"]);
const ICONOS = /icons?\b|symbols?\b|emoji|awesome|barcode|braille|bootstrap|\bmaterial\b|ligature/i;
/** Nombres de familias de otro alfabeto o región (Baloo Bhai, Hind Siliguri, Noto Sans Devanagari, Anek Telugu…). */
const OTRO_ALFABETO =
  /\b(JP|KR|SC|TC|HK|Arabic|Hebrew|Thai|Devanagari|Bengali|Bangla|Tamil|Telugu|Kannada|Malayalam|Gujarati|Gurmukhi|Sinhala|Khmer|Lao|Myanmar|Ethiopic|Georgian|Armenian|Kufi|Naskh|Nastaliq|Japanese|Korean|Chinese|Mincho|Deva|Bhai|Bhaijaan|Bhaina|Chettan|Paaji|Tamma|Tammudu|Thambi|Siliguri|Madurai|Vadodara|Guntur)\b/i;
/** Sufijos de variantes de ancho o de tamaño óptico que duplican a la familia base. */
const SUFIJO_DUPLICADO = /\s+(?:Semi |Extra |Ultra )?(?:Condensed|Narrow|Expanded|Flex|Text|Caption|Micro)$/i;

/** Familias que Google publica en decenas de variantes regionales o de estilo (Playwrite VN, Edu SA Beginner…): entra solo la más popular de cada grupo. */
const GRUPOS_DE_VARIANTES = /^(Playwrite|Edu|Bitcount|Averia|Cormorant|Big Shoulders)(?: |$)/

const PASOS_PESO = [100, 200, 300, 400, 500, 600, 700, 800, 900];

/** `variants` de la API → pesos numéricos sin repetir, en orden. */
export function pesosDe(f: FamiliaApi): number[] {
  const eje = f.axes?.find((a) => a.tag === "wght");
  if (eje) return PASOS_PESO.filter((p) => p >= eje.start && p <= eje.end);
  const pesos = f.variants.map((v) => (v === "regular" || v === "italic" ? 400 : Number.parseInt(v, 10))).filter((n) => Number.isFinite(n));
  return [...new Set(pesos)].sort((a, b) => a - b);
}

export function esOtroAlfabeto(f: FamiliaApi): boolean {
  if (/^Noto /.test(f.family)) return !NOTO_LATINAS.has(f.family);
  if (OTRO_ALFABETO.test(f.family)) return true;
  if (EXCEPCIONES_ALFABETO.has(f.family)) return false;
  return f.subsets.some((s) => !SUBSETS_COMPATIBLES.has(s));
}

export function esIcono(f: FamiliaApi): boolean {
  return ICONOS.test(f.family) || f.subsets.includes("emoji") && !f.subsets.includes("latin");
}

/** Los títulos admiten todo; el cuerpo pide legibilidad: sans, serif y monoespaciadas con el peso 400 y sin ser pura ornamentación. */
export function usoSugeridoDe(categoria: CategoriaFuente, pesos: number[]): UsoSugerido {
  if (categoria === "display" || categoria === "handwriting") return "titulos";
  return pesos.includes(400) ? "ambos" : "titulos";
}

export interface ResultadoSeleccion {
  fuentes: EntradaFuente[];
  /** Cuántas familias pasaron los filtros antes de repartir por categoría. */
  candidatas: number;
  descartadas: Record<"sinLatin" | "otroAlfabeto" | "iconos" | "pocosPesos" | "duplicadas" | "categoriaDesconocida", number>;
}

/**
 * Elige las 200 mejores para español: subset latin, al menos 3 pesos o eje `wght`, sin íconos, sin otros alfabetos
 * y sin variantes que dupliquen una familia. Reparte por categoría (80 sans, 55 serif, 35 display, 15 handwriting,
 * 15 monospace) en orden de popularidad; si una categoría no llega a su cupo, lo que falta lo completan las más
 * populares que quedaron fuera (sans y serif primero) para llegar siempre a 200. `items` viene ordenado por popularidad.
 */
export function seleccionarFuentes(items: FamiliaApi[]): ResultadoSeleccion {
  const descartadas: ResultadoSeleccion["descartadas"] = { sinLatin: 0, otroAlfabeto: 0, iconos: 0, pocosPesos: 0, duplicadas: 0, categoriaDesconocida: 0 };
  const nombres = new Set(items.map((f) => f.family));
  const candidatas: EntradaFuente[] = [];
  const gruposVistos = new Set<string>();

  items.forEach((f, i) => {
    if (!f.subsets.includes("latin")) return void descartadas.sinLatin++;
    if (esIcono(f)) return void descartadas.iconos++;
    if (esOtroAlfabeto(f)) return void descartadas.otroAlfabeto++;
    const base = f.family.replace(SUFIJO_DUPLICADO, "");
    if (base !== f.family && nombres.has(base)) return void descartadas.duplicadas++;
    const grupo = GRUPOS_DE_VARIANTES.exec(f.family)?.[1];
    if (grupo) {
      if (gruposVistos.has(grupo)) return void descartadas.duplicadas++;
      gruposVistos.add(grupo);
    }
    const categoria = CATEGORIAS.find((c) => c === f.category);
    if (!categoria) return void descartadas.categoriaDesconocida++;
    const pesos = pesosDe(f);
    const variable = f.axes?.some((a) => a.tag === "wght") ?? false;
    if (!variable && pesos.length < MIN_PESOS) return void descartadas.pocosPesos++;
    candidatas.push({
      familia: f.family,
      categoria,
      pesos,
      variable,
      cursiva: f.variants.some((v) => v === "italic" || v.endsWith("italic")),
      popularidad: i + 1,
      usoSugerido: usoSugeridoDe(categoria, pesos),
      latinExt: f.subsets.includes("latin-ext"),
    });
  });

  const elegidas = new Set<EntradaFuente>();
  for (const c of CATEGORIAS) for (const e of candidatas.filter((x) => x.categoria === c).slice(0, CUPO_POR_CATEGORIA[c])) elegidas.add(e);
  // Categorías que no llegan a su cupo: las completa lo más popular que quedó fuera, sans y serif primero.
  for (const c of ["sans-serif", "serif", "display", "handwriting", "monospace"] as const) {
    for (const e of candidatas.filter((x) => x.categoria === c)) {
      if (elegidas.size >= TOTAL_CATALOGO) break;
      elegidas.add(e);
    }
  }
  const fuentes = [...elegidas]
    .slice(0, TOTAL_CATALOGO)
    .sort((a, b) => CATEGORIAS.indexOf(a.categoria) - CATEGORIAS.indexOf(b.categoria) || a.popularidad - b.popularidad);
  return { fuentes, candidatas: candidatas.length, descartadas };
}
