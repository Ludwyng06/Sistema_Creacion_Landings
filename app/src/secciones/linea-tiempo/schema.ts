import { z } from "zod";
import type { MetaSeccion } from "../meta";
import { Slot } from "../comun";

export const ajustes = z.object({
  titulo: z.string().min(1).max(90),
  intro: z.string().max(240).optional(),
});
export type Ajustes = z.infer<typeof ajustes>;

export const bloqueHito = z.object({
  id: z.string().min(1),
  tipo: z.literal("hito"),
  ajustes: z.object({
    /** Año, fecha o etapa («1957», «Hoy»). Sale de una fuente; si falta, `[COMPLETAR]`. */
    cuando: z.string().min(1).max(30),
    titulo: z.string().min(1).max(80),
    texto: z.string().max(220).optional(),
    imagen: Slot.optional(),
  }),
});
export type BloqueHito = z.infer<typeof bloqueHito>;

export const bloques = z.array(bloqueHito).min(3).max(8);
export type Bloques = z.infer<typeof bloques>;

export const schema = z.object({ ajustes, bloques });

export const meta: MetaSeccion<keyof Ajustes, BloqueHito["tipo"]> = {
  ajustes: {
    titulo: { etiqueta: "Título", control: "texto", porDefecto: "Cómo llegamos hasta aquí" },
    intro: { etiqueta: "Introducción", control: "textoLargo", porDefecto: "", opcional: true },
  },
  bloques: {
    hito: {
      etiqueta: "Hito",
      min: 3,
      max: 8,
      campos: {
        cuando: { etiqueta: "Cuándo", control: "texto", porDefecto: "[COMPLETAR]", ayuda: "Solo fechas de una fuente real." },
        titulo: { etiqueta: "Qué pasó", control: "texto", porDefecto: "Hito" },
        texto: { etiqueta: "Detalle", control: "textoLargo", porDefecto: "", opcional: true },
        imagen: { etiqueta: "Imagen", control: "slot", porDefecto: "", opcional: true },
      },
    },
  },
};
