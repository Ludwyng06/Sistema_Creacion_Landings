import type { Brief, EstadoSalud, IdValidador, LandingDoc, ResultadoValidador } from "@/lib/contratos";

export type Problema = ResultadoValidador["problemas"][number];

/** Función pura de validación; devuelve `doc` solo cuando corrigió algo. */
export type Validador = (doc: LandingDoc, brief?: Brief) => { resultado: ResultadoValidador; doc?: LandingDoc };

export function resultadoDe(
  id: IdValidador,
  problemas: Problema[],
  estadoConProblemas: EstadoSalud = "amarillo",
): ResultadoValidador {
  return { id, estado: problemas.length > 0 ? estadoConProblemas : "verde", problemas };
}
