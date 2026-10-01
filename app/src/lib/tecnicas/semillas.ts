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

export interface Paleta {
  id: string;
  nombre: string;
  colores: Colores;
}

const paleta = (
  id: string,
  nombre: string,
  [fondo, superficie, texto, textoSuave, acento, acentoTexto, borde]: string[],
): Paleta => ({
  id,
  nombre,
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
  paleta("farmacia-suiza", "Blanco clínico y verde botica", ["F2F8F4", "FFFFFF", "10261D", "4C6357", "0E7A5A", "FFFFFF", "CFE0D6"]),
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

// ---------- Tokens ----------

type Intensidad = Tokens["intensidad"];

function construirTokens(semilla: Semilla, intensidad: Intensidad): Tokens {
  const p = PALETAS.find((x) => x.id === semilla.paletaId);
  const t = TIPOGRAFIAS.find((x) => x.id === semilla.tipografiaId);
  if (!p) throw new Error(`Paleta desconocida: ${semilla.paletaId}`);
  if (!t) throw new Error(`Tipografía desconocida: ${semilla.tipografiaId}`);
  const azar = mulberry32(semilla.numero + 1); // flujo aparte del que elige estilo, paleta y tipografía
  return {
    colores: { ...p.colores },
    tipografia: { titulos: t.titulos, cuerpo: t.cuerpo, escala: elegir(azar, ESCALAS) },
    radio: elegir(azar, RADIOS),
    espaciado: elegir(azar, ESPACIADOS),
    borde: elegir(azar, BORDES),
    imagen: elegir(azar, IMAGENES),
    intensidad,
  };
}

export interface ResultadoSemilla {
  semilla: Semilla;
  tokens: Tokens;
}

/** Tirada reproducible: el mismo número da la misma semilla y los mismos tokens. */
export function tirarSemilla(numero?: number, intensidad: Intensidad = 3): ResultadoSemilla {
  const n = numero ?? Math.floor(Math.random() * 1_000_000);
  const azar = mulberry32(n);
  const semilla: Semilla = {
    estilo: elegir(azar, ESTILOS),
    industria: elegir(azar, INDUSTRIAS),
    paletaId: elegir(azar, PALETAS).id,
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
export function tokensParaBrief(semilla: Semilla, brief: Pick<Brief, "intensidad" | "coloresMarca">): Tokens {
  return aplicarColoresMarca(construirTokens(semilla, brief.intensidad), brief.coloresMarca ?? []);
}
