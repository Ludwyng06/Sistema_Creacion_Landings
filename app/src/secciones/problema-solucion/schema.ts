import { z } from "zod";
import type { MetaSeccion } from "../meta";
import { SinBloques, Slot, contarPalabras } from "../comun";

export const MAX_PALABRAS_HISTORIA = 90;

export const ajustes = z.object({
  titulo: z.string().min(1).max(100),
  historia: z
    .string()
    .min(1)
    .refine((texto) => contarPalabras(texto) <= MAX_PALABRAS_HISTORIA, {
      message: `La historia no puede pasar de ${MAX_PALABRAS_HISTORIA} palabras`,
    }),
  giro: z.string().min(1).max(200),
  /** Imagen opcional; va siempre debajo del texto, nunca al lado. */
  imagen: Slot.optional(),
});
export type Ajustes = z.infer<typeof ajustes>;

export const bloques = SinBloques;
export type Bloques = z.infer<typeof bloques>;

export const schema = z.object({ ajustes, bloques });

export const meta: MetaSeccion<keyof Ajustes, never> = {
  ajustes: {
    titulo: { etiqueta: "Título", control: "texto", porDefecto: "Una escena que ya conoces" },
    historia: {
      etiqueta: "Historia",
      control: "textoLargo",
      porDefecto: "",
      ayuda: `Máximo ${MAX_PALABRAS_HISTORIA} palabras.`,
    },
    giro: { etiqueta: "Giro hacia la solución", control: "textoLargo", porDefecto: "" },
    imagen: { etiqueta: "Imagen (debajo)", control: "slot", porDefecto: "", opcional: true },
  },
  bloques: {},
};
