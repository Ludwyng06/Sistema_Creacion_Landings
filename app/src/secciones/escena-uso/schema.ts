import { z } from "zod";
import type { MetaSeccion } from "../meta";
import { Slot } from "../comun";

export const ajustes = z.object({
  titulo: z.string().min(1).max(80),
  texto: z.string().max(200).optional(),
});
export type Ajustes = z.infer<typeof ajustes>;

export const bloqueFoto = z.object({
  id: z.string().min(1),
  tipo: z.literal("foto"),
  ajustes: z.object({ slot: Slot, pie: z.string().max(80).optional() }),
});
export type BloqueFoto = z.infer<typeof bloqueFoto>;

export const bloques = z.array(bloqueFoto).min(1).max(3);
export type Bloques = z.infer<typeof bloques>;

export const schema = z.object({ ajustes, bloques });

export const meta: MetaSeccion<keyof Ajustes, BloqueFoto["tipo"]> = {
  ajustes: {
    titulo: { etiqueta: "Título", control: "texto", porDefecto: "En tu vida real" },
    texto: { etiqueta: "Texto", control: "textoLargo", porDefecto: "", opcional: true },
  },
  bloques: {
    foto: {
      etiqueta: "Foto",
      min: 1,
      max: 3,
      campos: {
        slot: { etiqueta: "Imagen", control: "slot", porDefecto: "escena-1" },
        pie: { etiqueta: "Pie de foto", control: "texto", porDefecto: "", opcional: true },
      },
    },
  },
};
