import { z } from "zod";
import type { MetaSeccion } from "../meta";
import { SinBloques } from "../comun";

export const MAX_HTML = 20000;

export const ajustes = z.object({
  /** HTML propio de la persona; se sanitiza al pintarlo. */
  html: z.string().max(MAX_HTML),
});
export type Ajustes = z.infer<typeof ajustes>;

export const bloques = SinBloques;
export type Bloques = z.infer<typeof bloques>;

export const schema = z.object({ ajustes, bloques });

export const meta: MetaSeccion<keyof Ajustes, never> = {
  // Solo la agrega una persona en el editor: la IA nunca escribe HTML.
  soloHumano: true,
  ajustes: {
    html: {
      etiqueta: "HTML",
      control: "textoLargo",
      porDefecto: "<p>Escribe aquí tu bloque.</p>",
      ayuda: "Se sanitiza: scripts y eventos como onerror se eliminan.",
    },
  },
  bloques: {},
};
