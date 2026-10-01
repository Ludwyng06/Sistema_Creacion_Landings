import type { Asset, Seccion } from "@/lib/contratos";

const bloques: Seccion["bloques"] = [
  { id: "res-1", tipo: "item", ajustes: { texto: "El producto en su caja" } },
  { id: "res-2", tipo: "item", ajustes: { texto: "Envío a tu puerta" } },
  { id: "res-3", tipo: "item", ajustes: { texto: "Pago al recibir" } },
  { id: "res-4", tipo: "item", ajustes: { texto: "Garantía por escrito" } },
  { id: "res-5", tipo: "item", ajustes: { texto: "Atención por WhatsApp" } },
];

function armar(variante: "lista-todo" | "tarjeta-final"): Seccion {
  return {
    id: `ejemplo-resumen-${variante}`,
    tipo: "resumen",
    variante,
    visible: true,
    intencion: { objetivo: "Recapitular lo que recibe la persona justo antes del formulario.", emocion: "decisión", objecionQueResponde: "¿Qué me llevo exactamente?" },
    ajustes: { titulo: "Todo lo que recibes", imagen: "resumen-imagen", cierre: "Pídelo hoy y págalo cuando llegue." },
    bloques,
    animacion: { entrada: "subir", retraso: 0 },
  };
}

export const ejemplos = { "lista-todo": armar("lista-todo"), "tarjeta-final": armar("tarjeta-final") } as const;
export const ejemplo: Seccion = ejemplos["lista-todo"];

export const assets: Asset[] = [{ slot: "resumen-imagen", tipo: "imagen", relacion: "1:1", promptGrok: "", alt: "El producto con todo lo que incluye" }];
