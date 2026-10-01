import type { Asset, Seccion, TipoSeccion } from "@/lib/contratos";
import { ejemplos as ej_beneficios } from "./beneficios/ejemplo";
import { ejemplos as ej_comoFunciona } from "./como-funciona/ejemplo";
import { ejemplos as ej_comparativa } from "./comparativa/ejemplo";
import { ejemplos as ej_creditos } from "./creditos/ejemplo";
import { ejemplos as ej_ctaFija } from "./cta-fija/ejemplo";
import { ejemplos as ej_datoCurioso, assets as as_datoCurioso } from "./dato-curioso/ejemplo";
import { ejemplos as ej_datoEnVivo } from "./dato-en-vivo/ejemplo";
import { ejemplos as ej_fichaTecnica } from "./ficha-tecnica/ejemplo";
import { ejemplos as ej_galeria, assets as as_galeria } from "./galeria/ejemplo";
import { ejemplos as ej_heroe, assets as as_heroe } from "./heroe/ejemplo";
import { ejemplos as ej_ParaQuien, assets as as_ParaQuien } from "./para-quien/ejemplo";
import { ejemplos as ej_Mecanismo, assets as as_Mecanismo } from "./mecanismo/ejemplo";
import { ejemplos as ej_Historia, assets as as_Historia } from "./historia/ejemplo";
import { ejemplos as ej_Resumen, assets as as_Resumen } from "./resumen/ejemplo";
import { ejemplos as ej_EscenaUso, assets as as_EscenaUso } from "./escena-uso/ejemplo";
import { ASSETS_DE_VARIANTES_CON_IMAGEN, VARIANTES_CON_IMAGEN } from "./ejemplos-imagen";
import { ejemplos as ej_Agenda, assets as as_Agenda } from "./agenda/ejemplo";
import { ejemplos as ej_Ponentes, assets as as_Ponentes } from "./ponentes/ejemplo";
import { ejemplos as ej_LineaTiempo, assets as as_LineaTiempo } from "./linea-tiempo/ejemplo";
import { ejemplos as ej_Impacto, assets as as_Impacto } from "./impacto/ejemplo";
import { ejemplos as ej_sellos } from "./sellos-confianza/ejemplo";
import { ejemplos as ej_testimonios } from "./testimonios/ejemplo";
import { EJEMPLO_POR_TIPO, ASSETS_POR_TIPO } from "./ejemplos-por-tipo";

// Una miniatura por variante: cada variante de cada sección con su `ejemplo.ts`. El modal «Añadir sección» y el
// selector visual del inspector las pintan a escala con el mismo render de producción.

/** Dónde vive la variante: en `seccion.variante` (héroe y secciones nuevas) o en `ajustes.disposicion`. */
export type CampoVariante = "variante" | "disposicion";

export interface VarianteCatalogo {
  tipo: TipoSeccion;
  clave: string;
  campo: CampoVariante;
  /** Sección de ejemplo, ya con esa variante aplicada. */
  seccion: Seccion;
  assets: Asset[];
}

const MAPAS: Partial<Record<TipoSeccion, { campo: CampoVariante; ejemplos: Record<string, Seccion>; assets: Asset[] }>> = {
  heroe: { campo: "variante", ejemplos: ej_heroe, assets: as_heroe },
  beneficios: { campo: "disposicion", ejemplos: { ...ej_beneficios, ...VARIANTES_CON_IMAGEN.beneficios }, assets: ASSETS_DE_VARIANTES_CON_IMAGEN },
  "como-funciona": { campo: "disposicion", ejemplos: { ...ej_comoFunciona, ...VARIANTES_CON_IMAGEN["como-funciona"] }, assets: ASSETS_DE_VARIANTES_CON_IMAGEN },
  garantia: { campo: "variante", ejemplos: VARIANTES_CON_IMAGEN.garantia, assets: ASSETS_DE_VARIANTES_CON_IMAGEN },
  oferta: { campo: "variante", ejemplos: VARIANTES_CON_IMAGEN.oferta, assets: ASSETS_DE_VARIANTES_CON_IMAGEN },
  faq: { campo: "variante", ejemplos: VARIANTES_CON_IMAGEN.faq, assets: ASSETS_DE_VARIANTES_CON_IMAGEN },
  incluye: { campo: "variante", ejemplos: VARIANTES_CON_IMAGEN.incluye, assets: ASSETS_DE_VARIANTES_CON_IMAGEN },
  comparativa: { campo: "disposicion", ejemplos: ej_comparativa, assets: [] },
  galeria: { campo: "disposicion", ejemplos: ej_galeria, assets: as_galeria },
  testimonios: { campo: "disposicion", ejemplos: ej_testimonios, assets: [] },
  "dato-en-vivo": { campo: "variante", ejemplos: ej_datoEnVivo, assets: [] },
  "dato-curioso": { campo: "variante", ejemplos: ej_datoCurioso, assets: as_datoCurioso },
  "ficha-tecnica": { campo: "variante", ejemplos: ej_fichaTecnica, assets: [] },
  "sellos-confianza": { campo: "variante", ejemplos: ej_sellos, assets: [] },
  "para-quien": { campo: "variante", ejemplos: ej_ParaQuien, assets: as_ParaQuien },
  "mecanismo": { campo: "variante", ejemplos: ej_Mecanismo, assets: as_Mecanismo },
  "historia": { campo: "variante", ejemplos: ej_Historia, assets: as_Historia },
  "resumen": { campo: "variante", ejemplos: ej_Resumen, assets: as_Resumen },
  "escena-uso": { campo: "variante", ejemplos: ej_EscenaUso, assets: as_EscenaUso },
  "agenda": { campo: "variante", ejemplos: ej_Agenda, assets: as_Agenda },
  "ponentes": { campo: "variante", ejemplos: ej_Ponentes, assets: as_Ponentes },
  "linea-tiempo": { campo: "variante", ejemplos: ej_LineaTiempo, assets: as_LineaTiempo },
  "impacto": { campo: "variante", ejemplos: ej_Impacto, assets: as_Impacto },
  creditos: { campo: "variante", ejemplos: ej_creditos, assets: [] },
  "cta-fija": { campo: "variante", ejemplos: ej_ctaFija, assets: [] },
};

/** Las variantes de un tipo; un tipo sin variantes devuelve una sola entrada con su ejemplo. */
export function variantesDe(tipo: TipoSeccion): VarianteCatalogo[] {
  const mapa = MAPAS[tipo];
  if (!mapa) return [{ tipo, clave: tipo, campo: "variante", seccion: EJEMPLO_POR_TIPO[tipo], assets: ASSETS_POR_TIPO[tipo] ?? [] }];
  return Object.entries(mapa.ejemplos).map(([clave, seccion]) => ({ tipo, clave, campo: mapa.campo, seccion, assets: mapa.assets }));
}

/** ¿Tiene el tipo más de una variante para elegir? */
export function tieneVariantes(tipo: TipoSeccion): boolean {
  return (MAPAS[tipo] ? Object.keys(MAPAS[tipo]!.ejemplos).length : 0) > 1;
}

export function campoDeVariante(tipo: TipoSeccion): CampoVariante | null {
  return MAPAS[tipo]?.campo ?? null;
}

/** La variante en uso de una sección (o la primera si no eligió). */
export function varianteActual(seccion: Seccion): string | null {
  const campo = campoDeVariante(seccion.tipo);
  if (!campo) return null;
  const valor = campo === "variante" ? seccion.variante : seccion.ajustes.disposicion;
  const claves = Object.keys(MAPAS[seccion.tipo]!.ejemplos);
  return typeof valor === "string" && claves.includes(valor) ? valor : (claves[0] ?? null);
}

/** Cambia la variante conservando el contenido: solo se toca el campo de la variante. */
export function conVariante(seccion: Seccion, clave: string): Seccion {
  const campo = campoDeVariante(seccion.tipo);
  if (!campo) return seccion;
  return campo === "variante" ? { ...seccion, variante: clave } : { ...seccion, ajustes: { ...seccion.ajustes, disposicion: clave } };
}

/** Categorías del modal «Añadir sección». */
export const CATEGORIAS = [
  { id: "todas", nombre: "Todas" },
  { id: "encabezado", nombre: "Encabezado", tipos: ["heroe", "cinta-anuncio"] },
  { id: "persuasion", nombre: "Persuasión", tipos: ["problema-solucion", "historia", "mecanismo", "para-quien", "beneficios", "como-funciona", "antes-despues", "comparativa", "incluye"] },
  { id: "prueba", nombre: "Prueba y confianza", tipos: ["testimonios", "cifras", "garantia", "sellos-confianza", "faq"] },
  { id: "producto", nombre: "Producto", tipos: ["galeria", "escena-uso", "video", "ficha-tecnica", "oferta", "cuenta-regresiva"] },
  { id: "espacio", nombre: "Espacio", tipos: ["dato-en-vivo", "dato-curioso"] },
  { id: "cierre", nombre: "Cierre y fijos", tipos: ["resumen", "resumen", "formulario-lead", "creditos", "cta-fija", "html-libre"] },
] as const;
