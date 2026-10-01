import { z } from "zod";
import type { MetaSeccion } from "../meta";
import { Slot } from "../comun";

export const ajustes = z.object({
  titulo: z.string().min(1).max(80),
  /** Imagen de la persona o la escena a la que le sirve (del banco). */
  imagen: Slot.optional(),
});
export type Ajustes = z.infer<typeof ajustes>;

export const bloquePunto = z.object({
  id: z.string().min(1),
  tipo: z.literal("punto"),
  ajustes: z.object({
    texto: z.string().min(1).max(140),
    /** `true`: es para ti; `false`: no es para ti. */
    aplica: z.boolean(),
  }),
});
export type BloquePunto = z.infer<typeof bloquePunto>;

export const bloques = z.array(bloquePunto).min(3).max(8);
export type Bloques = z.infer<typeof bloques>;

export const schema = z.object({ ajustes, bloques });

export const meta: MetaSeccion<keyof Ajustes, BloquePunto["tipo"]> = {
  ajustes: {
    titulo: { etiqueta: "Título", control: "texto", porDefecto: "Esto es para ti si…" },
    imagen: { etiqueta: "Imagen", control: "slot", porDefecto: "para-quien-imagen", opcional: true },
  },
  bloques: {
    punto: {
      etiqueta: "Punto",
      min: 3,
      max: 8,
      campos: {
        texto: { etiqueta: "Texto", control: "texto", porDefecto: "Te pasa esto a diario" },
        aplica: { etiqueta: "Es para ti", control: "booleano", porDefecto: true, ayuda: "Apagado, aparece como «No es para ti»." },
      },
    },
  },
};
