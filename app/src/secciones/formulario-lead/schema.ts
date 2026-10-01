import { z } from "zod";
import type { MetaSeccion } from "../meta";

import { CAMPOS_LEAD, CAMPOS_POR_DEFECTO, MAX_OBLIGATORIOS, obligatoriosDe } from "./campos";

// Las constantes viven en `campos.ts` (sin zod) para que el componente no arrastre el esquema al navegador.
export { CAMPOS_LEAD, CAMPOS_POR_DEFECTO, MAX_OBLIGATORIOS, obligatoriosDe };
export const CampoLead = z.enum(CAMPOS_LEAD);
export type CampoLead = z.infer<typeof CampoLead>;

export const ajustes = z
  .object({
    titulo: z.string().min(1).max(80),
    subtitulo: z.string().max(200).optional(),
    campos: z.array(CampoLead).min(1),
    /** Si falta, son obligatorios nombre, correo y teléfono (los que estén en `campos`). */
    obligatorios: z.array(CampoLead).max(MAX_OBLIGATORIOS).optional(),
    textoBoton: z.string().min(1).max(40),
    mensajeGracias: z.string().min(1).max(200),
    privacidad: z.string().min(1).max(240),
  })
  .superRefine((valor, ctx) => {
    if (new Set(valor.campos).size !== valor.campos.length) {
      ctx.addIssue({ code: "custom", path: ["campos"], message: "Hay campos repetidos" });
    }
    if (!valor.campos.includes("correo") && !valor.campos.includes("telefono")) {
      ctx.addIssue({
        code: "custom",
        path: ["campos"],
        message: "El formulario necesita correo o teléfono para poder contactar",
      });
    }
    for (const campo of valor.obligatorios ?? []) {
      if (!valor.campos.includes(campo)) {
        ctx.addIssue({
          code: "custom",
          path: ["obligatorios"],
          message: `El campo obligatorio «${campo}» no está en la lista de campos`,
        });
      }
    }
  });
export type Ajustes = z.infer<typeof ajustes>;

export const bloques = z.array(z.never()).max(0);
export type Bloques = z.infer<typeof bloques>;

export const schema = z.object({ ajustes, bloques });

export const meta: MetaSeccion<keyof z.infer<typeof ajustes>, never> = {
  ajustes: {
    titulo: { etiqueta: "Título", control: "texto", porDefecto: "Recibe el tuyo" },
    subtitulo: { etiqueta: "Subtítulo", control: "textoLargo", porDefecto: "", opcional: true },
    campos: {
      etiqueta: "Campos",
      control: "select",
      multiple: true,
      porDefecto: CAMPOS_POR_DEFECTO,
      opciones: [
        { valor: "nombre", etiqueta: "Nombre" },
        { valor: "correo", etiqueta: "Correo" },
        { valor: "telefono", etiqueta: "Teléfono" },
        { valor: "ciudad", etiqueta: "Ciudad" },
        { valor: "mensaje", etiqueta: "Mensaje" },
      ],
    },
    obligatorios: {
      etiqueta: "Campos obligatorios",
      control: "select",
      multiple: true,
      porDefecto: CAMPOS_POR_DEFECTO,
      opcional: true,
      ayuda: `Máximo ${MAX_OBLIGATORIOS}: pedir menos datos convierte más.`,
      opciones: [
        { valor: "nombre", etiqueta: "Nombre" },
        { valor: "correo", etiqueta: "Correo" },
        { valor: "telefono", etiqueta: "Teléfono" },
        { valor: "ciudad", etiqueta: "Ciudad" },
        { valor: "mensaje", etiqueta: "Mensaje" },
      ],
    },
    textoBoton: { etiqueta: "Texto del botón", control: "texto", porDefecto: "Quiero el mío" },
    mensajeGracias: {
      etiqueta: "Mensaje de gracias",
      control: "textoLargo",
      porDefecto: "Gracias, te escribimos muy pronto.",
    },
    privacidad: {
      etiqueta: "Aviso de privacidad",
      control: "textoLargo",
      porDefecto: "Usamos tus datos solo para contactarte sobre este producto.",
    },
  },
  bloques: {},
};
