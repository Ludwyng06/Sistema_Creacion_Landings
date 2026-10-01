import { z } from "zod";
import type { MetaSeccion } from "../meta";
import { Slot } from "../comun";

export const ajustes = z.object({
  titulo: z.string().min(1).max(80),
  texto: z.string().min(1).max(240),
  /** Imagen del empaque o del regalo. */
  imagen: Slot,
});
export type Ajustes = z.infer<typeof ajustes>;

export const bloqueItem = z.object({
  id: z.string().min(1),
  tipo: z.literal("item"),
  ajustes: z.object({ texto: z.string().min(1).max(100) }),
});
export type BloqueItem = z.infer<typeof bloqueItem>;

export const bloques = z.array(bloqueItem).min(1).max(5);
export type Bloques = z.infer<typeof bloques>;

export const schema = z.object({ ajustes, bloques });

export const meta: MetaSeccion<keyof Ajustes, BloqueItem["tipo"]> = {
  ajustes: {
    titulo: { etiqueta: "Título", control: "texto", porDefecto: "Qué viene en la caja" },
    texto: { etiqueta: "Texto", control: "textoLargo", porDefecto: "" },
    imagen: { etiqueta: "Imagen del empaque", control: "slot", porDefecto: "incluye-empaque" },
  },
  bloques: {
    item: {
      etiqueta: "Elemento incluido",
      min: 1,
      max: 5,
      campos: { texto: { etiqueta: "Texto", control: "texto", porDefecto: "Elemento" } },
    },
  },
};
