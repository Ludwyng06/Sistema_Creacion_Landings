import type { Asset, Seccion } from "@/lib/contratos";

const bloques: Seccion["bloques"] = [
  { id: "mec-1", tipo: "nota", ajustes: { titulo: "Sensor de postura", texto: "Detecta cuando te inclinas.", x: 30, y: 28 } },
  { id: "mec-2", tipo: "nota", ajustes: { titulo: "Vibración suave", texto: "Te avisa sin sonido.", x: 68, y: 45 } },
  { id: "mec-3", tipo: "nota", ajustes: { titulo: "Carga por USB", texto: "Se recarga en el computador.", x: 45, y: 74 } },
];

function armar(variante: "antes-despues-creencia" | "zoom-detalle" | "diagrama"): Seccion {
  return {
    id: `ejemplo-mecanismo-${variante}`,
    tipo: "mecanismo",
    variante,
    visible: true,
    intencion: { objetivo: "Cambiar una creencia con el mecanismo único del producto.", emocion: "curiosidad", objecionQueResponde: "¿Y por qué este sí funciona?" },
    ajustes: { titulo: "Cómo funciona por dentro", creencia: "Todos los correctores incomodan", realidad: "Este solo te avisa cuando te encorvas, sin apretar ni molestar.", imagen: "mecanismo-imagen" },
    bloques,
    animacion: { entrada: "subir", retraso: 0 },
  };
}

export const ejemplos = { "antes-despues-creencia": armar("antes-despues-creencia"), "zoom-detalle": armar("zoom-detalle"), diagrama: armar("diagrama") } as const;
export const ejemplo: Seccion = ejemplos["zoom-detalle"];

export const assets: Asset[] = [{ slot: "mecanismo-imagen", tipo: "imagen", relacion: "4:5", promptGrok: "", alt: "Detalle del producto" }];
