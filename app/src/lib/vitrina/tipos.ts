import type { Brief, TecnicaId } from "@/lib/contratos";

// La vitrina: las 8 landings completas del banco (docs/bitacora/plan-v2.md). Aquí solo los tipos; los datos viven en src/datos/vitrina.ts.

export type TematicaVitrina = "espacio" | "producto";

export type VarianteWidget = "auroras" | "fase-lunar" | "iss" | "cuenta-regresiva-lanzamiento" | "asteroides";

export type FuenteInvestigacion =
  | "nasa-images"
  | "neows"
  | "noaa-kp"
  | "usno-luna"
  | "iss"
  | "lanzamientos"
  | "open-food-facts"
  | "open-beauty-facts"
  | "serpapi"
  | "wikimedia";

export interface FilaFicha {
  nombre: string;
  /** El dato que dio el vendedor; `[COMPLETAR]` si falta (nunca una cifra inventada). */
  valor: string;
  unidad?: string;
}

export interface EntradaVitrina {
  /** 1 a 8, como en la tabla de plan-v2.md. */
  numero: number;
  slug: string;
  tematica: TematicaVitrina;
  brief: Brief;
  tecnicas: TecnicaId[];
  numeroSemilla: number;
  /** Solo espaciales: el widget en vivo que va tras el héroe. */
  widget?: { variante: VarianteWidget; titulo: string; contexto: string };
  /** Bancos de medios de los que salen los fondos y la galería, en orden de preferencia. */
  bancos: string[];
  /** Palabras clave (español e inglés) que puntúan qué medio va a cada lugar. */
  claves: string[];
  /** Solo espaciales: bancos de los que sale el dato curioso (`tema` de datos-curiosos.json). */
  temasCuriosos?: string[];
  fuentes: FuenteInvestigacion[];
  /** Consultas para las fuentes de producto. */
  consultas: { shopping?: string; preguntas?: string; openFoodFacts?: string; openBeautyFacts?: string };
  /** Filas propias del producto en la ficha técnica, solo con datos del vendedor o `[COMPLETAR]`; la forma de pago, la garantía y lo que incluye salen del brief. */
  ficha: FilaFicha[];
  /** Título de la ficha, según el producto («Ficha técnica», «Composición»). */
  tituloFicha?: string;
  textoCta: string;
}

export interface EstadoFuente {
  fuente: FuenteInvestigacion;
  estado: "ok" | "omitida" | "fallo";
  detalle?: string;
}

/** Lo que se aprendió en la etapa de investigación: sirve de contexto al prompt y de evidencia en el informe. */
export interface InvestigacionVitrina {
  consultadoEn: string;
  fuentes: EstadoFuente[];
  /** Preguntas reales de la gente (SerpAPI), para el FAQ. */
  preguntas: string[];
  /** Precios de referencia del mercado; nunca se copian a la oferta. */
  preciosReferencia: { titulo: string; precio: number; tienda: string | null }[];
  /** Composición de productos parecidos en Open Food Facts / Open Beauty Facts (solo referencia). */
  composicionReferencia: { fuente: string; nombre: string; ingredientes: string }[];
  /** Estado del widget al construir (solo comprueba que la fuente responde; la landing lo pide en vivo). */
  widget?: { variante: VarianteWidget; responde: boolean };
}
