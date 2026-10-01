import type { Seccion } from "@/lib/contratos";

// La fecha de fin debe ser real y salir del brief: en el ejemplo va como [COMPLETAR].
export const ejemplo: Seccion = {
  id: "ejemplo-cuenta-regresiva",
  tipo: "cuenta-regresiva",
  visible: true,
  intencion: {
    objetivo: "Dar un motivo real para decidir ahora, solo si el brief trae una fecha de fin.",
    emocion: "urgencia honesta",
  },
  ajustes: {
    titulo: "La oferta termina en",
    fechaFin: "[COMPLETAR]",
    estilo: "bloques",
  },
  bloques: [],
  animacion: { entrada: "aparecer", retraso: 0 },
};
