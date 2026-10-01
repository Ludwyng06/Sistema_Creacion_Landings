import type { CSSProperties } from "react";
import type { Semilla, Tokens } from "@/lib/contratos";
import { semillaManual } from "@/lib/tecnicas";
import { tokensAVariables } from "@/componentes/tokens-css";

// Capítulo 5 · La semilla: tres semillas reales de la biblioteca (`@/lib/tecnicas`, solo lectura) y la mezcla de sus tokens.

export interface SemillaHome {
  semilla: Semilla;
  tokens: Tokens;
  /** Nombre de la paleta, tal como está en la biblioteca. */
  etiqueta: string;
}

const ELEGIDAS = [
  { estilo: "Bauhaus funcional", industria: "cuadernos de campo", paletaId: "bauhaus-01", tipografiaId: "space-grotesk-plex", numero: 1 },
  { estilo: "brutalismo tipográfico", industria: "laboratorio", paletaId: "brutalista-01", tipografiaId: "bricolage-inter", numero: 2 },
  { estilo: "editorial de revista de los 70", industria: "tipografía de periódico", paletaId: "editorial-70", tipografiaId: "fraunces-inter-tight", numero: 3 },
] as const;

/** Bauhaus, brutalismo y editorial de los 70, con sus tokens completos (intensidad 3). */
export function semillasDelHome(): SemillaHome[] {
  return ELEGIDAS.map((e) => {
    const { semilla, tokens } = semillaManual({ ...e, intensidad: 3 as const });
    return { semilla, tokens, etiqueta: `${e.estilo} × ${e.industria}` };
  });
}

// ── Mezcla de tokens ───────────────────────────────────────────────────────

const limitar = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));

function aRgb(color: string): [number, number, number] {
  const limpio = color.replace(/^#/, "");
  const n = Number.parseInt(limpio.length === 3 ? [...limpio].map((c) => c + c).join("") : limpio, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Color intermedio entre `a` y `b` (0 → `a`, 1 → `b`), en formato `#rrggbb`. */
export function mezclarColor(a: string, b: string, t: number): string {
  const k = limitar(t);
  const [ra, ga, ba] = aRgb(a);
  const [rb, gb, bb] = aRgb(b);
  const canal = (x: number, y: number) => Math.round(x + (y - x) * k).toString(16).padStart(2, "0");
  return `#${canal(ra, rb)}${canal(ga, gb)}${canal(ba, bb)}`;
}

/**
 * Tokens intermedios: los colores y el radio se mezclan de forma continua; lo que no se puede mezclar (familias
 * tipográficas, escala, espaciado, borde, imagen) cambia de golpe a mitad del camino.
 */
export function mezclarTokens(a: Tokens, b: Tokens, t: number): Tokens {
  const k = limitar(t);
  const resto = k < 0.5 ? a : b;
  const colores = Object.fromEntries(
    (Object.keys(a.colores) as (keyof Tokens["colores"])[]).map((clave) => [clave, mezclarColor(a.colores[clave], b.colores[clave], k)]),
  ) as Tokens["colores"];
  return { ...resto, colores, radio: Math.round(a.radio + (b.radio - a.radio) * k) as Tokens["radio"] };
}

/** Tramos del capítulo: cada semilla se sostiene un rato y luego se mezcla con la siguiente. */
const TRAMOS = [0.2, 0.4, 0.6, 0.8] as const;

export interface EstadoMorph {
  tokens: Tokens;
  /** Semilla dominante (la más cercana). */
  indice: number;
  /** Mezcla dentro del tramo actual, 0–1 (0 mientras se sostiene una semilla). */
  mezcla: number;
}

/** Tokens de la landing según el progreso 0–1 del capítulo. */
export function morphEn(progreso: number, semillas: readonly SemillaHome[]): EstadoMorph {
  const p = limitar(progreso);
  const [s0, s1, s2] = semillas;
  if (p <= TRAMOS[0]) return { tokens: s0.tokens, indice: 0, mezcla: 0 };
  if (p < TRAMOS[1]) {
    const t = (p - TRAMOS[0]) / (TRAMOS[1] - TRAMOS[0]);
    return { tokens: mezclarTokens(s0.tokens, s1.tokens, t), indice: t < 0.5 ? 0 : 1, mezcla: t };
  }
  if (p <= TRAMOS[2]) return { tokens: s1.tokens, indice: 1, mezcla: 0 };
  if (p < TRAMOS[3]) {
    const t = (p - TRAMOS[2]) / (TRAMOS[3] - TRAMOS[2]);
    return { tokens: mezclarTokens(s1.tokens, s2.tokens, t), indice: t < 0.5 ? 1 : 2, mezcla: t };
  }
  return { tokens: s2.tokens, indice: 2, mezcla: 0 };
}

/**
 * Opacidad de cada capa cuando las tres semillas se apilan (la primera siempre visible, la segunda y la tercera
 * aparecen encima en su tramo). Mezclar capas en vez de cambiar tipografías y espaciados evita los saltos de diseño.
 */
export function opacidadesDeCapas(progreso: number): [number, number, number] {
  const p = limitar(progreso);
  const tramo = (desde: number, hasta: number) => limitar((p - desde) / (hasta - desde));
  return [1, tramo(TRAMOS[0], TRAMOS[1]), tramo(TRAMOS[2], TRAMOS[3])];
}

/** Pone las variables CSS de unos tokens en un elemento, sin pasar por React. */
export function aplicarTokens(el: HTMLElement, tokens: Tokens): void {
  for (const [nombre, valor] of Object.entries(tokensAVariables(tokens) as CSSProperties & Record<string, string>)) {
    el.style.setProperty(nombre, String(valor));
  }
}
