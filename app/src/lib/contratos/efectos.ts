import { z } from "zod";
import { VarianteHeroe, type TipoSeccion } from "./secciones";

export const EFECTOS_ID = [
  "revelar-suave",
  "grano",
  "precio-cae",
  "titular-cinetico",
  "mascara-circular",
  "mascara-persiana",
  "marquee-reactivo",
  "boton-magnetico",
  "cursor-vivo",
  "video-scroll",
  "producto-explotado",
  "pin-coreografia",
  "horizontal",
  "shader-ondas",
  "antes-despues-scroll",
] as const;

export const EfectoId = z.enum(EFECTOS_ID);
export type EfectoId = z.infer<typeof EfectoId>;

export type DefinicionEfecto = {
  nivel: 1 | 2 | 3;
  secciones: (TipoSeccion | "global")[];
  variantesHeroe?: VarianteHeroe[];
};

// Tabla de docs/08-direccion-creativa.md §3. `revelar-suave` aplica a todas las secciones.
export const CATALOGO_EFECTOS: Record<EfectoId, DefinicionEfecto> = {
  "revelar-suave": {
    nivel: 1,
    secciones: [
      "heroe", "cinta-anuncio", "problema-solucion", "beneficios", "como-funciona",
      "antes-despues", "comparativa", "galeria", "video", "testimonios", "cifras",
      "oferta", "incluye", "cuenta-regresiva", "faq", "garantia", "formulario-lead", "html-libre",
    ],
  },
  grano: { nivel: 1, secciones: ["global"] },
  "precio-cae": { nivel: 1, secciones: ["oferta"] },
  "titular-cinetico": { nivel: 2, secciones: ["heroe", "problema-solucion", "formulario-lead"] },
  "mascara-circular": { nivel: 2, secciones: ["galeria", "heroe", "incluye"] },
  "mascara-persiana": { nivel: 2, secciones: ["galeria", "heroe", "incluye"] },
  "marquee-reactivo": { nivel: 2, secciones: ["cinta-anuncio"] },
  "boton-magnetico": { nivel: 2, secciones: ["heroe", "oferta", "formulario-lead"] },
  "cursor-vivo": { nivel: 2, secciones: ["global"] },
  "video-scroll": {
    nivel: 3,
    secciones: ["heroe", "video"],
    variantesHeroe: ["video-inmersivo", "producto-monumental"],
  },
  "producto-explotado": {
    nivel: 3,
    secciones: ["heroe", "como-funciona"],
    variantesHeroe: ["producto-monumental"],
  },
  "pin-coreografia": { nivel: 3, secciones: ["beneficios", "como-funciona", "antes-despues"] },
  horizontal: { nivel: 3, secciones: ["galeria", "beneficios", "testimonios"] },
  "shader-ondas": { nivel: 3, secciones: ["galeria", "heroe"] },
  "antes-despues-scroll": { nivel: 3, secciones: ["antes-despues"] },
};

export const MAX_EFECTOS_NIVEL_3 = 3;
