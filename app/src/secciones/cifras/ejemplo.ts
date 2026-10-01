import type { Seccion } from "@/lib/contratos";

// Las cifras solo salen del brief: en el ejemplo todo valor va como [COMPLETAR].
export const ejemplo: Seccion = {
  id: "ejemplo-cifras",
  tipo: "cifras",
  visible: true,
  intencion: {
    objetivo: "Resumir el respaldo del producto con pocas cifras, solo si el brief las trae.",
    emocion: "confianza",
  },
  ajustes: { titulo: "Resultados reales" },
  bloques: [
    { id: "cif-1", tipo: "cifra", ajustes: { valor: "[COMPLETAR]", etiqueta: "Personas que lo probaron" } },
    { id: "cif-2", tipo: "cifra", ajustes: { valor: "[COMPLETAR]", etiqueta: "Calificación promedio" } },
    { id: "cif-3", tipo: "cifra", ajustes: { valor: "[COMPLETAR]", etiqueta: "Días para notar el cambio" } },
  ],
  animacion: { entrada: "subir", retraso: 0 },
};
