import { z } from "zod";
import type { MetaSeccion } from "../meta";

export const DISPOSICIONES_BENEFICIOS = [
  "lista-grande",
  "tarjetas-apiladas",
  "numerada",
  "carrusel",
  "imagen-alterna",
] as const;

export const ajustes = z.object({
  titulo: z.string().min(1).max(80),
  disposicion: z.enum(DISPOSICIONES_BENEFICIOS),
});
export type Ajustes = z.infer<typeof ajustes>;

export const bloqueBeneficio = z.object({
  id: z.string().min(1),
  tipo: z.literal("beneficio"),
  ajustes: z.object({
    icono: z.string().min(1),
    titulo: z.string().min(1).max(60),
    texto: z.string().min(1).max(200),
    /** Slot opcional de `doc.assets`. */
    imagen: z.string().min(1).optional(),
  }),
});
export type BloqueBeneficio = z.infer<typeof bloqueBeneficio>;

export const bloques = z.array(bloqueBeneficio).min(3).max(6);
export type Bloques = z.infer<typeof bloques>;

export const schema = z.object({ ajustes, bloques });

export const meta: MetaSeccion<keyof Ajustes, BloqueBeneficio["tipo"]> = {
  ajustes: {
    titulo: { etiqueta: "Título", control: "texto", porDefecto: "Lo que cambia en tu día" },
    disposicion: {
      etiqueta: "Disposición",
      control: "select",
      porDefecto: "lista-grande",
      opcionesSoloEditor: ["imagen-alterna"],
      opciones: [
        { valor: "lista-grande", etiqueta: "Lista grande" },
        { valor: "tarjetas-apiladas", etiqueta: "Tarjetas apiladas" },
        { valor: "numerada", etiqueta: "Numerada" },
        { valor: "carrusel", etiqueta: "Carrusel" },
        { valor: "imagen-alterna", etiqueta: "Imagen alterna" },
      ],
    },
  },
  bloques: {
    beneficio: {
      etiqueta: "Beneficio",
      min: 3,
      max: 6,
      campos: {
        icono: { etiqueta: "Icono", control: "texto", porDefecto: "check" },
        titulo: { etiqueta: "Título", control: "texto", porDefecto: "Beneficio" },
        texto: { etiqueta: "Texto", control: "textoLargo", porDefecto: "Cuenta qué gana la persona." },
        imagen: { etiqueta: "Imagen", control: "slot", porDefecto: "", opcional: true },
      },
    },
  },
};
