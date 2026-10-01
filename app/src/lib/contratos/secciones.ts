import type { ComponentType } from "react";
import { z, type ZodType } from "zod";
import type { Seccion, Tokens } from "./landing";

export const TIPOS_SECCION = [
  "heroe",
  "cinta-anuncio",
  "problema-solucion",
  "beneficios",
  "como-funciona",
  "antes-despues",
  "comparativa",
  "galeria",
  "video",
  "testimonios",
  "cifras",
  "oferta",
  "incluye",
  "cuenta-regresiva",
  "faq",
  "garantia",
  "formulario-lead",
  "html-libre",
  "dato-en-vivo",
  "dato-curioso",
  "ficha-tecnica",
  "sellos-confianza",
  "creditos",
  "cta-fija",
  "para-quien",
  "mecanismo",
  "historia",
  "resumen",
  "escena-uso",
  "agenda",
  "ponentes",
  "linea-tiempo",
  "impacto",
] as const;

/** Las 6 secciones que suma la 12-A/12-B (vitrina). El prompt general de construcción no las ofrece: el plan de la vitrina las pide por su cuenta. */
export const TIPOS_SECCION_NUEVOS = ["dato-en-vivo", "dato-curioso", "ficha-tecnica", "sellos-confianza", "creditos", "cta-fija", "para-quien", "mecanismo", "historia", "resumen", "escena-uso", "agenda", "ponentes", "linea-tiempo", "impacto"] as const;
export const TIPOS_SECCION_BASE = TIPOS_SECCION.filter((t) => !(TIPOS_SECCION_NUEVOS as readonly string[]).includes(t));

export const TipoSeccion = z.enum(TIPOS_SECCION);
export type TipoSeccion = z.infer<typeof TipoSeccion>;

export const VARIANTES_HEROE = [
  "producto-monumental",
  "poster-a-sangre",
  "titular-tipografico",
  "problema-primero",
  "antes-despues-heroe",
  "video-inmersivo",
  "orbita-beneficios",
  "mosaico-editorial",
] as const;

export const VarianteHeroe = z.enum(VARIANTES_HEROE);
export type VarianteHeroe = z.infer<typeof VarianteHeroe>;

export type RegistroSeccion = {
  schema: ZodType;
  Componente: ComponentType<{ seccion: Seccion; tokens: Tokens }>;
  etiqueta: string;
  icono: string;
  maxPorLanding: number;
};

export type RegistroSecciones = Partial<Record<TipoSeccion, RegistroSeccion>>;
