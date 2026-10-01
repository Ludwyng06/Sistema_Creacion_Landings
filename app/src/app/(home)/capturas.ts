// Capturas reales de una landing de la vitrina para los capítulos 4 y 5 del home. Las genera `npm run capturas:home`
// (Playwright, con los tokens de cada semilla) y aquí se leen sus medidas. Así el home muestra la landing tal cual se ve en un
// móvil de 390 px o en un escritorio de 1280 px, sin montar otra landing entera dentro de la página.

import datos from "@/datos/home-capturas.json";

export interface CapturaSeccion {
  tipo: string;
  /** Etiqueta para el lector (la del catálogo de secciones). */
  etiqueta: string;
  /** Posición y alto reales, en px CSS del ancho de captura, contados desde el inicio de la primera sección. */
  top: number;
  alto: number;
}

export interface CapturaLanding {
  archivo: string;
  /** Ancho de captura en px CSS (390 o 1280). */
  ancho: number;
  alto: number;
  secciones: CapturaSeccion[];
}

export interface DatosCapturas {
  /** Capítulo 4: cada sección en su propio archivo, a 390 px. */
  ensamblaje: { slug: string; secciones: (CapturaSeccion & { archivo: string; ancho: number })[] };
  /** Capítulo 5: la landing de la semilla `n` (0–2) a 1280 px y a 390 px. */
  semilla: { slug: string; url: string; escritorio: CapturaLanding[]; movil: CapturaLanding[] };
}

export const CAPTURAS = datos as unknown as DatosCapturas;

/** Escala con la que una captura de `ancho` px cabe en un marco de `anchoMarco` px. */
export const escalaPara = (ancho: number, anchoMarco: number): number => anchoMarco / ancho;

/**
 * Posiciones de desplazamiento (px ya escalados, de 0 hacia abajo) en las que la landing se detiene: por cada sección,
 * una con su inicio arriba y otra con su final abajo (si la sección es más alta que la ventana; si cabe, es la misma).
 * Así cada sección se ve entera en algún momento. Siempre `2 × secciones` paradas, crecientes y dentro del largo total.
 */
export function paradas(secciones: readonly Pick<CapturaSeccion, "top" | "alto">[], escala: number, altoVentana: number): number[] {
  const total = secciones.length ? (secciones.at(-1)!.top + secciones.at(-1)!.alto) * escala : 0;
  const maximo = Math.max(0, total - altoVentana);
  const salida: number[] = [];
  for (const s of secciones) {
    const arriba = Math.min(maximo, s.top * escala);
    const abajo = Math.min(maximo, Math.max(arriba, (s.top + s.alto) * escala - altoVentana));
    salida.push(arriba, abajo);
  }
  // Crecientes (por los topes del final pueden repetirse, nunca retroceder).
  for (let i = 1; i < salida.length; i++) salida[i] = Math.max(salida[i], salida[i - 1]);
  return salida;
}

const suave = (t: number) => t * t * (3 - 2 * t);

/**
 * Desplazamiento para un progreso 0–1 repartido en partes iguales entre las paradas: dentro de cada tramo la landing
 * se queda quieta un rato (se lee) y luego pasa a la siguiente parada con suavidad.
 */
export function desplazamientoEn(progreso: number, posiciones: readonly number[]): number {
  if (posiciones.length === 0) return 0;
  if (posiciones.length === 1) return posiciones[0];
  const p = Math.min(1, Math.max(0, progreso));
  const tramos = posiciones.length - 1;
  const x = p * tramos;
  const i = Math.min(tramos - 1, Math.floor(x));
  const t = x - i;
  // 55 % quieta y 45 % en movimiento.
  const mover = t < 0.55 ? 0 : suave((t - 0.55) / 0.45);
  return posiciones[i] + (posiciones[i + 1] - posiciones[i]) * mover;
}

/** Índice de la sección que ocupa más la ventana en ese desplazamiento (para el rótulo). */
export function seccionVisible(secciones: readonly Pick<CapturaSeccion, "top" | "alto">[], escala: number, desplazamiento: number, altoVentana: number): number {
  const centro = desplazamiento + altoVentana / 2;
  const i = secciones.findIndex((s) => centro < (s.top + s.alto) * escala);
  return i < 0 ? secciones.length - 1 : i;
}
