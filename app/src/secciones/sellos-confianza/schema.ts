import { z } from "zod";
import type { MetaSeccion } from "../meta";

export const ajustes = z.object({
  titulo: z.string().max(80).optional(),
});
export type Ajustes = z.infer<typeof ajustes>;

export const bloqueSello = z.object({
  id: z.string().min(1),
  tipo: z.literal("sello"),
  ajustes: z.object({
    /** Nombre de un icono SVG del set propio (`Icono`); nunca un emoji. */
    icono: z.string().min(1).max(20).regex(/^[a-z-]+$/, "El icono es un nombre del set, no un emoji"),
    titulo: z.string().min(1).max(32),
    texto: z.string().max(90).optional(),
  }),
});
export type BloqueSello = z.infer<typeof bloqueSello>;

export const bloques = z.array(bloqueSello).min(3).max(5);
export type Bloques = z.infer<typeof bloques>;

export const schema = z.object({ ajustes, bloques });

export const meta: MetaSeccion<keyof Ajustes, BloqueSello["tipo"]> = {
  ajustes: {
    titulo: { etiqueta: "Título (opcional)", control: "texto", porDefecto: "", opcional: true },
  },
  bloques: {
    sello: {
      etiqueta: "Sello",
      min: 3,
      max: 5,
      campos: {
        icono: {
          etiqueta: "Icono",
          control: "select",
          porDefecto: "billete",
          opciones: [
            { valor: "billete", etiqueta: "Billete" },
            { valor: "envio", etiqueta: "Envío" },
            { valor: "escudo", etiqueta: "Escudo" },
            { valor: "retorno", etiqueta: "Retorno" },
            { valor: "candado", etiqueta: "Candado" },
            { valor: "check", etiqueta: "Check" },
          ],
        },
        titulo: { etiqueta: "Sello", control: "texto", porDefecto: "Pagas al recibir" },
        texto: { etiqueta: "Detalle", control: "texto", porDefecto: "", opcional: true },
      },
    },
  },
};
