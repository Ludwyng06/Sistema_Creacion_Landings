// Tabla de capítulos del home (docs/08 §2).

export type IdCapitulo = "portada" | "problema" | "brief" | "tecnicas" | "ensamblaje" | "semilla" | "critico" | "banco" | "cierre";

export interface Capitulo {
  numero: number;
  id: IdCapitulo;
  /** Etiqueta corta para la navegación y los lectores de pantalla. */
  nombre: string;
  /** Inicio y fin (0–1) dentro del recorrido total. */
  inicio: number;
  fin: number;
  /** Alto de la sección en `svh` (el contenido fijo ocupa una pantalla; el resto es recorrido de scroll). */
  alto: number;
}

/** Alto de cada capítulo en `svh`: los que tienen coreografía reciben más recorrido de scroll. */
const REPARTO: [IdCapitulo, string, number][] = [
  ["portada", "Portada", 400],
  ["problema", "El problema", 300],
  ["brief", "El brief", 300],
  ["tecnicas", "Las 8 técnicas", 360],
  ["ensamblaje", "El ensamblaje", 360],
  ["semilla", "La semilla", 300],
  ["critico", "El crítico", 260],
  ["banco", "El banco", 100],
  ["cierre", "Cierre", 260],
];

const TOTAL_VH = REPARTO.reduce((suma, [, , vh]) => suma + vh, 0);

/** El reparto del recorrido sale de los altos reales, así el capítulo activo coincide con lo que se ve. */
export const CAPITULOS: readonly Capitulo[] = (() => {
  let acumulado = 0;
  return REPARTO.map(([id, nombre, vh], numero) => {
    const capitulo: Capitulo = { numero, id, nombre, inicio: acumulado / TOTAL_VH, fin: (acumulado + vh) / TOTAL_VH, alto: vh };
    acumulado += vh;
    return capitulo;
  });
})();

/** Capítulo que corresponde a un progreso global de 0 a 1 (los bordes se asignan al primero y al último). */
export function capituloEn(progreso: number, tabla: readonly Capitulo[] = CAPITULOS): Capitulo {
  const p = Number.isFinite(progreso) ? Math.min(1, Math.max(0, progreso)) : 0;
  return tabla.find((c) => p >= c.inicio && p < c.fin) ?? tabla[tabla.length - 1];
}

/** Progreso local (0–1) de un capítulo a partir del progreso global. */
export function progresoLocal(progreso: number, capitulo: Capitulo): number {
  const largo = capitulo.fin - capitulo.inicio;
  return largo <= 0 ? 0 : Math.min(1, Math.max(0, (progreso - capitulo.inicio) / largo));
}

/**
 * Efectos de nivel 3 que usa el home, uno por capítulo (docs/08 §3: máximo 3 por landing/página).
 * Los capítulos 5 a 7 quedan sin nivel 3 hasta que se animen en la siguiente tarea.
 */
export const EFECTOS_NIVEL_3_DEL_HOME = {
  portada: "video-scroll",
  tecnicas: "pin-coreografia",
  ensamblaje: "producto-explotado",
} as const;
