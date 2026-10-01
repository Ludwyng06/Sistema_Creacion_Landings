import { z } from "zod";
import { COMPLETAR } from "@/componentes/dinero";
import type { MetaSeccion } from "../meta";
import { SinBloques } from "../comun";

/** Número de WhatsApp con indicativo y solo dígitos (57 y 10 dígitos en Colombia), o `[COMPLETAR]`. */
export const NumeroWhatsapp = z.union([z.string().regex(/^\d{10,15}$/, "Solo dígitos, con indicativo del país"), z.literal(COMPLETAR)]);

export const ajustes = z.object({
  texto: z.string().min(1).max(40),
  /** Solo `whatsapp-flotante`. Sin número, el botón lleva al formulario. */
  whatsapp: NumeroWhatsapp.optional(),
  mensajeWhatsapp: z.string().max(120).optional(),
});
export type Ajustes = z.infer<typeof ajustes>;

export const bloques = SinBloques;

export const schema = z.object({ ajustes, bloques });

export const meta: MetaSeccion<keyof Ajustes, never> = {
  ajustes: {
    texto: { etiqueta: "Texto del botón", control: "texto", porDefecto: "Pídelo y paga al recibir" },
    whatsapp: {
      etiqueta: "WhatsApp",
      control: "texto",
      porDefecto: COMPLETAR,
      opcional: true,
      ayuda: "Con indicativo y solo dígitos. Solo para «WhatsApp flotante».",
    },
    mensajeWhatsapp: { etiqueta: "Mensaje de WhatsApp", control: "texto", porDefecto: "Hola, quiero pedir el producto", opcional: true },
  },
  bloques: {},
};
