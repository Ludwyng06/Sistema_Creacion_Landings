import type { Brief, Semilla, Tokens } from "@/lib/contratos";

// Técnica 1 · Semilla (docs/04 §1): biblioteca, tirada reproducible y colores de marca.

export const ESTILOS = [
  "Bauhaus funcional",
  "Swiss International",
  "editorial de revista de los 70",
  "brutalismo tipográfico",
  "Art Déco geométrico",
  "catálogo técnico de patentes de los 50",
  "Memphis contenido",
  "japonés ma (espacio negativo)",
  "constructivismo ruso",
  "cartel suizo de farmacia",
  "manual de instrucciones industrial",
  "minimalismo de museo",
] as const;

export const INDUSTRIAS = [
  "relojería",
  "cartografía",
  "laboratorio",
  "aviación",
  "tipografía de periódico",
  "empaques de farmacia",
  "cuadernos de campo",
  "señalética de metro",
  "fichas de museo",
  "etiquetado de vino",
] as const;

type Colores = Tokens["colores"];

export type TonoPaleta = "claro" | "oscuro";

export interface Paleta {
  id: string;
  nombre: string;
  colores: Colores;
  tono: TonoPaleta;
  /** Temáticas afines (`espacio`, `belleza`, `alimentos`, `tecnologia`…); opcionales. */
  etiquetas?: readonly string[];
}

/** Tono según la luminancia del fondo. */
const tonoDe = (fondo: string): TonoPaleta => (luminancia(`#${fondo}`) < 0.2 ? "oscuro" : "claro");

const paleta = (
  id: string,
  nombre: string,
  [fondo, superficie, texto, textoSuave, acento, acentoTexto, borde]: string[],
  etiquetas?: readonly string[],
): Paleta => ({
  id,
  nombre,
  tono: tonoDe(fondo),
  ...(etiquetas ? { etiquetas } : {}),
  colores: {
    fondo: `#${fondo}`,
    superficie: `#${superficie}`,
    texto: `#${texto}`,
    textoSuave: `#${textoSuave}`,
    acento: `#${acento}`,
    acentoTexto: `#${acentoTexto}`,
    borde: `#${borde}`,
  },
});

// Orden de los 7 valores: fondo, superficie, texto, textoSuave, acento, acentoTexto, borde.
export const PALETAS: readonly Paleta[] = [
  paleta("bauhaus-01", "Crema y rojo Bauhaus", ["F4EFE6", "FFFFFF", "1B1B1B", "5A5A5A", "D9381E", "FFFFFF", "D8D0C0"]),
  paleta("swiss-01", "Blanco roto y rojo suizo", ["F7F7F5", "FFFFFF", "111111", "555555", "D40F0F", "FFFFFF", "DDDDDD"]),
  paleta("editorial-70", "Papel de revista y ladrillo", ["FBF3E4", "FFFDF7", "2A1A12", "6B5646", "B4471F", "FFFFFF", "E3D3B8"]),
  paleta("brutalista-01", "Gris concreto y amarillo", ["EDEDED", "FFFFFF", "000000", "4A4A4A", "FFE500", "000000", "000000"]),
  paleta("deco-01", "Verde noche y latón", ["0F2A2B", "163B3D", "F5EBD3", "B8C4BC", "D4A94F", "0F2A2B", "2C5457"]),
  paleta("patentes-50", "Azul plano técnico", ["E9EEF1", "FFFFFF", "14212B", "4D5F6D", "1F5FA8", "FFFFFF", "C5D0D8"]),
  paleta("memphis-01", "Crema y magenta contenido", ["FFF6EA", "FFFFFF", "1E1B3A", "5B5878", "C42B63", "FFFFFF", "EBD9C3"]),
  paleta("ma-japones", "Lino y verde musgo", ["F5F3EE", "FFFFFF", "22221F", "63625C", "3E5C4A", "FFFFFF", "DCD8CE"]),
  paleta("constructivismo", "Carbón y rojo agitprop", ["1A1A1A", "262626", "F2EDE4", "B5AEA2", "F0503F", "111111", "3D3D3D"]),
  paleta("farmacia-suiza", "Blanco clínico y verde botica", ["F2F8F4", "FFFFFF", "10261D", "4C6357", "0E7A5A", "FFFFFF", "CFE0D6"], ["belleza"]),
  // Oscuras, aptas para el espacio.
  paleta("noche-ambar", "Noche y ámbar", ["0B1020", "141B33", "F3EFE6", "AEB6CC", "FFB454", "0B1020", "27304F"], ["espacio", "tecnologia"]),
  paleta("nebulosa-violeta", "Nebulosa violeta", ["140B26", "1E1338", "F1EAFB", "B9A9D6", "B388FF", "140B26", "33224F"], ["espacio", "belleza"]),
  paleta("aurora-verde", "Aurora verde", ["06201A", "0C2D25", "E6F7EF", "A3C9B9", "3DDC97", "06201A", "164236"], ["espacio", "alimentos"]),
  paleta("azul-cian", "Azul profundo y cian", ["04162B", "0A2240", "E8F4FB", "9DB9CF", "22D3EE", "04162B", "143757"], ["espacio", "tecnologia"]),
  paleta("carbon-coral", "Carbón y coral", ["1C1C1F", "26262A", "F5F1EC", "B8B3AD", "FF6F61", "1C1C1F", "3A3A40"], ["espacio", "belleza"]),
  paleta("rojo-marte", "Rojo Marte", ["1E0F0C", "2B1713", "F7EAE3", "C9ADA2", "FF7A45", "1E0F0C", "442620"], ["espacio", "alimentos"]),
  paleta("luna-plata", "Luna y plata", ["101214", "191C1F", "EEF1F3", "A9B1B7", "C7D2DA", "101214", "2A2F33"], ["espacio", "tecnologia"]),
  paleta("galaxia-rosa", "Galaxia rosa", ["1B0A1F", "291230", "FBEAF6", "C9A6C4", "FF5CAA", "1B0A1F", "43204A"], ["espacio", "belleza"]),
  paleta("pino-miel", "Pino y miel", ["10231C", "183228", "F2EBD8", "B7C4B4", "E3B341", "10231C", "28463A"], ["alimentos", "espacio"]),
  paleta("violeta-electrico", "Violeta eléctrico", ["0D0B1F", "17142E", "ECEBFF", "A9A6D4", "7C83FF", "0D0B1F", "2A2650"], ["espacio", "tecnologia"]),
  paleta("grafito-lima", "Grafito y lima", ["121412", "1B1E1B", "EFF3EA", "ABB3A5", "B8F04A", "121412", "2C312B"], ["tecnologia", "espacio"]),
  paleta("vino-oro", "Vino y oro", ["220C14", "2F1420", "F8EDE4", "CDB0B0", "E2B76B", "220C14", "4A2432"], ["belleza", "alimentos"]),
  paleta("tinta-turquesa", "Tinta y turquesa", ["071E24", "0D2D35", "E4F5F4", "9FC3C4", "2DD4BF", "071E24", "17434C"], ["espacio", "tecnologia"]),
  // Claras con temática.
  paleta("rosa-peonia", "Rosa peonía", ["FDF1F1", "FFFFFF", "2B1519", "6E4A50", "B8325A", "FFFFFF", "EBD0D3"], ["belleza"]),
  paleta("melocoton", "Melocotón", ["FFF3EA", "FFFFFF", "2E1A10", "6F5242", "C2552B", "FFFFFF", "EFD7C5"], ["belleza", "alimentos"]),
  paleta("lavanda-spa", "Lavanda spa", ["F5F1FA", "FFFFFF", "221A33", "5F5575", "6B46C1", "FFFFFF", "DDD3EB"], ["belleza"]),
  paleta("salvia", "Salvia", ["EFF3EC", "FFFFFF", "1B261C", "55645A", "4F7A4C", "FFFFFF", "D2DCCD"], ["belleza", "alimentos"]),
  paleta("limon", "Limón", ["FFFBE6", "FFFFFF", "2A2508", "645D35", "F2C200", "1A1600", "EBE3B5"], ["alimentos"]),
  paleta("tomate-albahaca", "Tomate", ["FFF5EE", "FFFFFF", "2B1410", "6B4A42", "C8321E", "FFFFFF", "F0D8CC"], ["alimentos"]),
  paleta("cafe-crema", "Café con crema", ["F3EBE0", "FFFAF2", "2A1D14", "6A5848", "7A4A2A", "FFFFFF", "DCCDB8"], ["alimentos"]),
  paleta("cielo-tecnologia", "Cielo y azul eléctrico", ["EEF4FB", "FFFFFF", "0F1B2D", "4A5B72", "1D4ED8", "FFFFFF", "CFDAEA"], ["tecnologia"]),
  paleta("menta-tech", "Menta técnica", ["ECF8F5", "FFFFFF", "0C2420", "4B6B65", "0F766E", "FFFFFF", "C6E4DE"], ["tecnologia"]),
  paleta("arena-terracota", "Arena y terracota", ["F6EDE3", "FFFFFF", "2B1F17", "6C5A4C", "A8431F", "FFFFFF", "E2D2BF"], ["alimentos"]),
  paleta("gris-naranja", "Gris humo y naranja", ["F1F3F5", "FFFFFF", "14181C", "515A63", "C2410C", "FFFFFF", "D5DADF"], ["tecnologia"]),
  paleta("oliva-aceite", "Oliva y aceite", ["F5F3E4", "FFFFFF", "20230F", "5E6240", "5C6B14", "FFFFFF", "DEDDC0"], ["alimentos"]),
  paleta("marino-hueso", "Marino sobre hueso", ["FAF7F0", "FFFFFF", "10203A", "51607A", "1E3A8A", "FFFFFF", "E0DAC8"], ["tecnologia"]),
  paleta("uva-beige", "Uva y beige", ["FAF3EE", "FFFFFF", "2A1522", "6E5163", "9D174D", "FFFFFF", "E8D6CC"], ["belleza"]),
];

export interface ParTipografico {
  id: string;
  titulos: string;
  cuerpo: string;
}

export const TIPOGRAFIAS: readonly ParTipografico[] = [
  { id: "fraunces-inter-tight", titulos: "Fraunces", cuerpo: "Inter Tight" },
  { id: "space-grotesk-plex", titulos: "Space Grotesk", cuerpo: "IBM Plex Sans" },
  { id: "dm-serif-dm-sans", titulos: "DM Serif Display", cuerpo: "DM Sans" },
  { id: "syne-manrope", titulos: "Syne", cuerpo: "Manrope" },
  { id: "instrument-serif-geist", titulos: "Instrument Serif", cuerpo: "Geist" },
  { id: "bricolage-inter", titulos: "Bricolage Grotesque", cuerpo: "Inter" },
];

const RADIOS = [0, 4, 8, 16, 999] as const;
const ESCALAS = ["compacta", "normal", "amplia"] as const;
const ESPACIADOS = ["denso", "normal", "aireado"] as const;
const BORDES = ["ninguno", "fino", "grueso"] as const;
const IMAGENES = ["natural", "duotono", "recorte", "marco"] as const;

type Radio = Tokens["radio"];
type Escala = Tokens["tipografia"]["escala"];
type Espaciado = Tokens["espaciado"];
type Borde = Tokens["borde"];
type ModoImagen = Tokens["imagen"];

/** Lo que el estilo de la semilla permite en cada token: la tirada elige dentro de estas listas y no de constantes sueltas. */
interface PerfilEstilo {
  radios: readonly Radio[];
  escalas: readonly Escala[];
  espaciados: readonly Espaciado[];
  bordes: readonly Borde[];
  imagenes: readonly ModoImagen[];
}

const PERFIL_LIBRE: PerfilEstilo = { radios: RADIOS, escalas: ESCALAS, espaciados: ESPACIADOS, bordes: BORDES, imagenes: IMAGENES };

export const PERFILES_ESTILO: Record<(typeof ESTILOS)[number], PerfilEstilo> = {
  "Bauhaus funcional": { radios: [0, 4], escalas: ["normal", "amplia"], espaciados: ["normal", "denso"], bordes: ["fino", "grueso"], imagenes: ["recorte", "natural"] },
  "Swiss International": { radios: [0, 4], escalas: ["normal", "compacta"], espaciados: ["normal", "aireado"], bordes: ["ninguno", "fino"], imagenes: ["natural", "recorte"] },
  "editorial de revista de los 70": { radios: [0, 4, 8], escalas: ["amplia", "normal"], espaciados: ["normal", "aireado"], bordes: ["fino", "ninguno"], imagenes: ["natural", "marco", "duotono"] },
  "brutalismo tipográfico": { radios: [0], escalas: ["amplia", "compacta"], espaciados: ["denso", "normal"], bordes: ["grueso"], imagenes: ["natural", "recorte"] },
  "Art Déco geométrico": { radios: [0, 8], escalas: ["normal", "amplia"], espaciados: ["normal", "aireado"], bordes: ["fino", "grueso"], imagenes: ["marco", "duotono"] },
  "catálogo técnico de patentes de los 50": { radios: [0, 4], escalas: ["compacta", "normal"], espaciados: ["denso", "normal"], bordes: ["fino"], imagenes: ["natural", "marco"] },
  "Memphis contenido": { radios: [999, 16], escalas: ["normal", "amplia"], espaciados: ["normal", "aireado"], bordes: ["grueso", "fino"], imagenes: ["duotono", "recorte"] },
  "japonés ma (espacio negativo)": { radios: [0, 4, 8], escalas: ["normal", "amplia"], espaciados: ["aireado"], bordes: ["ninguno"], imagenes: ["natural", "marco"] },
  "constructivismo ruso": { radios: [0], escalas: ["amplia", "normal"], espaciados: ["denso", "normal"], bordes: ["grueso", "fino"], imagenes: ["duotono", "recorte"] },
  "cartel suizo de farmacia": { radios: [4, 8, 16], escalas: ["normal", "compacta"], espaciados: ["normal", "denso"], bordes: ["fino", "ninguno"], imagenes: ["natural", "recorte"] },
  "manual de instrucciones industrial": { radios: [0, 4], escalas: ["compacta", "normal"], espaciados: ["denso", "normal"], bordes: ["fino", "grueso"], imagenes: ["natural", "marco"] },
  "minimalismo de museo": { radios: [0, 4, 8], escalas: ["normal", "amplia"], espaciados: ["aireado", "normal"], bordes: ["ninguno", "fino"], imagenes: ["natural", "marco"] },
};

const perfilDe = (estilo: string): PerfilEstilo => (PERFILES_ESTILO as Record<string, PerfilEstilo>)[estilo] ?? PERFIL_LIBRE;

// ---------- Contraste WCAG ----------

export function normalizarHex(hex: string): string {
  const h = hex.trim().replace(/^#/, "");
  const largo = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  return `#${largo.toUpperCase()}`;
}

function canales(hex: string): [number, number, number] {
  const h = normalizarHex(hex).slice(1);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function aHex([r, g, b]: number[]): string {
  return `#${[r, g, b]
    .map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

function luminancia(hex: string): number {
  const [r, g, b] = canales(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razón de contraste WCAG entre dos colores hex (de 1 a 21). */
export function contraste(a: string, b: string): number {
  const la = luminancia(a);
  const lb = luminancia(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Mezcla `a` hacia `b` en la proporción `t` (0 = a, 1 = b). */
function mezclar(a: string, b: string, t: number): string {
  const ca = canales(a);
  const cb = canales(b);
  return aHex(ca.map((v, i) => v + (cb[i] - v) * t));
}

function mejorBlancoNegro(fondo: string): string {
  return contraste("#FFFFFF", fondo) >= contraste("#000000", fondo) ? "#FFFFFF" : "#000000";
}

export const CONTRASTE_TEXTO = 4.5;
export const CONTRASTE_SUAVE = 3;

// ---------- PRNG reproducible ----------

/** mulberry32: el mismo número da siempre la misma secuencia. */
export function mulberry32(numero: number): () => number {
  let a = numero | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function elegir<T>(azar: () => number, lista: readonly T[]): T {
  return lista[Math.floor(azar() * lista.length)];
}

/** Peso de una paleta para una temática: las afines y, en `espacio`, las oscuras pesan 3; las demás 1 (ponderado, no excluyente). */
export function pesoPaleta(p: Paleta, tematica?: string): number {
  if (!tematica) return 1;
  return p.etiquetas?.includes(tematica) || (tematica === "espacio" && p.tono === "oscuro") ? 3 : 1;
}

/** Elige una paleta gastando un solo número del flujo de azar, ponderando por temática. */
export function elegirPaleta(azar: () => number, tematica?: string): Paleta {
  const pesos = PALETAS.map((p) => pesoPaleta(p, tematica));
  let punto = azar() * pesos.reduce((a, b) => a + b, 0);
  for (let i = 0; i < PALETAS.length; i++) {
    punto -= pesos[i];
    if (punto < 0) return PALETAS[i];
  }
  return PALETAS[PALETAS.length - 1];
}

// ---------- Tokens ----------

type Intensidad = Tokens["intensidad"];

function construirTokens(semilla: Semilla, intensidad: Intensidad): Tokens {
  const p = PALETAS.find((x) => x.id === semilla.paletaId);
  const t = TIPOGRAFIAS.find((x) => x.id === semilla.tipografiaId);
  if (!p) throw new Error(`Paleta desconocida: ${semilla.paletaId}`);
  if (!t) throw new Error(`Tipografía desconocida: ${semilla.tipografiaId}`);
  const azar = mulberry32(semilla.numero + 1); // flujo aparte del que elige estilo, paleta y tipografía
  const perfil = perfilDe(semilla.estilo);
  return {
    colores: { ...p.colores },
    tipografia: { titulos: t.titulos, cuerpo: t.cuerpo, escala: elegir(azar, perfil.escalas) },
    radio: elegir(azar, perfil.radios),
    espaciado: elegir(azar, perfil.espaciados),
    borde: elegir(azar, perfil.bordes),
    imagen: elegir(azar, perfil.imagenes),
    intensidad,
  };
}

export interface ResultadoSemilla {
  semilla: Semilla;
  tokens: Tokens;
}

/** Tirada reproducible: el mismo número da la misma semilla y los mismos tokens. */
export function tirarSemilla(numero?: number, intensidad: Intensidad = 3, azarNumero: () => number = Math.random, tematica?: string): ResultadoSemilla {
  const n = numero ?? Math.floor(azarNumero() * 1_000_000);
  const azar = mulberry32(n);
  const semilla: Semilla = {
    estilo: elegir(azar, ESTILOS),
    industria: elegir(azar, INDUSTRIAS),
    paletaId: elegirPaleta(azar, tematica).id,
    tipografiaId: elegir(azar, TIPOGRAFIAS).id,
    numero: n,
  };
  return { semilla, tokens: construirTokens(semilla, intensidad) };
}

export interface OpcionesSemillaManual {
  estilo: string;
  industria: string;
  paletaId: string;
  tipografiaId: string;
  numero?: number;
  intensidad?: Intensidad;
}

/** Igual que `tirarSemilla`, pero con elección explícita. */
export function semillaManual(o: OpcionesSemillaManual): ResultadoSemilla {
  const semilla: Semilla = {
    estilo: o.estilo,
    industria: o.industria,
    paletaId: o.paletaId,
    tipografiaId: o.tipografiaId,
    numero: o.numero ?? 0,
  };
  return { semilla, tokens: construirTokens(semilla, o.intensidad ?? 3) };
}

/**
 * Los colores de marca reemplazan `acento` (el primero) y `fondo` (el segundo, si viene).
 * Con un fondo nuevo se recalculan texto, superficie y borde para no perder legibilidad.
 * Si el contraste AA de `acentoTexto` sobre `acento` se rompe, pasa a blanco o negro.
 */
export function aplicarColoresMarca(tokens: Tokens, hex: string[]): Tokens {
  const colores = { ...tokens.colores };
  if (hex.length >= 1) colores.acento = normalizarHex(hex[0]);
  if (hex.length >= 2) {
    colores.fondo = normalizarHex(hex[1]);
    colores.texto = mejorBlancoNegro(colores.fondo) === "#FFFFFF" ? "#FFFFFF" : "#111111";
    let t = 0.35;
    colores.textoSuave = mezclar(colores.texto, colores.fondo, t);
    while (contraste(colores.textoSuave, colores.fondo) < CONTRASTE_SUAVE && t > 0) {
      t = Math.max(0, t - 0.05);
      colores.textoSuave = mezclar(colores.texto, colores.fondo, t);
    }
    colores.superficie = mezclar(colores.fondo, colores.texto, 0.04);
    colores.borde = mezclar(colores.fondo, colores.texto, 0.16);
  }
  if (contraste(colores.acentoTexto, colores.acento) < CONTRASTE_TEXTO) {
    colores.acentoTexto = mejorBlancoNegro(colores.acento);
  }
  return { ...tokens, colores };
}

/** Tokens finales de una semilla para un brief: intensidad y colores de marca incluidos. */
export function tokensParaBrief(
  semilla: Semilla,
  brief: Pick<Brief, "intensidad" | "coloresMarca">,
  { respetarMarca = true }: { respetarMarca?: boolean } = {},
): Tokens {
  const tokens = construirTokens(semilla, brief.intensidad);
  // Sin marca, `aplicarColoresMarca` con lista vacía solo garantiza el contraste AA de `acentoTexto`.
  return aplicarColoresMarca(tokens, respetarMarca ? (brief.coloresMarca ?? []) : []);
}

// ---------- «Otra semilla» que se nota (tarea 25) ----------

function aLab(hex: string): [number, number, number] {
  const [r, g, b] = canales(hex).map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047);
  const y = f(0.2126 * r + 0.7152 * g + 0.0722 * b);
  const z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

/** Diferencia de color CIE76 (ΔE) entre dos colores hex. */
export function deltaE(a: string, b: string): number {
  const [l1, a1, b1] = aLab(a);
  const [l2, a2, b2] = aLab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

export const DELTA_E_MINIMO = 20;
const CLAVES_ESTILO_VISUAL = ["radio", "espaciado", "borde", "imagen"] as const;

/** Cuántos de radio, espaciado, borde, imagen y escala son distintos entre dos juegos de tokens. */
export function cambiosDeEstilo(a: Tokens, b: Tokens): number {
  return CLAVES_ESTILO_VISUAL.filter((k) => a[k] !== b[k]).length + (a.tipografia.escala !== b.tipografia.escala ? 1 : 0);
}

export interface OpcionesOtraSemilla {
  intensidad: Intensidad;
  /** Con marca, los colores quedan fijos y no se exige cambio de paleta. */
  coloresMarca?: string[];
  azar?: () => number;
}

/**
 * Una semilla que se nota frente a la actual: otra paleta (fondo y acento con ΔE ≥ 20, y el tono claro/oscuro alterna),
 * otro par tipográfico, otro estilo y al menos 3 de 5 entre radio, espaciado, borde, imagen y escala.
 */
export function otraSemillaDistinta(actual: { semilla: Semilla; tokens: Tokens }, o: OpcionesOtraSemilla): ResultadoSemilla {
  const azar = o.azar ?? Math.random;
  const marca = (o.coloresMarca?.length ?? 0) > 0;
  const paletaActual = PALETAS.find((p) => p.id === actual.semilla.paletaId);
  const tonoActual: TonoPaleta = paletaActual?.tono ?? tonoDe(actual.tokens.colores.fondo.replace("#", ""));
  const cumple = (r: ResultadoSemilla, exigente: boolean): boolean => {
    const { semilla, tokens } = r;
    if (semilla.estilo === actual.semilla.estilo || semilla.tipografiaId === actual.semilla.tipografiaId) return false;
    if (cambiosDeEstilo(actual.tokens, tokens) < 3) return false;
    if (marca) return true;
    const p = PALETAS.find((x) => x.id === semilla.paletaId);
    if (!p || semilla.paletaId === actual.semilla.paletaId) return false;
    if (CLAVES_COLOR.some((k) => p.colores[k].toUpperCase() === actual.tokens.colores[k].toUpperCase())) return false;
    if (deltaE(p.colores.fondo, actual.tokens.colores.fondo) < DELTA_E_MINIMO || deltaE(p.colores.acento, actual.tokens.colores.acento) < DELTA_E_MINIMO) return false;
    return !exigente || p.tono !== tonoActual;
  };
  let ultima = tirarSemilla(Math.floor(azar() * 1_000_000), o.intensidad, azar);
  for (let i = 0; i < 400; i++) {
    const intento = tirarSemilla(Math.floor(azar() * 1_000_000), o.intensidad, azar);
    ultima = intento;
    // Primero exige alternar claro/oscuro; si no hay, relaja esa condición.
    if (cumple(intento, i < 300)) return intento;
  }
  return ultima;
}

const CLAVES_COLOR = ["fondo", "superficie", "texto", "textoSuave", "acento", "acentoTexto", "borde"] as const;
