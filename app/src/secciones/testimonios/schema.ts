import { z } from "zod";
import { COMPLETAR } from "@/componentes/dinero";
import type { MetaSeccion } from "../meta";
import { Slot } from "../comun";

export const ajustes = z.object({
  titulo: z.string().min(1).max(80),
  disposicion: z.enum(["muro", "carrusel", "destacado"]),
});
export type Ajustes = z.infer<typeof ajustes>;

export const bloqueTestimonio = z.object({
  id: z.string().min(1),
  tipo: z.literal("testimonio"),
  // Solo con datos del brief; si faltan, `[COMPLETAR]`.
  ajustes: z.object({
    nombre: z.string().min(1).max(60),
    ciudad: z.string().min(1).max(60),
    texto: z.string().min(1).max(400),
    estrellas: z.union([z.number().int().min(1).max(5), z.literal(COMPLETAR)]),
    foto: Slot.optional(),
  }),
});
export type BloqueTestimonio = z.infer<typeof bloqueTestimonio>;

export const bloques = z.array(bloqueTestimonio).min(3).max(6);
export type Bloques = z.infer<typeof bloques>;

export const schema = z.object({ ajustes, bloques });

export const meta: MetaSeccion<keyof Ajustes, BloqueTestimonio["tipo"]> = {
  ajustes: {
    titulo: { etiqueta: "Título", control: "texto", porDefecto: "Lo que cuentan quienes lo usan" },
    disposicion: {
      etiqueta: "Disposición",
      control: "select",
      porDefecto: "muro",
      opciones: [
        { valor: "muro", etiqueta: "Muro" },
        { valor: "carrusel", etiqueta: "Carrusel" },
        { valor: "destacado", etiqueta: "Destacado" },
      ],
    },
  },
  bloques: {
    testimonio: {
      etiqueta: "Testimonio",
      min: 3,
      max: 6,
      campos: {
        nombre: { etiqueta: "Nombre", control: "texto", porDefecto: COMPLETAR },
        ciudad: { etiqueta: "Ciudad", control: "texto", porDefecto: COMPLETAR },
        texto: {
          etiqueta: "Testimonio",
          control: "textoLargo",
          porDefecto: COMPLETAR,
          ayuda: "Solo testimonios reales del brief.",
        },
        estrellas: { etiqueta: "Estrellas (1 a 5)", control: "numero", porDefecto: COMPLETAR },
        foto: { etiqueta: "Foto", control: "slot", porDefecto: "", opcional: true },
      },
    },
  },
};
