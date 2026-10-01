import { z } from "zod";
import type { MetaSeccion } from "../meta";
import { Slot } from "../comun";

export const ajustes = z.object({
  titulo: z.string().min(1).max(80),
  imagen: Slot.optional(),
});
export type Ajustes = z.infer<typeof ajustes>;

export const bloqueMomento = z.object({
  id: z.string().min(1),
  tipo: z.literal("momento"),
  ajustes: z.object({
    /** Hora, día o tramo («7:00 p. m.», «Día 1»). Sale del brief; si falta, `[COMPLETAR]`. */
    cuando: z.string().min(1).max(30),
    titulo: z.string().min(1).max(70),
    texto: z.string().max(160).optional(),
  }),
});
export type BloqueMomento = z.infer<typeof bloqueMomento>;

export const bloques = z.array(bloqueMomento).min(2).max(8);
export type Bloques = z.infer<typeof bloques>;

export const schema = z.object({ ajustes, bloques });

export const meta: MetaSeccion<keyof Ajustes, BloqueMomento["tipo"]> = {
  ajustes: {
    titulo: { etiqueta: "Título", control: "texto", porDefecto: "Qué vamos a hacer" },
    imagen: { etiqueta: "Imagen", control: "slot", porDefecto: "agenda-imagen", opcional: true },
  },
  bloques: {
    momento: {
      etiqueta: "Momento",
      min: 2,
      max: 8,
      campos: {
        cuando: { etiqueta: "Hora o día", control: "texto", porDefecto: "[COMPLETAR]", ayuda: "Solo datos del brief." },
        titulo: { etiqueta: "Qué pasa", control: "texto", porDefecto: "Actividad" },
        texto: { etiqueta: "Detalle", control: "texto", porDefecto: "", opcional: true },
      },
    },
  },
};
