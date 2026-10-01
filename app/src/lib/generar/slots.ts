// Qué slots reciben foto (24-A entrega 2): los de ícono o SVG (`garantia.svg`, `icono-envio`, `sello-…`) se resuelven con los íconos del
// sistema y nunca entran a la búsqueda de imágenes ni a la generación.

const ES_ICONO = /\.(svg|ico)$|(^|[-_.])(icono|iconos|icon|icons|svg|sello|sellos)([-_.\d]|$)/i;

export const esSlotDeIcono = (slot: string): boolean => ES_ICONO.test(slot);

/** Cuenta las palabras de un texto (separadas por espacios). */
export const contarPalabras = (t: string): number => t.trim().split(/\s+/).filter(Boolean).length;

const RELLENO = /\b(el|la|los|las|un|una|de|del|en|con|y|a|al|por|para|sobre)\s*$/i;

/**
 * Deja un texto alternativo en 8 a 16 palabras: lo recorta en una palabra completa (sin terminar en artículo) y, si queda corto,
 * devuelve `null` para que quien llama use su respaldo.
 */
export function ajustarAlt(texto: string, min = 8, max = 16): string | null {
  const limpio = texto.replace(/\s+/g, " ").replace(/^[\s"'«»]+|[\s"'«»]+$/g, "").trim();
  if (!limpio) return null;
  let palabras = limpio.split(" ");
  if (palabras.length > max) {
    palabras = palabras.slice(0, max);
    while (palabras.length > min && RELLENO.test(palabras.join(" "))) palabras.pop();
  }
  const alt = palabras.join(" ").replace(/[,;:.]+$/, "");
  return contarPalabras(alt) >= min ? `${alt.charAt(0).toUpperCase()}${alt.slice(1)}` : null;
}

const sinCaja = (t: string) => t.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

/** Alt de una foto de banco a partir del título y la descripción de la fuente (8 a 16 palabras). */
export function altDeFuente(titulo: string, descripcion = ""): string {
  const t = sinCaja(titulo).replace(/\.[a-z]{3,4}$/i, "").replace(/^File:/i, "");
  const d = sinCaja(descripcion);
  const prim = ajustarAlt(t);
  if (prim) return prim;
  const union = ajustarAlt(`${t}. ${d.split(/(?<=[.!?])\s/)[0] ?? ""}`) ?? ajustarAlt(`${t} ${d}`);
  if (union) return union;
  const relleno = `${t || "Fotografía"} en una imagen de banco libre, sin texto ni logos visibles`;
  return ajustarAlt(relleno) ?? relleno;
}
