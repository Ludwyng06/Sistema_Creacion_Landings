import type { Tokens } from "@/lib/contratos";
import { buscarFuente } from "./catalogo";

// `urlFuentes(tokens)`: la URL de `fonts.googleapis.com/css2` con solo las 2 familias de la landing (títulos y cuerpo),
// solo con los pesos que la landing usa (`font-normal`, `font-medium`, `font-semibold` y `font-bold`) y `display=swap`.
// No se usa `next/font` porque las familias son dinámicas.

export const URL_BASE_FUENTES = "https://fonts.googleapis.com/css2";
export const ORIGENES_FUENTES = ["https://fonts.googleapis.com", "https://fonts.gstatic.com"] as const;

/** Pesos que usan los componentes: títulos en normal, semibold y bold; cuerpo además en medium. */
export const PESOS_USADOS = { titulos: [400, 600, 700], cuerpo: [400, 500, 600, 700] } as const;

/** Peso disponible más cercano al pedido (empate: el más grueso). */
function cercano(peso: number, disponibles: number[]): number {
  return disponibles.reduce((mejor, p) => {
    const d = Math.abs(p - peso);
    const dm = Math.abs(mejor - peso);
    return d < dm || (d === dm && p > mejor) ? p : mejor;
  });
}

/** Familias de la biblioteca de semillas que no están en el catálogo (una sola muesca de peso), con los pesos que publican. */
const PESOS_BIBLIOTECA: Record<string, number[]> = { "dm serif display": [400], "instrument serif": [400] };

/**
 * Pesos de la familia: los usados que existen; si no existen, el más cercano de los que tiene. Una familia que no se
 * conoce (ni en el catálogo ni en la biblioteca) devuelve `[]`: se pide sin `wght`, porque Google responde 400 si se pide un peso que no tiene.
 */
export function pesosParaFamilia(nombre: string, usados: readonly number[]): number[] {
  const disponibles = buscarFuente(nombre)?.pesos ?? PESOS_BIBLIOTECA[nombre.trim().toLowerCase()];
  if (!disponibles || disponibles.length === 0) return [];
  return [...new Set(usados.map((p) => cercano(p, disponibles)))].sort((a, b) => a - b);
}

/** `Space Grotesk` → `Space+Grotesk`. */
const param = (nombre: string) => encodeURIComponent(nombre.trim()).replace(/%20/g, "+");

/**
 * URL de Google Fonts con solo las familias de `tokens.tipografia`. Si títulos y cuerpo son la misma familia, va una sola
 * con la unión de pesos. Los pesos se piden ordenados, como exige la API (`wght@400;600;700`).
 */
export function urlFuentes(tokens: Pick<Tokens, "tipografia">): string {
  const { titulos, cuerpo } = tokens.tipografia;
  const familias = new Map<string, { nombre: string; pesos: Set<number> }>();
  const sumar = (nombre: string, usados: readonly number[]) => {
    const limpio = nombre.trim().replace(/"/g, "");
    if (!limpio) return;
    const k = limpio.toLowerCase();
    const f = familias.get(k) ?? { nombre: limpio, pesos: new Set<number>() };
    for (const p of pesosParaFamilia(limpio, usados)) f.pesos.add(p);
    familias.set(k, f);
  };
  sumar(titulos, PESOS_USADOS.titulos);
  sumar(cuerpo, PESOS_USADOS.cuerpo);
  const partes = [...familias.values()].map((f) => (f.pesos.size ? `family=${param(f.nombre)}:wght@${[...f.pesos].sort((a, b) => a - b).join(";")}` : `family=${param(f.nombre)}`));
  return `${URL_BASE_FUENTES}?${partes.join("&")}&display=swap`;
}
