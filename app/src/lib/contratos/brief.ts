import { z } from "zod";

export const CATEGORIAS_BRIEF = [
  "salud-y-bienestar",
  "hogar",
  "tecnologia",
  "belleza",
  "moda-y-accesorios",
  "mascotas",
  "deporte",
  "cocina",
  "bebes",
  "otro",
] as const;

export const CategoriaBrief = z.enum(CATEGORIAS_BRIEF);
export type CategoriaBrief = z.infer<typeof CategoriaBrief>;

export const NivelConciencia = z.enum(["inconsciente", "problema", "solucion", "producto", "total"]);
export type NivelConciencia = z.infer<typeof NivelConciencia>;

export const Moneda = z.enum(["COP", "USD", "MXN", "EUR"]);
export type Moneda = z.infer<typeof Moneda>;

export const ColorHex = z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Color hex inválido");

export const Brief = z.object({
  nombre: z.string().min(1),
  categoria: CategoriaBrief,
  problema: z.string().min(1),
  publico: z.string().min(1),
  beneficios: z.array(z.string().min(1)).min(3).max(5),
  precio: z.object({
    valor: z.number().nonnegative(),
    anterior: z.number().nonnegative().optional(),
    moneda: Moneda.default("COP"),
  }),
  objeciones: z.array(z.string().min(1)).default([]),
  nivelConciencia: NivelConciencia.default("problema"),
  pruebaSocial: z
    .object({
      calificacion: z.number().min(0).max(5).optional(),
      numOpiniones: z.number().int().nonnegative().optional(),
      testimonios: z
        .array(
          z.object({
            nombre: z.string().min(1),
            ciudad: z.string().optional(),
            texto: z.string().min(1),
            estrellas: z.number().min(1).max(5).optional(),
          }),
        )
        .optional(),
    })
    .optional(),
  oferta: z.object({ descripcion: z.string().min(1), fechaFin: z.iso.datetime({ offset: true }) }).optional(),
  incluye: z.array(z.string().min(1)).optional(),
  garantia: z.object({ dias: z.number().int().positive(), condiciones: z.string().min(1) }).optional(),
  coloresMarca: z.array(ColorHex).optional(),
  intensidad: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(3),
  fotos: z.array(z.string()).optional(),
});
export type Brief = z.infer<typeof Brief>;
