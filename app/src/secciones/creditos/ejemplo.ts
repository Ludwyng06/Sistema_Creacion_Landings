import type { Asset, Seccion } from "@/lib/contratos";

function armar(variante: "lista" | "compacta"): Seccion {
  return {
    id: `ejemplo-creditos-${variante}`,
    tipo: "creditos",
    variante,
    visible: true,
    intencion: { objetivo: "Dar el crédito y la licencia de cada imagen, como piden sus autores." },
    ajustes: { titulo: "Créditos de las imágenes" },
    bloques: [],
  };
}

export const ejemplos = { lista: armar("lista"), compacta: armar("compacta") } as const;

/** Valor por defecto al «Agregar sección». */
export const ejemplo: Seccion = ejemplos.lista;

/** Solo para pruebas y vistas de desarrollo: NO se agrega al documento con «Agregar sección» (las rutas no existen). */
export const assetsConCredito: Asset[] = [
  {
    slot: "heroe-fondo",
    tipo: "imagen",
    relacion: "16:9",
    promptGrok: "Cielo nocturno con la Vía Láctea sobre montañas, formato 16:9.",
    alt: "Vía Láctea sobre montañas",
    ruta: "/media/ejemplo/via-lactea.webp",
    fuente: "nasa-images",
    credito: "NASA/JPL-Caltech",
    licencia: "dominio-publico-nasa",
    urlOrigen: "https://images.nasa.gov/details/PIA00001",
  },
  {
    slot: "galeria-luna",
    tipo: "imagen",
    relacion: "4:5",
    promptGrok: "Luna llena con cráteres visibles, formato 4:5.",
    alt: "Luna llena",
    ruta: "/media/ejemplo/luna.webp",
    fuente: "nasa-images",
    credito: "NASA/JPL-Caltech",
    licencia: "dominio-publico-nasa",
  },
  {
    slot: "galeria-nebulosa",
    tipo: "imagen",
    relacion: "4:5",
    promptGrok: "Nebulosa de colores, formato 4:5.",
    alt: "Nebulosa",
    ruta: "/media/ejemplo/nebulosa.webp",
    fuente: "nasa-images",
    credito: "ESA/Webb, NASA y CSA",
    licencia: "cc-by-4.0",
    urlOrigen: "https://esawebb.org/images/",
  },
];
