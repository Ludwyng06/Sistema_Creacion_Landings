import { z } from "zod";
import type { MetaSeccion } from "../meta";
import { SinBloques, Slot } from "../comun";

/** Solo enlaces web: la fuente nunca puede ser `javascript:` ni un dato incrustado. */
const UrlWeb = z.string().regex(/^https?:\/\/[^\s]+$/i, "La fuente debe ser un enlace http o https");

export const ajustes = z.object({
  titulo: z.string().min(1).max(60),
  frase: z.string().min(10).max(260),
  fuenteNombre: z.string().min(1).max(60),
  fuenteUrl: UrlWeb,
  /** Solo `real-vs-producto`: foto real del banco y la imagen del producto. */
  slotReal: Slot.optional(),
  slotProducto: Slot.optional(),
  etiquetaReal: z.string().max(40).optional(),
  etiquetaProducto: z.string().max(40).optional(),
});
export type Ajustes = z.infer<typeof ajustes>;

export const bloques = SinBloques;

export const schema = z.object({ ajustes, bloques });

export const meta: MetaSeccion<keyof Ajustes, never> = {
  ajustes: {
    titulo: { etiqueta: "Título", control: "texto", porDefecto: "¿Sabías que…?" },
    frase: { etiqueta: "Dato curioso", control: "textoLargo", porDefecto: "", ayuda: "Una frase real, con su fuente." },
    fuenteNombre: { etiqueta: "Nombre de la fuente", control: "texto", porDefecto: "NASA" },
    fuenteUrl: { etiqueta: "Enlace de la fuente", control: "texto", porDefecto: "https://images.nasa.gov" },
    slotReal: { etiqueta: "Foto real", control: "slot", porDefecto: "dato-real", opcional: true, ayuda: "Solo para «real vs. producto»." },
    slotProducto: { etiqueta: "Imagen del producto", control: "slot", porDefecto: "dato-producto", opcional: true },
    etiquetaReal: { etiqueta: "Etiqueta de la foto real", control: "texto", porDefecto: "El cielo real", opcional: true },
    etiquetaProducto: { etiqueta: "Etiqueta del producto", control: "texto", porDefecto: "Con tu producto", opcional: true },
  },
  bloques: {},
};
