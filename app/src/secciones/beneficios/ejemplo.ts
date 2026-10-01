import type { Seccion } from "@/lib/contratos";

const bloques: Seccion["bloques"] = [
  {
    id: "ben-1",
    tipo: "beneficio",
    ajustes: { icono: "espalda", titulo: "Aviso suave", texto: "Vibra un instante cuando te encorvas, para que te enderences sin pensarlo." },
  },
  {
    id: "ben-2",
    tipo: "beneficio",
    ajustes: { icono: "reloj", titulo: "Uso discreto", texto: "Va bajo la camisa y nadie en la oficina lo nota." },
  },
  {
    id: "ben-3",
    tipo: "beneficio",
    ajustes: { icono: "bateria", titulo: "Carga por USB", texto: "Lo cargas desde el computador mientras trabajas." },
  },
];

function armar(id: string, disposicion: string): Seccion {
  return {
    id,
    tipo: "beneficios",
    visible: true,
    intencion: {
      objetivo: "Traducir cada función del producto en un beneficio concreto para el día a día.",
      emocion: "confianza",
    },
    ajustes: { titulo: "Lo que cambia en tu día", disposicion },
    bloques,
    animacion: { entrada: "subir", retraso: 0 },
  };
}

export const ejemplos = {
  "lista-grande": armar("ejemplo-beneficios-lista", "lista-grande"),
  "tarjetas-apiladas": armar("ejemplo-beneficios-tarjetas", "tarjetas-apiladas"),
  numerada: armar("ejemplo-beneficios-numerada", "numerada"),
  carrusel: armar("ejemplo-beneficios-carrusel", "carrusel"),
} as const;

/** Valor por defecto al «Agregar sección». */
export const ejemplo: Seccion = ejemplos["lista-grande"];
