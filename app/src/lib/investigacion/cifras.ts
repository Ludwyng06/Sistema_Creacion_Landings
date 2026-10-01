// Regla de fidelidad (CLAUDE.md, regla 6): de internet no se toma ninguna cifra. Precios, calificaciones,
// porcentajes, cantidades y fechas se reemplazan por [COMPLETAR] y la sugerencia se marca con `tieneCifra`.

export const COMPLETAR = "[COMPLETAR]";

const NUMERO = String.raw`\d(?:[\d.,]*\d)?`;
/** Un número con su moneda o unidad pegada («$99.000», «4,8 estrellas» deja «estrellas»), y rangos («4,8 de 5», «30 a 40»). */
const CIFRA = new RegExp(
  String.raw`(?:US\$|\$|€|USD|COP|MXN|EUR)?\s?${NUMERO}(?:\s?(?:\/|-|–|a|de)\s?${NUMERO})*(?:\s?(?:%|por ciento|COP|USD|MXN|EUR|pesos|dólares|dolares|euros|mil|millones|k)\b)?`,
  "giu",
);

const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Cifras que pertenecen al nombre del producto («9 en 1», «3D»): esas no cuentan como dato. */
function digitosDelNombre(nombre: string): Set<string> {
  return new Set(nombre.match(/\d+/g) ?? []);
}

/** `true` si el texto trae una cifra que no forma parte del nombre del producto. */
export function tieneCifra(texto: string, nombre = ""): boolean {
  if (texto.includes(COMPLETAR)) return true;
  const propios = digitosDelNombre(nombre);
  return (texto.match(/\d+/g) ?? []).some((d) => !propios.has(d));
}

/** Reemplaza cada cifra por [COMPLETAR] (salvo las del nombre del producto). */
export function quitarCifras(texto: string, nombre = ""): string {
  const propios = digitosDelNombre(nombre);
  const reemplazado = texto.replace(CIFRA, (m) => {
    const digitos = m.match(/\d+/g) ?? [];
    return digitos.length > 0 && digitos.every((d) => propios.has(d)) ? m : ` ${COMPLETAR} `;
  });
  return reemplazado.replace(/\s{2,}/g, " ").replace(/\s+([.,;:!?)])/g, "$1").replace(/([(¿¡])\s+/g, "$1").replace(/(\[COMPLETAR\])\s?(?:\[COMPLETAR\]\s?)+/g, "$1 ").trim();
}

/** Nombre normalizado para la caché y las comparaciones: sin tildes, minúsculas y espacios simples. */
export const normalizarNombre = (nombre: string): string => sinTildes(nombre).replace(/\s+/g, " ").trim();
