import type { Seccion } from "@/lib/contratos";

const bloques: Seccion["bloques"] = [
  { id: "fila-1", tipo: "fila", ajustes: { caracteristica: "Avisa cuando te encorvas", nuestro: true, otros: false } },
  { id: "fila-2", tipo: "fila", ajustes: { caracteristica: "Se usa bajo la ropa", nuestro: true, otros: false } },
  { id: "fila-3", tipo: "fila", ajustes: { caracteristica: "Se carga por USB", nuestro: true, otros: "Depende del modelo" } },
  { id: "fila-4", tipo: "fila", ajustes: { caracteristica: "Duración de la batería", nuestro: "[COMPLETAR]", otros: "[COMPLETAR]" } },
];

function armar(id: string, estilo: string): Seccion {
  return {
    id,
    tipo: "comparativa",
    visible: true,
    intencion: {
      objetivo: "Responder a la duda de si vale la pena frente a las fajas y correctores comunes.",
      emocion: "claridad",
      objecionQueResponde: "¿Por qué este y no una faja de las de siempre?",
    },
    ajustes: {
      titulo: "Frente a una faja de las de siempre",
      nombreNuestro: "Corrector inteligente",
      nombreOtros: "Faja común",
      estilo,
    },
    bloques,
    animacion: { entrada: "aparecer", retraso: 0 },
  };
}

export const ejemplos = {
  minimal: armar("ejemplo-comparativa-minimal", "minimal"),
  resaltado: armar("ejemplo-comparativa-resaltado", "resaltado"),
} as const;

/** Valor por defecto al «Agregar sección». */
export const ejemplo: Seccion = ejemplos.resaltado;
