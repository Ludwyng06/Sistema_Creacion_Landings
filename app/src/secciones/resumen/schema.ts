import { z } from "zod";
import type { MetaSeccion } from "../meta";
import { Slot } from "../comun";

export const ajustes = z.object({
  titulo: z.string().min(1).max(80),
  imagen: Slot.optional(),
  /** Frase de cierre antes del formulario (sin cifras nuevas). */
  cierre: z.string().max(160).optional(),
});
export type Ajustes = z.infer<typeof ajustes>;

export const bloqueItem = z.object({
  id: z.string().min(1),
  tipo: z.literal("item"),
  ajustes: z.object({ texto: z.string().min(1).max(100) }),
});
export type BloqueItem = z.infer<typeof bloqueItem>;

export const bloques = z.array(bloqueItem).min(4).max(8);
export type Bloques = z.infer<typeof bloques>;

export const schema = z.object({ ajustes, bloques });

export const meta: MetaSeccion<keyof Ajustes, BloqueItem["tipo"]> = {
  ajustes: {
    titulo: { etiqueta: "Título", control: "texto", porDefecto: "Todo lo que recibes" },
    imagen: { etiqueta: "Imagen", control: "slot", porDefecto: "resumen-imagen", opcional: true },
    cierre: { etiqueta: "Frase de cierre", control: "texto", porDefecto: "", opcional: true },
  },
  bloques: { item: { etiqueta: "Ítem", min: 4, max: 8, campos: { texto: { etiqueta: "Texto", control: "texto", porDefecto: "Envío a domicilio" } } } },
};
