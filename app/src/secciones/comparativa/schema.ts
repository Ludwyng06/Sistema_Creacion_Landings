import { z } from "zod";
import type { MetaSeccion } from "../meta";

export const ajustes = z.object({
  titulo: z.string().min(1).max(100),
  nombreNuestro: z.string().min(1).max(40),
  nombreOtros: z.string().min(1).max(40),
  estilo: z.enum(["minimal", "resaltado"]),
});
export type Ajustes = z.infer<typeof ajustes>;

const Valor = z.union([z.boolean(), z.string().min(1).max(60)]);

export const bloqueFila = z.object({
  id: z.string().min(1),
  tipo: z.literal("fila"),
  ajustes: z.object({
    caracteristica: z.string().min(1).max(80),
    nuestro: Valor,
    otros: Valor,
  }),
});
export type BloqueFila = z.infer<typeof bloqueFila>;

export const bloques = z.array(bloqueFila).min(4).max(7);
export type Bloques = z.infer<typeof bloques>;

export const schema = z.object({ ajustes, bloques });

export const meta: MetaSeccion<keyof Ajustes, BloqueFila["tipo"]> = {
  ajustes: {
    titulo: { etiqueta: "Título", control: "texto", porDefecto: "Por qué este y no otro" },
    nombreNuestro: { etiqueta: "Nombre de tu producto", control: "texto", porDefecto: "Nuestro" },
    nombreOtros: { etiqueta: "Nombre de la competencia", control: "texto", porDefecto: "Otros" },
    estilo: {
      etiqueta: "Estilo",
      control: "select",
      porDefecto: "minimal",
      opciones: [
        { valor: "minimal", etiqueta: "Minimal" },
        { valor: "resaltado", etiqueta: "Resaltado" },
      ],
    },
  },
  bloques: {
    fila: {
      etiqueta: "Fila",
      min: 4,
      max: 7,
      campos: {
        caracteristica: { etiqueta: "Característica", control: "texto", porDefecto: "Característica" },
        nuestro: { etiqueta: "Nuestro (sí/no o texto)", control: "texto", porDefecto: true },
        otros: { etiqueta: "Otros (sí/no o texto)", control: "texto", porDefecto: false },
      },
    },
  },
};
