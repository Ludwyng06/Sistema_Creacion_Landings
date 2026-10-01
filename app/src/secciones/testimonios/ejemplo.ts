import type { Seccion } from "@/lib/contratos";

// Testimonios reales solo salen del brief: en el ejemplo todo va como [COMPLETAR].
const bloques: Seccion["bloques"] = ["1", "2", "3"].map((n) => ({
  id: `test-${n}`,
  tipo: "testimonio",
  ajustes: {
    nombre: "[COMPLETAR]",
    ciudad: "[COMPLETAR]",
    texto: "[COMPLETAR]",
    estrellas: "[COMPLETAR]",
  },
}));

function armar(id: string, disposicion: string): Seccion {
  return {
    id,
    tipo: "testimonios",
    visible: true,
    intencion: {
      objetivo: "Dejar que personas reales cuenten su experiencia, solo con testimonios del brief.",
      emocion: "confianza",
      objecionQueResponde: "¿A otras personas les funcionó?",
    },
    ajustes: { titulo: "Lo que cuentan quienes lo usan", disposicion },
    bloques,
    animacion: { entrada: "aparecer", retraso: 0 },
  };
}

export const ejemplos = {
  muro: armar("ejemplo-testimonios-muro", "muro"),
  carrusel: armar("ejemplo-testimonios-carrusel", "carrusel"),
  destacado: armar("ejemplo-testimonios-destacado", "destacado"),
} as const;

/** Valor por defecto al «Agregar sección». */
export const ejemplo: Seccion = ejemplos.muro;
