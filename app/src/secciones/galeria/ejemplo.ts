import type { Asset, Seccion } from "@/lib/contratos";

const bloques: Seccion["bloques"] = [
  { id: "gal-1", tipo: "imagen", ajustes: { slot: "galeria-1", pie: "Vista frontal" } },
  { id: "gal-2", tipo: "imagen", ajustes: { slot: "galeria-2", pie: "Bajo la camisa" } },
  { id: "gal-3", tipo: "imagen", ajustes: { slot: "galeria-3", pie: "Carga por USB" } },
  { id: "gal-4", tipo: "imagen", ajustes: { slot: "galeria-4", pie: "Detalle del cierre" } },
];

function armar(id: string, disposicion: string): Seccion {
  return {
    id,
    tipo: "galeria",
    visible: true,
    intencion: {
      objetivo: "Dejar que la persona vea el producto desde varios ángulos antes de decidir.",
      emocion: "curiosidad",
    },
    ajustes: { titulo: "Míralo de cerca", disposicion },
    bloques,
    animacion: { entrada: "subir", retraso: 0 },
  };
}

export const ejemplos = {
  mosaico: armar("ejemplo-galeria-mosaico", "mosaico"),
  carrusel: armar("ejemplo-galeria-carrusel", "carrusel"),
  historias: armar("ejemplo-galeria-historias", "historias"),
  "carrusel-deslizante": armar("ejemplo-galeria-deslizante", "carrusel-deslizante"),
} as const;

/** Valor por defecto al «Agregar sección». */
export const ejemplo: Seccion = ejemplos.mosaico;

export const assets: Asset[] = [
  {
    slot: "galeria-1",
    tipo: "imagen",
    relacion: "4:5",
    promptGrok: "Corrector de postura negro mate, vista frontal sobre fondo liso claro, luz de estudio suave, formato 4:5.",
    alt: "Corrector de postura de frente",
  },
  {
    slot: "galeria-2",
    tipo: "imagen",
    relacion: "4:5",
    promptGrok: "Espalda de una persona con camisa clara y la silueta del corrector apenas visible debajo, luz natural, sin rostro, formato 4:5.",
    alt: "Corrector bajo la camisa",
  },
  {
    slot: "galeria-3",
    tipo: "imagen",
    relacion: "4:5",
    promptGrok: "Corrector de postura conectado a un cable USB sobre un escritorio de madera clara, luz lateral, formato 4:5.",
    alt: "Corrector cargando por USB",
  },
  {
    slot: "galeria-4",
    tipo: "imagen",
    relacion: "4:5",
    promptGrok: "Primer plano del cierre y las correas del corrector, textura del material, fondo liso, formato 4:5.",
    alt: "Detalle del cierre del corrector",
  },
];
