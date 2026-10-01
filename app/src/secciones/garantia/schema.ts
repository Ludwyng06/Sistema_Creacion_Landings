import { z } from "zod";
import { COMPLETAR } from "@/componentes/dinero";
import type { MetaSeccion } from "../meta";
import { Slot } from "../comun";
import { NumeroODato } from "../comun";

export const ajustes = z.object({
  titulo: z.string().min(1).max(80),
  /** Imagen de la variante «con imagen» (del banco). */
  imagen: Slot.optional(),
  texto: z.string().min(1).max(280),
  /** Días de garantía del brief, o `[COMPLETAR]`. */
  dias: NumeroODato,
  icono: z.string().min(1),
});
export type Ajustes = z.infer<typeof ajustes>;

export const bloquePromesa = z.object({
  id: z.string().min(1),
  tipo: z.literal("promesa"),
  ajustes: z.object({ texto: z.string().min(1).max(120) }),
});
export type BloquePromesa = z.infer<typeof bloquePromesa>;

export const bloques = z.array(bloquePromesa).min(2).max(4);
export type Bloques = z.infer<typeof bloques>;

export const schema = z.object({ ajustes, bloques });

export const meta: MetaSeccion<keyof Ajustes, BloquePromesa["tipo"]> = {
  ajustes: {
    titulo: { etiqueta: "Título", control: "texto", porDefecto: "Compra sin riesgo" },
    imagen: { etiqueta: "Imagen (variante con imagen)", control: "slot", porDefecto: "garantia-imagen", opcional: true, soloEditor: true },
    texto: { etiqueta: "Texto", control: "textoLargo", porDefecto: "" },
    dias: { etiqueta: "Días de garantía", control: "numero", porDefecto: COMPLETAR, ayuda: "Solo el dato del brief." },
    icono: { etiqueta: "Icono", control: "texto", porDefecto: "escudo" },
  },
  bloques: {
    promesa: {
      etiqueta: "Promesa",
      min: 2,
      max: 4,
      campos: { texto: { etiqueta: "Texto", control: "texto", porDefecto: "Promesa" } },
    },
  },
};
