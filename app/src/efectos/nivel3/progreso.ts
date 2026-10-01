// Cálculos puros de los efectos de nivel 3 (se prueban sin navegador).

export const limitar = (v: number, min = 0, max = 1): number => Math.min(max, Math.max(min, v));

/**
 * Progreso de una sección fijada (`sticky`) dentro de su caja alta: 0 cuando el borde superior de la caja toca el
 * de la ventana y 1 cuando su borde inferior toca el inferior.
 */
export function progresoFijado(topCaja: number, altoCaja: number, altoVentana: number, altoInterno: number = altoVentana): number {
  // Si el contenido fijado es más alto que la ventana, se fija alineado por abajo: el avance empieza más tarde.
  const desfase = Math.max(0, altoInterno - altoVentana);
  const recorrido = altoCaja - Math.max(altoInterno, altoVentana);
  return recorrido <= 0 ? 0 : limitar((-topCaja - desfase) / recorrido);
}

/** Progreso de una sección que no se fija: 0 cuando asoma por abajo y 1 cuando sale por arriba. */
export function progresoAlPasar(topSeccion: number, altoSeccion: number, altoVentana: number): number {
  const total = altoVentana + altoSeccion;
  return total <= 0 ? 0 : limitar((altoVentana - topSeccion) / total);
}

/**
 * Solo se fija una sección que cabe en la pantalla (o que la supera hasta `tolerancia` veces, y entonces se fija alineada
 * por abajo); si es más alta, se recorre con el scroll normal.
 */
export const cabeEnPantalla = (altoContenido: number, altoVentana: number, tolerancia = 1.02): boolean => altoContenido <= altoVentana * tolerancia;

/** Scroll extra (px) de `pin-coreografia`: medio recorrido de pantalla por bloque más un margen. */
export const recorridoPin = (bloques: number, altoVentana: number): number => Math.round(altoVentana * (0.5 * bloques + 0.4));

/** Momento (0–1) en que empieza a entrar el bloque `i` de `n`. */
export const umbralBloque = (i: number, n: number): number => 0.06 + i * (0.78 / Math.max(1, n));

/** Recorrido horizontal (px) de una pista más ancha que la ventana; 0 si cabe. */
export const recorridoHorizontal = (anchoPista: number, anchoVisible: number): number => Math.max(0, Math.round(anchoPista - anchoVisible));
