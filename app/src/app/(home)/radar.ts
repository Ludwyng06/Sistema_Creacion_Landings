import { RUBRICA_CRITICO } from "@/lib/tecnicas";

// Capítulo 6 · El crítico: geometría del radar de 8 ejes (SVG propio, sin librería de gráficos).

export interface Eje {
  /** Nombre corto del criterio, tal como sale de la rúbrica del crítico. */
  nombre: string;
  /** Peso del criterio en el puntaje total (suman 100). */
  peso: number;
}

/** Los ejes salen de la rúbrica del código (`RUBRICA_CRITICO`): «Claridad en 3 s (20 %): …» → nombre y peso. */
export function ejesDeRubrica(rubrica: string = RUBRICA_CRITICO): Eje[] {
  return rubrica
    .split("\n")
    .map((linea) => linea.match(/^(.+?)\s*\((\d+(?:[.,]\d+)?)\s*%\)/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => ({ nombre: m[1].trim(), peso: Number(m[2].replace(",", ".")) }));
}

// Puntajes ilustrativos por eje (los mismos ejes de la rúbrica). Ponderados con los pesos reales dan 6,2 y 9,1.
export const PUNTAJES_ANTES = [6, 6, 6, 6.5, 6, 6.5, 6.5, 7] as const;
export const PUNTAJES_DESPUES = [9, 9, 9, 9, 9, 9, 9.5, 10] as const;
export const PUNTAJE_MAXIMO = 10;

/** Puntaje total de 0 a 10: promedio de los ejes ponderado por sus pesos. */
export function puntajePonderado(valores: readonly number[], ejes: readonly Eje[]): number {
  const total = ejes.reduce((suma, e) => suma + e.peso, 0);
  if (total === 0) return 0;
  return ejes.reduce((suma, e, i) => suma + e.peso * (valores[i] ?? 0), 0) / total;
}

export interface Punto {
  x: number;
  y: number;
}

/** Punto del eje `i` de `n` a la distancia que corresponde a `valor` (0 a `maximo`); el eje 0 apunta hacia arriba. */
export function puntoDeEje(i: number, n: number, radio: number, valor = PUNTAJE_MAXIMO, centro: Punto = { x: 0, y: 0 }, maximo = PUNTAJE_MAXIMO): Punto {
  const angulo = -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const r = (radio * Math.max(0, Math.min(maximo, valor))) / maximo;
  return { x: centro.x + r * Math.cos(angulo), y: centro.y + r * Math.sin(angulo) };
}

const dos = (v: number) => v.toFixed(2);

/** Atributo `points` del polígono de un juego de valores. */
export function poligono(valores: readonly number[], radio: number, centro: Punto): string {
  return valores.map((v, i) => puntoDeEje(i, valores.length, radio, v, centro)).map((p) => `${dos(p.x)},${dos(p.y)}`).join(" ");
}

/** Valores intermedios entre dos juegos (0 → antes, 1 → después). */
export function entreValores(antes: readonly number[], despues: readonly number[], t: number): number[] {
  const k = Math.max(0, Math.min(1, t));
  return antes.map((a, i) => a + ((despues[i] ?? a) - a) * k);
}

/** «6,2» con coma decimal, como se lee en español. */
export const formatearPuntaje = (valor: number): string => valor.toLocaleString("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
