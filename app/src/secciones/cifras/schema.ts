import { z } from "zod";
import { COMPLETAR } from "@/componentes/dinero";
import type { MetaSeccion } from "../meta";

export const ajustes = z.object({
  titulo: z.string().min(1).max(80),
});
export type Ajustes = z.infer<typeof ajustes>;

export const bloqueCifra = z.object({
  id: z.string().min(1),
  tipo: z.literal("cifra"),
  // Solo datos reales del brief; si faltan, `[COMPLETAR]`.
  ajustes: z.object({
    valor: z.string().min(1).max(30),
    etiqueta: z.string().min(1).max(80),
  }),
});
export type BloqueCifra = z.infer<typeof bloqueCifra>;

export const bloques = z.array(bloqueCifra).min(2).max(4);
export type Bloques = z.infer<typeof bloques>;

export const schema = z.object({ ajustes, bloques });

export const meta: MetaSeccion<keyof Ajustes, BloqueCifra["tipo"]> = {
  ajustes: {
    titulo: { etiqueta: "Título", control: "texto", porDefecto: "Resultados reales" },
  },
  bloques: {
    cifra: {
      etiqueta: "Cifra",
      min: 2,
      max: 4,
      campos: {
        valor: {
          etiqueta: "Valor",
          control: "texto",
          porDefecto: COMPLETAR,
          ayuda: "Solo cifras reales del brief.",
        },
        etiqueta: { etiqueta: "Qué mide", control: "texto", porDefecto: "Personas que lo probaron" },
      },
    },
  },
};
