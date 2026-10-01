import { z } from "zod";
import type { MetaSeccion } from "../meta";
import { SinBloques } from "../comun";

export const ajustes = z.object({
  textos: z.array(z.string().min(1).max(80)).min(1).max(8),
  /** De 1 (lenta) a 10 (rápida). */
  velocidad: z.number().int().min(1).max(10),
  estilo: z.enum(["solido", "contorno"]),
});
export type Ajustes = z.infer<typeof ajustes>;

export const bloques = SinBloques;
export type Bloques = z.infer<typeof bloques>;

export const schema = z.object({ ajustes, bloques });

export const meta: MetaSeccion<keyof Ajustes, never> = {
  ajustes: {
    textos: {
      etiqueta: "Textos de la cinta",
      control: "texto",
      lista: true,
      porDefecto: ["Pide el tuyo hoy"],
      ayuda: "Uno por línea, máximo 8. Sin datos que no estén en el brief.",
    },
    velocidad: { etiqueta: "Velocidad (1 a 10)", control: "numero", porDefecto: 4 },
    estilo: {
      etiqueta: "Estilo",
      control: "select",
      porDefecto: "solido",
      opciones: [
        { valor: "solido", etiqueta: "Sólido" },
        { valor: "contorno", etiqueta: "Contorno" },
      ],
    },
  },
  bloques: {},
};
