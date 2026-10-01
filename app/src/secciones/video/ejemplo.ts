import type { Asset, Seccion } from "@/lib/contratos";

export const ejemplo: Seccion = {
  id: "ejemplo-video",
  tipo: "video",
  visible: true,
  intencion: {
    objetivo: "Mostrar el corrector en movimiento, puesto y en uso durante una jornada de trabajo.",
    emocion: "confianza",
  },
  ajustes: {
    titulo: "Míralo en uso",
    slot: "video-uso",
    poster: "video-uso-poster",
    autoplay: true,
  },
  bloques: [],
  animacion: { entrada: "aparecer", retraso: 0 },
};

export const assets: Asset[] = [
  {
    slot: "video-uso",
    tipo: "video",
    relacion: "16:9",
    promptGrok:
      "Plano lento y continuo de una persona trabajando en su escritorio, la cámara se acerca despacio a su espalda mientras se endereza, luz natural, sin cortes, 6 segundos, formato 16:9.",
    alt: "Persona usando el corrector mientras trabaja",
  },
  {
    slot: "video-uso-poster",
    tipo: "imagen",
    relacion: "16:9",
    promptGrok: "Primer fotograma del video: escritorio con luz natural y una persona de espaldas, formato 16:9.",
    alt: "Escritorio con luz natural",
  },
];
