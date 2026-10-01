import { z } from "zod";
import { CategoriaBrief, type NivelConciencia } from "./brief";

// Forma de la respuesta de `POST /api/investigar` (tarea 09-A), compartida con la interfaz de `/crear`.

/** De dónde salió un dato: el nombre del sitio y el enlace. Todo lo investigado lleva al menos una. */
export const Fuente = z.object({ url: z.string().min(1), sitio: z.string().min(1) });
export type Fuente = z.infer<typeof Fuente>;

/**
 * Una sugerencia suelta (beneficio, objeción o pregunta). Nunca entra sola al brief: la persona la acepta, la edita o la descarta.
 * Si trae una cifra (precio, calificación, porcentaje, fecha), el número ya viene reemplazado por `[COMPLETAR]` y `tieneCifra` es `true`:
 * la interfaz avisa «Verifícalo con tu proveedor».
 */
export const Sugerencia = z.object({
  texto: z.string().min(1),
  fuentes: z.array(Fuente).min(1),
  tieneCifra: z.boolean(),
});
export type Sugerencia = z.infer<typeof Sugerencia>;

export const Sugerencias = z.object({
  beneficios: z.array(Sugerencia),
  objeciones: z.array(Sugerencia),
  preguntas: z.array(Sugerencia),
});
export type Sugerencias = z.infer<typeof Sugerencias>;

/** De dónde sale un campo del borrador: de la foto (colores, categoría, la imagen misma), de la búsqueda o de ambas. */
export const OrigenCampo = z.enum(["foto", "busqueda", "foto+busqueda"]);
export type OrigenCampo = z.infer<typeof OrigenCampo>;

/** Un campo propuesto del brief: valor, fuentes (vacías si viene de la foto) y confianza de 0 a 1. */
export interface CampoBorrador<T> {
  valor: T;
  fuentes: Fuente[];
  confianza: number;
  origen: OrigenCampo;
}

/**
 * Borrador del `Brief`. **Solo** existen los campos que se pueden proponer: `precio`, `pruebaSocial`, `oferta` y `garantia`
 * no aparecen nunca (la persona los escribe). Un campo sin dato se omite.
 */
export interface BorradorBrief {
  categoria?: CampoBorrador<CategoriaBrief>;
  problema?: CampoBorrador<string>;
  publico?: CampoBorrador<string>;
  /** De 1 a 5 beneficios, sin cifras. */
  beneficios?: CampoBorrador<string[]>;
  objeciones?: CampoBorrador<string[]>;
  /** Solo si aparece en las fuentes. */
  incluye?: CampoBorrador<string[]>;
  nivelConciencia?: CampoBorrador<NivelConciencia> & { motivo: string };
  /** Hasta 3 colores hex dominantes de la foto (sharp, sin IA). */
  coloresMarca?: CampoBorrador<string[]>;
  /** La foto subida, como ruta pública (`/media/investigar/<id>.webp`). */
  fotos?: CampoBorrador<string[]>;
}

/** Lo que la IA vio en la foto. Si `reconocido` es `false`, la investigación siguió solo con el nombre. */
export const Identificacion = z.object({
  reconocido: z.boolean(),
  tipoProducto: z.string(),
  categoriaSugerida: CategoriaBrief,
  rasgosVisibles: z.array(z.string()),
  consultas: z.array(z.string()),
  confianza: z.number().min(0).max(1),
});
export type Identificacion = z.infer<typeof Identificacion>;

/** Rango de precios que se ve en las fuentes. **Solo informativo**: nunca entra al brief. */
export interface PrecioReferencia {
  min: number;
  max: number;
  moneda: "COP" | "USD" | "MXN" | "EUR";
  fuentes: Fuente[];
}

export interface CuotaSerpApi {
  usadasMes: number;
  limiteMes: number;
}

/**
 * Respuesta de `POST /api/investigar` (200).
 * - `sugerencias` y `consultas`: lo que pedía la tarea (beneficios, objeciones y preguntas con fuente).
 * - `usadas`: búsquedas de SerpAPI que **gastó esta petición** (0 si todo salió de la caché de 7 días; máximo 3).
 * - `cuota`: uso del mes contra el plan (de `account.json`, que no gasta búsquedas); `null` si no se pudo leer.
 * - `borrador`, `identificacion`, `precioReferencia`: la ampliación foto + nombre → brief pre-llenado.
 * - `avisos`: cosas que la persona debe saber (la foto no se reconoció, una búsqueda falló…).
 */
export interface RespuestaInvestigar {
  sugerencias: Sugerencias;
  consultas: string[];
  usadas: number;
  cuota: CuotaSerpApi | null;
  borrador: BorradorBrief;
  identificacion: Identificacion | null;
  precioReferencia: PrecioReferencia | null;
  avisos: string[];
}
