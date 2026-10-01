import { z } from "zod";
import type { MetaSeccion } from "../meta";
import { SinBloques, Slot } from "../comun";

export const ajustes = z.object({
  titulo: z.string().min(1).max(100),
  /** Slot del video en `doc.assets`. */
  slot: Slot,
  /** Slot de la imagen que se ve mientras carga o si no hay reproducción. */
  poster: Slot.optional(),
  /** Silenciado; no arranca solo con `prefers-reduced-motion`. */
  autoplay: z.boolean(),
});
export type Ajustes = z.infer<typeof ajustes>;

export const bloques = SinBloques;
export type Bloques = z.infer<typeof bloques>;

export const schema = z.object({ ajustes, bloques });

export const meta: MetaSeccion<keyof Ajustes, never> = {
  ajustes: {
    titulo: { etiqueta: "Título", control: "texto", porDefecto: "Míralo en uso" },
    slot: { etiqueta: "Video", control: "slot", porDefecto: "video-uso" },
    poster: { etiqueta: "Póster", control: "slot", porDefecto: "", opcional: true },
    autoplay: {
      etiqueta: "Reproducir solo y en silencio",
      control: "booleano",
      porDefecto: true,
    },
  },
  bloques: {},
};
