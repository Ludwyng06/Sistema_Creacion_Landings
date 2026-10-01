// Capítulo 7 · El banco: qué tarjetas se muestran (landings reales o, si el banco está vacío, 3 de ejemplo).

export interface TarjetaBanco {
  id: string;
  nombre: string;
  /** Puntaje del crítico de 0 a 10; `null` si aún no tiene. */
  puntaje: number | null;
  /** Nombres de las técnicas usadas. */
  tecnicas: string[];
  /** Prompt que creó la landing (lo que se ve al voltear la tarjeta). */
  prompt: string;
  /** Solo las landings reales tienen página pública. */
  href: string | null;
  esEjemplo: boolean;
}

export const MAX_TARJETAS = 6;
export const MIN_EJEMPLOS = 3;

/** Landings reales del banco (hasta 6) o, si no hay ninguna, 3 tarjetas de ejemplo marcadas como tales. */
export function tarjetasDelBanco(reales: readonly Omit<TarjetaBanco, "esEjemplo">[], ejemplos: readonly Omit<TarjetaBanco, "esEjemplo">[]): TarjetaBanco[] {
  if (reales.length > 0) return reales.slice(0, MAX_TARJETAS).map((t) => ({ ...t, esEjemplo: false }));
  return ejemplos.slice(0, MIN_EJEMPLOS).map((t) => ({ ...t, href: null, esEjemplo: true }));
}
