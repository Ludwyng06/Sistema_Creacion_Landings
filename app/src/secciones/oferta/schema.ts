import { z } from "zod";
import { COMPLETAR, MONEDAS } from "@/componentes/dinero";
import type { MetaSeccion } from "../meta";
import { Slot } from "../comun";
import { NumeroODato } from "../comun";

export const ajustes = z.object({
  titulo: z.string().min(1).max(80),
  /** Imagen de la variante «con imagen» (del banco). */
  imagen: Slot.optional(),
  precio: NumeroODato,
  precioAnterior: NumeroODato.optional(),
  moneda: z.enum(MONEDAS),
  textoBoton: z.string().min(1).max(40).optional(),
});
export type Ajustes = z.infer<typeof ajustes>;

export const bloqueOpcion = z.object({
  id: z.string().min(1),
  tipo: z.literal("opcion-cantidad"),
  ajustes: z.object({
    unidades: z.number().int().min(1).max(12),
    precio: NumeroODato,
    etiqueta: z.string().max(30).optional(),
  }),
});
export type BloqueOpcion = z.infer<typeof bloqueOpcion>;

export const bloques = z.array(bloqueOpcion).min(1).max(3);
export type Bloques = z.infer<typeof bloques>;

export const schema = z.object({ ajustes, bloques });

// El texto de ahorro no se guarda: se calcula desde `precio` y `precioAnterior` (calcularAhorro).
export const meta: MetaSeccion<keyof Ajustes, BloqueOpcion["tipo"]> = {
  ajustes: {
    titulo: { etiqueta: "Título", control: "texto", porDefecto: "Llévalo hoy" },
    imagen: { etiqueta: "Imagen (variante con imagen)", control: "slot", porDefecto: "oferta-imagen", opcional: true, soloEditor: true },
    precio: { etiqueta: "Precio", control: "numero", porDefecto: COMPLETAR, ayuda: "Solo el precio del brief." },
    precioAnterior: {
      etiqueta: "Precio anterior",
      control: "numero",
      porDefecto: COMPLETAR,
      opcional: true,
      ayuda: "Sin precio anterior no se muestra ahorro.",
    },
    moneda: {
      etiqueta: "Moneda",
      control: "select",
      porDefecto: "COP",
      opciones: MONEDAS.map((valor) => ({ valor, etiqueta: valor })),
    },
    textoBoton: { etiqueta: "Texto del botón", control: "texto", porDefecto: "Quiero aprovecharlo", opcional: true },
  },
  bloques: {
    "opcion-cantidad": {
      etiqueta: "Opción de cantidad",
      min: 1,
      max: 3,
      campos: {
        unidades: { etiqueta: "Unidades", control: "numero", porDefecto: 1 },
        precio: { etiqueta: "Precio", control: "numero", porDefecto: COMPLETAR },
        etiqueta: { etiqueta: "Etiqueta", control: "texto", porDefecto: "", opcional: true },
      },
    },
  },
};
