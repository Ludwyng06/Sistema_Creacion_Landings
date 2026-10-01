import type { DefinicionEfecto, EfectoId } from "@/lib/contratos";

/**
 * Copia de `CATALOGO_EFECTOS` (contratos) para el navegador. `@/lib/contratos` importa `zod` a nivel de módulo, así que
 * cualquier importación de valores desde el cliente descarga los ~90 KB de zod en cada landing. Aquí solo hay datos.
 * `tests/efectos-nivel3/catalogo-cliente.test.ts` falla si esta tabla deja de ser igual a la de contratos.
 */
export const CATALOGO_CLIENTE: Record<EfectoId, DefinicionEfecto> = {
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
  "video-scroll": { nivel: 3, secciones: ["heroe", "video"], variantesHeroe: ["video-inmersivo", "producto-monumental"] },
  "producto-explotado": { nivel: 3, secciones: ["heroe", "como-funciona"], variantesHeroe: ["producto-monumental"] },
  "pin-coreografia": { nivel: 3, secciones: ["beneficios", "como-funciona", "antes-despues"] },
  horizontal: { nivel: 3, secciones: ["galeria", "beneficios", "testimonios"] },
  "shader-ondas": { nivel: 3, secciones: ["galeria", "heroe"] },
  "antes-despues-scroll": { nivel: 3, secciones: ["antes-despues"] },
};

export const MAX_NIVEL_3_CLIENTE = 3;
