import { z } from "zod";
import { COMPLETAR } from "@/componentes/dinero";
import type { MetaSeccion } from "../meta";
import { SinBloques } from "../comun";

/** Fecha real de fin de la oferta (ISO 8601) o `[COMPLETAR]` si el brief no la trae. */
export const FechaFin = z.union([
  z.literal(COMPLETAR),
  z.string().refine((valor) => !Number.isNaN(Date.parse(valor)), {
    message: "fechaFin debe ser una fecha válida (ISO 8601)",
  }),
]);

export const ajustes = z.object({
  titulo: z.string().min(1).max(80),
  fechaFin: FechaFin,
  estilo: z.enum(["bloques", "linea"]),
});
export type Ajustes = z.infer<typeof ajustes>;

export const bloques = SinBloques;
export type Bloques = z.infer<typeof bloques>;

export const schema = z.object({ ajustes, bloques });

export const meta: MetaSeccion<keyof Ajustes, never> = {
  ajustes: {
    titulo: { etiqueta: "Título", control: "texto", porDefecto: "La oferta termina en" },
    fechaFin: {
      etiqueta: "Fecha de fin (obligatoria y real)",
      control: "texto",
      porDefecto: COMPLETAR,
      ayuda: "Formato 2026-12-31T23:59:00-05:00. Si ya pasó, la sección no se muestra.",
    },
    estilo: {
      etiqueta: "Estilo",
      control: "select",
      porDefecto: "bloques",
      opciones: [
        { valor: "bloques", etiqueta: "Bloques" },
        { valor: "linea", etiqueta: "Una línea" },
      ],
    },
  },
  bloques: {},
};
