import { z } from "zod";
import type { MetaSeccion } from "../meta";
import { SinBloques, Slot } from "../comun";

export const ajustes = z.object({
  titulo: z.string().min(1).max(100),
  imagenAntes: Slot,
  imagenDespues: Slot,
  etiquetaAntes: z.string().min(1).max(30),
  etiquetaDespues: z.string().min(1).max(30),
});
export type Ajustes = z.infer<typeof ajustes>;

export const bloques = SinBloques;
export type Bloques = z.infer<typeof bloques>;

export const schema = z.object({ ajustes, bloques });

export const meta: MetaSeccion<keyof Ajustes, never> = {
  ajustes: {
    titulo: { etiqueta: "Título", control: "texto", porDefecto: "Mira la diferencia" },
    imagenAntes: { etiqueta: "Imagen de antes", control: "slot", porDefecto: "antes" },
    imagenDespues: { etiqueta: "Imagen de después", control: "slot", porDefecto: "despues" },
    etiquetaAntes: { etiqueta: "Etiqueta de antes", control: "texto", porDefecto: "Antes" },
    etiquetaDespues: { etiqueta: "Etiqueta de después", control: "texto", porDefecto: "Después" },
  },
  bloques: {},
};
