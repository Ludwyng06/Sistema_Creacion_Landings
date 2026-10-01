import { z } from "zod";
import type { MetaSeccion } from "../meta";
import { Slot } from "../comun";

export const ajustes = z.object({
  titulo: z.string().min(1).max(80),
  disposicion: z.enum(["carrusel", "mosaico", "historias", "carrusel-deslizante"]),
});
export type Ajustes = z.infer<typeof ajustes>;

export const bloqueImagen = z.object({
  id: z.string().min(1),
  tipo: z.literal("imagen"),
  ajustes: z.object({
    slot: Slot,
    pie: z.string().max(100).optional(),
  }),
});
export type BloqueImagen = z.infer<typeof bloqueImagen>;

export const bloques = z.array(bloqueImagen).min(3).max(8);
export type Bloques = z.infer<typeof bloques>;

export const schema = z.object({ ajustes, bloques });

export const meta: MetaSeccion<keyof Ajustes, BloqueImagen["tipo"]> = {
  ajustes: {
    titulo: { etiqueta: "Título", control: "texto", porDefecto: "Míralo de cerca" },
    disposicion: {
      etiqueta: "Disposición",
      control: "select",
      porDefecto: "mosaico",
      opcionesSoloEditor: ["carrusel-deslizante"],
      opciones: [
        { valor: "carrusel", etiqueta: "Carrusel" },
        { valor: "mosaico", etiqueta: "Mosaico" },
        { valor: "historias", etiqueta: "Historias" },
        { valor: "carrusel-deslizante", etiqueta: "Carrusel con miniaturas" },
      ],
    },
  },
  bloques: {
    imagen: {
      etiqueta: "Imagen",
      min: 3,
      max: 8,
      campos: {
        slot: { etiqueta: "Imagen", control: "slot", porDefecto: "galeria-1" },
        pie: { etiqueta: "Pie de foto", control: "texto", porDefecto: "", opcional: true },
      },
    },
  },
};
