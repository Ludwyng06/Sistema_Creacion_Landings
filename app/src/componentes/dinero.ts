export const MONEDAS = ["COP", "USD", "MXN", "EUR"] as const;
export type Moneda = (typeof MONEDAS)[number];

/** Marca que deja la IA cuando falta un dato del brief (regla 6). */
export const COMPLETAR = "[COMPLETAR]";

const LOCALE: Record<Moneda, string> = {
  COP: "es-CO",
  USD: "es-US",
  MXN: "es-MX",
  EUR: "es-ES",
};

export function formatearDinero(valor: number, moneda: Moneda): string {
  return new Intl.NumberFormat(LOCALE[moneda], {
    style: "currency",
    currency: moneda,
    minimumFractionDigits: 0,
    maximumFractionDigits: moneda === "COP" ? 0 : 2,
  }).format(valor);
}

/**
 * Texto de ahorro calculado a partir del precio anterior. Devuelve `null` si no hay
 * precio anterior, si falta algún dato o si el precio actual no es menor.
 */
export function calcularAhorro(
  precio: number | typeof COMPLETAR,
  precioAnterior: number | typeof COMPLETAR | undefined,
  moneda: Moneda,
): string | null {
  if (typeof precio !== "number" || typeof precioAnterior !== "number") return null;
  if (!(precioAnterior > precio) || precioAnterior <= 0) return null;
  const diferencia = precioAnterior - precio;
  const porcentaje = Math.round((diferencia / precioAnterior) * 100);
  return `Ahorras ${formatearDinero(diferencia, moneda)} (${porcentaje} % menos)`;
}
