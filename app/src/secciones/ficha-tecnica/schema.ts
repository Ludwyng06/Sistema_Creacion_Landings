import { z } from "zod";
import type { MetaSeccion } from "../meta";

export const ajustes = z.object({
  titulo: z.string().min(1).max(80),
});
export type Ajustes = z.infer<typeof ajustes>;

export const bloqueEspecificacion = z.object({
  id: z.string().min(1),
  tipo: z.literal("especificacion"),
  ajustes: z.object({
    nombre: z.string().min(1).max(40),
    /** Dato del brief; si falta va `[COMPLETAR]`. */
    valor: z.union([z.string().min(1).max(60), z.number()]),
    unidad: z.string().max(12).optional(),
  }),
});
export type BloqueEspecificacion = z.infer<typeof bloqueEspecificacion>;

export const bloques = z.array(bloqueEspecificacion).min(4).max(12);
export type Bloques = z.infer<typeof bloques>;

export const schema = z.object({ ajustes, bloques });

export const meta: MetaSeccion<keyof Ajustes, BloqueEspecificacion["tipo"]> = {
  ajustes: {
    titulo: { etiqueta: "Título", control: "texto", porDefecto: "Ficha técnica" },
  },
  bloques: {
    especificacion: {
      etiqueta: "Especificación",
      min: 4,
      max: 12,
      campos: {
        nombre: { etiqueta: "Nombre", control: "texto", porDefecto: "Medida" },
        valor: { etiqueta: "Valor", control: "texto", porDefecto: "[COMPLETAR]", ayuda: "Solo datos del brief." },
        unidad: { etiqueta: "Unidad", control: "texto", porDefecto: "", opcional: true },
      },
    },
  },
};
