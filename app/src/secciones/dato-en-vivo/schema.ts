import { z } from "zod";
import type { MetaSeccion } from "../meta";
import { SinBloques } from "../comun";

export const ajustes = z.object({
  titulo: z.string().min(1).max(80),
  /** Una frase que une el dato con el producto (sin cifras nuevas). */
  contexto: z.string().max(140).optional(),
});
export type Ajustes = z.infer<typeof ajustes>;

export const bloques = SinBloques;

export const schema = z.object({ ajustes, bloques });

export const meta: MetaSeccion<keyof Ajustes, never> = {
  ajustes: {
    titulo: { etiqueta: "Título", control: "texto", porDefecto: "Así está el cielo ahora" },
    contexto: {
      etiqueta: "Frase del producto",
      control: "texto",
      porDefecto: "",
      opcional: true,
      ayuda: "Conecta el dato con el producto. El widget se elige con la variante.",
    },
  },
  bloques: {},
};
