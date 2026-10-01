import type { Seccion } from "@/lib/contratos";

// Los días de garantía salen del brief: en el ejemplo va como [COMPLETAR].
export const ejemplo: Seccion = {
  id: "ejemplo-garantia",
  tipo: "garantia",
  visible: true,
  intencion: {
    objetivo: "Quitar el miedo a comprar con una garantía clara y fácil de usar.",
    emocion: "tranquilidad",
    objecionQueResponde: "¿Y si no me sirve?",
  },
  ajustes: {
    titulo: "Compra sin riesgo",
    texto: "Si el corrector no es para ti, escríbenos y lo resolvemos.",
    dias: "[COMPLETAR]",
    icono: "escudo",
  },
  bloques: [
    { id: "prom-1", tipo: "promesa", ajustes: { texto: "Una persona real responde tu mensaje" } },
    { id: "prom-2", tipo: "promesa", ajustes: { texto: "Las condiciones están escritas antes de comprar" } },
  ],
  animacion: { entrada: "subir", retraso: 0 },
};
