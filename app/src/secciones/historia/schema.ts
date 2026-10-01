import { z } from "zod";
import type { MetaSeccion } from "../meta";
import { Slot } from "../comun";

export const ajustes = z.object({
  titulo: z.string().min(1).max(90),
  /** La escena: el momento en que la persona se dio cuenta. */
  historia: z.string().min(1).max(500),
  /** Punto de inflexión: por qué lo anterior no funcionó, sin culpa. */
  giro: z.string().max(240).optional(),
  imagen: Slot,
});
export type Ajustes = z.infer<typeof ajustes>;

export const bloqueIntento = z.object({
  id: z.string().min(1),
  tipo: z.literal("intento"),
  ajustes: z.object({ texto: z.string().min(1).max(120) }),
});
export type BloqueIntento = z.infer<typeof bloqueIntento>;

export const bloques = z.array(bloqueIntento).min(0).max(4);
export type Bloques = z.infer<typeof bloques>;

export const schema = z.object({ ajustes, bloques });

export const meta: MetaSeccion<keyof Ajustes, BloqueIntento["tipo"]> = {
  ajustes: {
    titulo: { etiqueta: "Título", control: "texto", porDefecto: "Lo que ya probaste" },
    historia: { etiqueta: "La escena", control: "textoLargo", porDefecto: "" },
    giro: { etiqueta: "Punto de inflexión", control: "textoLargo", porDefecto: "", opcional: true },
    imagen: { etiqueta: "Imagen de ambiente", control: "slot", porDefecto: "historia-imagen" },
  },
  bloques: {
    intento: { etiqueta: "Lo que ya probaste", min: 0, max: 4, campos: { texto: { etiqueta: "Texto", control: "texto", porDefecto: "Estiramientos que duran un día" } } },
  },
};
