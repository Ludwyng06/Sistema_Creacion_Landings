import { z } from "zod";
import type { MetaSeccion } from "../meta";
import { Slot } from "../comun";

export const ajustes = z.object({
  titulo: z.string().min(1).max(80),
  disposicion: z.enum(["pasos-verticales", "linea-tiempo", "pasos-con-imagen"]),
  /** Imagen de la disposición «pasos con imagen». */
  imagen: Slot.optional(),
});
export type Ajustes = z.infer<typeof ajustes>;

export const bloquePaso = z.object({
  id: z.string().min(1),
  tipo: z.literal("paso"),
  ajustes: z.object({
    titulo: z.string().min(1).max(60),
    texto: z.string().min(1).max(220),
  }),
});
export type BloquePaso = z.infer<typeof bloquePaso>;

export const bloques = z.array(bloquePaso).min(3).max(4);
export type Bloques = z.infer<typeof bloques>;

export const schema = z.object({ ajustes, bloques });

export const meta: MetaSeccion<keyof Ajustes, BloquePaso["tipo"]> = {
  ajustes: {
    titulo: { etiqueta: "Título", control: "texto", porDefecto: "Cómo funciona" },
    disposicion: {
      etiqueta: "Disposición",
      control: "select",
      porDefecto: "pasos-verticales",
      opcionesSoloEditor: ["pasos-con-imagen"],
      opciones: [
        { valor: "pasos-verticales", etiqueta: "Pasos verticales" },
        { valor: "linea-tiempo", etiqueta: "Línea de tiempo" },
        { valor: "pasos-con-imagen", etiqueta: "Pasos con imagen" },
      ],
    },
    imagen: { etiqueta: "Imagen (pasos con imagen)", control: "slot", porDefecto: "como-funciona-imagen", opcional: true, soloEditor: true },
  },
  bloques: {
    paso: {
      etiqueta: "Paso",
      min: 3,
      max: 4,
      campos: {
        titulo: { etiqueta: "Título", control: "texto", porDefecto: "Paso" },
        texto: { etiqueta: "Texto", control: "textoLargo", porDefecto: "Describe qué hace la persona." },
      },
    },
  },
};
