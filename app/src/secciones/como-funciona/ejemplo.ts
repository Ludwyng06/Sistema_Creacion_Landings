import type { Seccion } from "@/lib/contratos";

const bloques: Seccion["bloques"] = [
  {
    id: "paso-1",
    tipo: "paso",
    ajustes: { titulo: "Póntelo", texto: "Se ajusta a la espalda bajo la camisa y se enciende con un toque." },
  },
  {
    id: "paso-2",
    tipo: "paso",
    ajustes: { titulo: "Trabaja como siempre", texto: "Cuando te encorvas, vibra un instante para avisarte." },
  },
  {
    id: "paso-3",
    tipo: "paso",
    ajustes: { titulo: "Endereza y sigue", texto: "Te acomodas, la vibración se detiene y continúas con tu día." },
  },
];

function armar(id: string, disposicion: string): Seccion {
  return {
    id,
    tipo: "como-funciona",
    visible: true,
    intencion: {
      objetivo: "Mostrar que usarlo es tan simple como ponérselo y trabajar.",
      emocion: "facilidad",
      objecionQueResponde: "¿Será complicado de usar?",
    },
    ajustes: { titulo: "Tres pasos y ya", disposicion },
    bloques,
    animacion: { entrada: "subir", retraso: 0 },
  };
}

export const ejemplos = {
  "pasos-verticales": armar("ejemplo-como-funciona-pasos", "pasos-verticales"),
  "linea-tiempo": armar("ejemplo-como-funciona-linea", "linea-tiempo"),
} as const;

/** Valor por defecto al «Agregar sección». */
export const ejemplo: Seccion = ejemplos["pasos-verticales"];
