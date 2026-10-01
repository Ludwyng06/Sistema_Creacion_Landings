import { z } from "zod";
import type { MetaSeccion } from "../meta";
import { Slot } from "../comun";

export const ajustes = z.object({
  titulo: z.string().min(1).max(80),
});
export type Ajustes = z.infer<typeof ajustes>;

export const bloquePersona = z.object({
  id: z.string().min(1),
  tipo: z.literal("persona"),
  ajustes: z.object({
    nombre: z.string().min(1).max(60),
    rol: z.string().min(1).max(80),
    texto: z.string().max(200).optional(),
    /** Foto real de la persona (subida o de un banco); nunca se inventa. */
    imagen: Slot.optional(),
  }),
});
export type BloquePersona = z.infer<typeof bloquePersona>;

export const bloques = z.array(bloquePersona).min(1).max(6);
export type Bloques = z.infer<typeof bloques>;

export const schema = z.object({ ajustes, bloques });

export const meta: MetaSeccion<keyof Ajustes, BloquePersona["tipo"]> = {
  ajustes: {
    titulo: { etiqueta: "Título", control: "texto", porDefecto: "Quién te acompaña" },
  },
  bloques: {
    persona: {
      etiqueta: "Persona",
      min: 1,
      max: 6,
      campos: {
        nombre: { etiqueta: "Nombre", control: "texto", porDefecto: "[COMPLETAR]" },
        rol: { etiqueta: "Rol", control: "texto", porDefecto: "Guía del evento" },
        texto: { etiqueta: "Presentación", control: "textoLargo", porDefecto: "", opcional: true },
        imagen: { etiqueta: "Foto", control: "slot", porDefecto: "", opcional: true },
      },
    },
  },
};
