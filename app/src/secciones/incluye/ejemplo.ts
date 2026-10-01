import type { Asset, Seccion } from "@/lib/contratos";

export const ejemplo: Seccion = {
  id: "ejemplo-incluye",
  tipo: "incluye",
  visible: true,
  intencion: {
    objetivo: "Mostrar exactamente qué recibe la persona para que no queden dudas al comprar.",
    emocion: "certeza",
  },
  ajustes: {
    titulo: "Qué viene en la caja",
    texto: "Todo lo necesario para empezar a usarlo desde el primer día.",
    imagen: "incluye-empaque",
  },
  bloques: [
    { id: "inc-1", tipo: "item", ajustes: { texto: "El corrector de postura" } },
    { id: "inc-2", tipo: "item", ajustes: { texto: "Cable de carga USB" } },
    { id: "inc-3", tipo: "item", ajustes: { texto: "Guía de uso rápida" } },
  ],
  animacion: { entrada: "subir", retraso: 0 },
};

export const assets: Asset[] = [
  {
    slot: "incluye-empaque",
    tipo: "imagen",
    relacion: "1:1",
    promptGrok:
      "Caja abierta con el corrector de postura, el cable USB y una guía impresa, vista cenital sobre fondo liso claro, luz de estudio suave, formato 1:1.",
    alt: "Caja abierta con el corrector, el cable y la guía",
  },
];
