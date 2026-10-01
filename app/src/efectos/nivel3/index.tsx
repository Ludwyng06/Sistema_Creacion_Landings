import type { ReactNode } from "react";
import type { EfectoId } from "@/lib/contratos";

import { ENVOLTURAS_NIVEL_3 } from "@/efectos/nivel3/envolturas";

export { ENVOLTURAS_NIVEL_3 };



/** Efectos de nivel 3 que registré como «no disponibles» (ninguno: los 6 están construidos). */
export const EFECTOS_NIVEL_3_NO_DISPONIBLES: readonly EfectoId[] = [];

// Un efecto que fija la sección no se combina con otro que también la fija: manda el primero de esta lista.
const QUE_FIJAN: readonly EfectoId[] = ["video-scroll", "producto-explotado", "horizontal", "pin-coreografia", "antes-despues-scroll"];

/** Los efectos de nivel 3 que envuelven una sección, del más externo al más interno (uno que fija y, si hay, las ondas). */
export function envolturasDe(efectos: readonly EfectoId[]): EfectoId[] {
  const fija = QUE_FIJAN.find((id) => efectos.includes(id));
  const salida: EfectoId[] = [];
  if (efectos.includes("shader-ondas") && !EFECTOS_NIVEL_3_NO_DISPONIBLES.includes("shader-ondas")) salida.push("shader-ondas");
  if (fija) salida.push(fija);
  return salida;
}

/** Envuelve el contenido de una sección con los efectos de nivel 3 que se le aplican. */
export function conEfectosNivel3(contenido: ReactNode, efectos: readonly EfectoId[]): ReactNode {
  return envolturasDe(efectos).reduce<ReactNode>((nodo, id) => {
    const Envoltura = ENVOLTURAS_NIVEL_3[id];
    return Envoltura ? <Envoltura>{nodo}</Envoltura> : nodo;
  }, contenido);
}
