import type { Asset, Seccion } from "@/lib/contratos";
import { ejemplos as ej_beneficios } from "./beneficios/ejemplo";
import { ejemplos as ej_comoFunciona } from "./como-funciona/ejemplo";
import { ejemplo as ej_faq } from "./faq/ejemplo";
import { ejemplo as ej_garantia } from "./garantia/ejemplo";
import { ejemplo as ej_incluye, assets as as_incluye } from "./incluye/ejemplo";
import { ejemplo as ej_oferta } from "./oferta/ejemplo";

// Las variantes con imagen (14-B) de beneficios, cómo funciona, garantía, oferta, FAQ e incluye, derivadas del ejemplo
// de cada sección: mismo contenido, más una imagen del banco. Sirven para las miniaturas, «Añadir sección» y las pruebas.

const foto = (slot: string, relacion: Asset["relacion"], alt: string): Asset => ({ slot, tipo: "imagen", relacion, promptGrok: "", alt });

const conAjustes = (s: Seccion, id: string, extra: Record<string, unknown>, variante?: string): Seccion => ({
  ...s,
  id,
  ...(variante ? { variante } : {}),
  ajustes: { ...s.ajustes, ...extra },
});

export const ASSETS_BENEFICIOS_IMAGEN: Asset[] = [1, 2, 3].map((n) => foto(`beneficio-img-${n}`, "4:5", `Foto del beneficio ${n}`));

const beneficiosBase = ej_beneficios["lista-grande"];
export const beneficiosImagenAlterna: Seccion = {
  ...conAjustes(beneficiosBase, "ejemplo-beneficios-imagen-alterna", { disposicion: "imagen-alterna" }),
  bloques: beneficiosBase.bloques.map((b, i) => ({ ...b, ajustes: { ...b.ajustes, imagen: `beneficio-img-${i + 1}` } })),
};

export const comoFuncionaConImagen: Seccion = conAjustes(ej_comoFunciona["pasos-verticales"], "ejemplo-como-funciona-imagen", { disposicion: "pasos-con-imagen", imagen: "como-funciona-imagen" });
export const ASSETS_COMO_FUNCIONA_IMAGEN: Asset[] = [foto("como-funciona-imagen", "4:5", "El producto en uso, paso a paso")];

export const garantiaConImagen: Seccion = conAjustes(ej_garantia, "ejemplo-garantia-con-imagen", { imagen: "garantia-imagen" }, "con-imagen");
export const ofertaConImagen: Seccion = conAjustes(ej_oferta, "ejemplo-oferta-con-imagen", { imagen: "oferta-imagen" }, "con-imagen");
export const faqConImagen: Seccion = conAjustes(ej_faq, "ejemplo-faq-con-imagen", { imagen: "faq-imagen" }, "con-imagen");
export const incluyeFondoBanco: Seccion = conAjustes(ej_incluye, "ejemplo-incluye-fondo-banco", {}, "fondo-banco");

export const ASSETS_CON_IMAGEN: Asset[] = [
  foto("garantia-imagen", "4:5", "Paquete llegando a la puerta"),
  foto("oferta-imagen", "4:5", "El producto con su caja"),
  foto("faq-imagen", "4:5", "Persona resolviendo dudas"),
];

export const VARIANTES_CON_IMAGEN = {
  beneficios: { "imagen-alterna": beneficiosImagenAlterna },
  "como-funciona": { "pasos-con-imagen": comoFuncionaConImagen },
  garantia: { estandar: ej_garantia, "con-imagen": garantiaConImagen },
  oferta: { estandar: ej_oferta, "con-imagen": ofertaConImagen },
  faq: { estandar: ej_faq, "con-imagen": faqConImagen },
  incluye: { estandar: ej_incluye, "fondo-banco": incluyeFondoBanco },
} as const;

/** Slots que hacen falta para dibujar cada ejemplo con imagen. */
export const ASSETS_DE_VARIANTES_CON_IMAGEN: Asset[] = [...ASSETS_BENEFICIOS_IMAGEN, ...ASSETS_COMO_FUNCIONA_IMAGEN, ...ASSETS_CON_IMAGEN, ...as_incluye];
