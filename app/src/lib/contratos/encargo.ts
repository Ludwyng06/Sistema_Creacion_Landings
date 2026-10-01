import { z } from "zod";

// Encargo de /crear y brief general de la fase 2 (docs/bitacora/tarea-16.md). Aprobado por el orquestador.

export const TIPOS_LANDING = ["producto", "servicio", "evento", "divulgacion", "curso", "app", "causa", "local"] as const;
export const TipoLanding = z.enum(TIPOS_LANDING);
export type TipoLanding = z.infer<typeof TipoLanding>;

export const TEMATICAS = ["espacio", "producto", "alimentos", "belleza", "tecnologia", "general"] as const;
export const Tematica = z.enum(TEMATICAS);
export type Tematica = z.infer<typeof Tematica>;

export const Encargo = z.object({
  descripcion: z.string().trim().min(3, "Cuéntanos qué landing quieres."),
  tipo: TipoLanding.optional(),
  estilo: z.string().optional(),
  paleta: z.string().optional(),
  /** Fotos como data URL (máximo 3). */
  fotos: z.array(z.string()).max(3).optional(),
  link: z.string().optional(),
  /** Datos que la persona fija a mano (marca, precio, fecha, lugar, WhatsApp…). */
  datos: z.record(z.string(), z.string()).optional(),
});
export type Encargo = z.infer<typeof Encargo>;

/** Un dato que el intake recoge, con su origen: lo dijo la persona o viene de una fuente con nombre. Nunca se inventa. */
export const DatoClave = z.object({
  nombre: z.string().min(1).max(60),
  valor: z.string().min(1).max(200),
  origen: z.string().min(1).max(80),
});
export type DatoClave = z.infer<typeof DatoClave>;

export const Faltante = z.object({
  /** Clave en `Encargo.datos` («fecha», «lugar», «precio», «whatsapp»…). */
  clave: z.string().min(1).max(30),
  /** La pregunta que ve la persona. */
  pregunta: z.string().min(3).max(80),
});
export type Faltante = z.infer<typeof Faltante>;

export const BriefGeneral = z.object({
  tipo: TipoLanding,
  nombre: z.string().min(1).max(80),
  tematica: Tematica,
  publico: z.string().min(5).max(240),
  propuesta: z.string().min(10).max(300),
  /** Lo que gana quien compra, asiste, aprende o apoya (3 a 5, sin cifras inventadas). */
  beneficios: z.array(z.string().min(3).max(140)).min(3).max(5),
  datosClave: z.array(DatoClave).max(10),
  /** Lo que cambia la conversión y no se dijo (máximo 3, en orden de importancia). */
  faltantes: z.array(Faltante).max(3),
  // Opcionales por tipo. Solo si la persona los dijo; si no, van a `faltantes`.
  precio: z.number().nonnegative().optional(),
  fecha: z.string().max(80).optional(),
  lugar: z.string().max(120).optional(),
  agenda: z.array(z.object({ cuando: z.string().max(30), titulo: z.string().max(70) })).max(8).optional(),
  ponentes: z.array(z.object({ nombre: z.string().max(60), rol: z.string().max(80) })).max(6).optional(),
  modulos: z.array(z.string().max(80)).max(10).optional(),
  whatsapp: z.string().max(20).optional(),
});
export type BriefGeneral = z.infer<typeof BriefGeneral>;
