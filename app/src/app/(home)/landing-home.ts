import type { LandingDoc, Seccion, TipoSeccion } from "@/lib/contratos";
import { EJEMPLOS } from "@/datos/ejemplos";
import { ASSETS_POR_TIPO, EJEMPLO_POR_TIPO } from "@/secciones/ejemplos-por-tipo";
import { tirarSemilla } from "@/lib/tecnicas";

/** Las secciones que se apilan en el ensamblaje, de arriba hacia abajo. */
export const SECCIONES_DEL_ENSAMBLAJE: readonly TipoSeccion[] = ["heroe", "beneficios", "oferta", "faq"];

/**
 * Alto (px a 390 de ancho) con el que cada tarjeta enseña su titular completo. Los tamaños de letra dependen del
 * ancho de la ventana, no del marco: en pantallas grandes los titulares son más altos y las tarjetas también.
 */
export function altoNatural(tipo: string, pantallaGrande: boolean): number {
  if (tipo === "heroe") return pantallaGrande ? 540 : 340;
  return pantallaGrande ? 270 : 250;
}

const ejemplo = EJEMPLOS[0];

/** Documento de la landing del corrector de postura, con sus secciones de ejemplo y los tokens de su semilla. */
export function landingDelHome(): LandingDoc {
  const { semilla, tokens } = tirarSemilla(ejemplo.numeroSemilla, ejemplo.brief.intensidad);
  // Sin efectos: el home ya tiene su propia coreografía y el tope de nivel 3 es de toda la página.
  const secciones: Seccion[] = SECCIONES_DEL_ENSAMBLAJE.map((tipo) => ({ ...EJEMPLO_POR_TIPO[tipo], efectos: [] }));
  const assets = SECCIONES_DEL_ENSAMBLAJE.flatMap((tipo) => ASSETS_POR_TIPO[tipo] ?? []);
  return {
    version: 1,
    meta: {
      nombre: ejemplo.brief.nombre,
      slug: "ejemplo-home",
      producto: ejemplo.brief.nombre,
      tecnicas: ejemplo.tecnicas,
      semilla,
      nivelConciencia: ejemplo.brief.nivelConciencia,
      marco: "PAS",
      eliminadas: [],
    },
    tokens,
    secciones,
    assets,
  };
}
