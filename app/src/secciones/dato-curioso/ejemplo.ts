import type { Asset, Seccion } from "@/lib/contratos";

const TIPO = "dato-curioso";

export const ejemplos: Record<"sabias-que" | "real-vs-producto", Seccion> = {
  "sabias-que": {
    id: "ejemplo-dato-curioso-sabias-que",
    tipo: TIPO,
    variante: "sabias-que",
    visible: true,
    intencion: { objetivo: "Sumar asombro con un dato verificable y darle la fuente a quien quiera comprobarlo.", emocion: "asombro" },
    ajustes: {
      titulo: "¿Sabías que…?",
      frase: "La Luna se aleja de la Tierra unos centímetros cada año, y los astronautas dejaron reflectores para medirlo.",
      fuenteNombre: "NASA",
      fuenteUrl: "https://science.nasa.gov/moon/",
    },
    bloques: [],
    animacion: { entrada: "subir", retraso: 0 },
  },
  "real-vs-producto": {
    id: "ejemplo-dato-curioso-real-vs-producto",
    tipo: TIPO,
    variante: "real-vs-producto",
    visible: true,
    intencion: { objetivo: "Comparar el cielo real con el efecto del producto en una habitación, sin exagerar.", emocion: "deseo" },
    ajustes: {
      titulo: "Lo real y lo que ves en casa",
      frase: "Las auroras nacen cuando partículas del Sol chocan con la atmósfera. El proyector imita ese efecto en tu techo.",
      fuenteNombre: "NOAA Space Weather",
      fuenteUrl: "https://www.swpc.noaa.gov/phenomena/aurora",
      slotReal: "dato-real",
      slotProducto: "dato-producto",
      etiquetaReal: "Aurora real",
      etiquetaProducto: "El proyector en una habitación",
    },
    bloques: [],
    animacion: { entrada: "subir", retraso: 0 },
  },
};

/** Valor por defecto al «Agregar sección». */
export const ejemplo: Seccion = ejemplos["sabias-que"];

export const assets: Asset[] = [
  {
    slot: "dato-real",
    tipo: "imagen",
    relacion: "4:5",
    promptGrok: "Aurora boreal verde sobre un lago de noche, cielo estrellado, fotografía realista, formato 4:5.",
    alt: "Aurora boreal verde sobre un lago",
  },
  {
    slot: "dato-producto",
    tipo: "imagen",
    relacion: "4:5",
    promptGrok: "Habitación oscura con un proyector de auroras sobre una mesa y luces verdes y violetas en el techo, formato 4:5.",
    alt: "Habitación con luces de aurora en el techo",
  },
];
