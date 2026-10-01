import type { Seccion } from "@/lib/contratos";

export const ejemplo: Seccion = {
  id: "ejemplo-faq",
  tipo: "faq",
  visible: true,
  intencion: {
    objetivo: "Responder las dudas más frecuentes antes de que la persona deje sus datos.",
    emocion: "tranquilidad",
    objecionQueResponde: "¿Y si no me funciona?",
  },
  ajustes: { titulo: "Preguntas frecuentes" },
  bloques: [
    {
      id: "faq-1",
      tipo: "pregunta",
      ajustes: {
        pregunta: "¿Se nota bajo la ropa?",
        respuesta: "Es delgado y liso, así que pasa desapercibido bajo una camisa normal.",
        objecion: "discreción",
      },
    },
    {
      id: "faq-2",
      tipo: "pregunta",
      ajustes: {
        pregunta: "¿Cuánto dura la batería?",
        respuesta: "[COMPLETAR]",
        objecion: "duración",
      },
    },
    {
      id: "faq-3",
      tipo: "pregunta",
      ajustes: {
        pregunta: "¿Qué pasa si no me sirve?",
        respuesta: "[COMPLETAR]",
        objecion: "riesgo",
      },
    },
    {
      id: "faq-4",
      tipo: "pregunta",
      ajustes: {
        pregunta: "¿Cuánto tarda en llegar?",
        respuesta: "[COMPLETAR]",
        objecion: "envío",
      },
    },
  ],
  animacion: { entrada: "aparecer", retraso: 0 },
};
