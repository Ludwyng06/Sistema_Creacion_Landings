import type { Seccion } from "@/lib/contratos";

export const ejemplo: Seccion = {
  id: "ejemplo-formulario-lead",
  tipo: "formulario-lead",
  visible: true,
  intencion: {
    objetivo: "Capturar el contacto de quien ya decidió que quiere el corrector.",
    emocion: "decisión",
  },
  ajustes: {
    titulo: "Recibe tu corrector",
    subtitulo: "Déjanos tus datos y te escribimos hoy para confirmar tu pedido.",
    campos: ["nombre", "correo", "telefono", "ciudad"],
    obligatorios: ["nombre", "telefono"],
    textoBoton: "Quiero el mío",
    mensajeGracias: "Gracias, te escribimos muy pronto para confirmar tu pedido.",
    privacidad: "Usamos tus datos solo para contactarte sobre este producto.",
  },
  bloques: [],
  animacion: { entrada: "subir", retraso: 0 },
};
