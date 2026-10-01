import { z } from "zod";
import type { MetaSeccion } from "../meta";
import { Slot } from "../comun";

export const ajustes = z.object({
  titulo: z.string().min(1).max(80),
  /** Imagen de la variante «con imagen» (del banco). */
  imagen: Slot.optional(),
});
export type Ajustes = z.infer<typeof ajustes>;

export const bloquePregunta = z.object({
  id: z.string().min(1),
  tipo: z.literal("pregunta"),
  ajustes: z.object({
    pregunta: z.string().min(1).max(140),
    respuesta: z.string().min(1).max(500),
    /** Objeción del comprador que esta pregunta responde. */
    objecion: z.string().max(80).optional(),
  }),
});
export type BloquePregunta = z.infer<typeof bloquePregunta>;

export const bloques = z.array(bloquePregunta).min(3).max(8);
export type Bloques = z.infer<typeof bloques>;

export const schema = z.object({ ajustes, bloques });

export const meta: MetaSeccion<keyof Ajustes, BloquePregunta["tipo"]> = {
  ajustes: {
    titulo: { etiqueta: "Título", control: "texto", porDefecto: "Preguntas frecuentes" },
    imagen: { etiqueta: "Imagen (variante con imagen)", control: "slot", porDefecto: "faq-imagen", opcional: true, soloEditor: true },
  },
  bloques: {
    pregunta: {
      etiqueta: "Pregunta",
      min: 3,
      max: 8,
      campos: {
        pregunta: { etiqueta: "Pregunta", control: "texto", porDefecto: "¿Cómo funciona?" },
        respuesta: { etiqueta: "Respuesta", control: "textoLargo", porDefecto: "[COMPLETAR]" },
        objecion: {
          etiqueta: "Objeción que responde",
          control: "texto",
          porDefecto: "",
          opcional: true,
        },
      },
    },
  },
};
