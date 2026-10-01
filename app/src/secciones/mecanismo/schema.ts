import { z } from "zod";
import type { MetaSeccion } from "../meta";
import { Slot } from "../comun";

export const ajustes = z.object({
  titulo: z.string().min(1).max(90),
  /** «Pensabas que…» */
  creencia: z.string().min(1).max(160),
  /** «Pero en realidad…» */
  realidad: z.string().min(1).max(200),
  imagen: Slot,
});
export type Ajustes = z.infer<typeof ajustes>;

export const bloqueNota = z.object({
  id: z.string().min(1),
  tipo: z.literal("nota"),
  ajustes: z.object({
    titulo: z.string().min(1).max(50),
    texto: z.string().max(140).optional(),
    /** Posición del punto sobre la imagen, en porcentaje (solo `zoom-detalle`). */
    x: z.number().min(0).max(100).optional(),
    y: z.number().min(0).max(100).optional(),
  }),
});
export type BloqueNota = z.infer<typeof bloqueNota>;

export const bloques = z.array(bloqueNota).min(0).max(4);
export type Bloques = z.infer<typeof bloques>;

export const schema = z.object({ ajustes, bloques });

export const meta: MetaSeccion<keyof Ajustes, BloqueNota["tipo"]> = {
  ajustes: {
    titulo: { etiqueta: "Título", control: "texto", porDefecto: "Cómo funciona por dentro" },
    creencia: { etiqueta: "Pensabas que…", control: "texto", porDefecto: "Todos los correctores incomodan" },
    realidad: { etiqueta: "Pero en realidad…", control: "textoLargo", porDefecto: "Este avisa con una vibración suave" },
    imagen: { etiqueta: "Imagen", control: "slot", porDefecto: "mecanismo-imagen" },
  },
  bloques: {
    nota: {
      etiqueta: "Anotación",
      min: 0,
      max: 4,
      campos: {
        titulo: { etiqueta: "Título", control: "texto", porDefecto: "Detalle" },
        texto: { etiqueta: "Texto", control: "texto", porDefecto: "", opcional: true },
        x: { etiqueta: "Posición horizontal (%)", control: "numero", porDefecto: 50, opcional: true },
        y: { etiqueta: "Posición vertical (%)", control: "numero", porDefecto: 50, opcional: true },
      },
    },
  },
};
