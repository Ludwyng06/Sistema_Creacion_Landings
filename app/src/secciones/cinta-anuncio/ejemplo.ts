import type { Seccion } from "@/lib/contratos";

export const ejemplo: Seccion = {
  id: "ejemplo-cinta-anuncio",
  tipo: "cinta-anuncio",
  visible: true,
  intencion: {
    objetivo: "Recordar la acción principal sin ocupar espacio: una cinta fina antes del contenido.",
    emocion: "urgencia suave",
  },
  ajustes: {
    textos: ["Corrector de postura", "Pide el tuyo hoy", "Te escribimos para confirmar"],
    velocidad: 4,
    estilo: "solido",
  },
  bloques: [],
  animacion: { entrada: "aparecer", retraso: 0 },
};
