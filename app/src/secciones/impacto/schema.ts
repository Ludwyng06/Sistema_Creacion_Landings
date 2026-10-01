import { z } from "zod";
import type { MetaSeccion } from "../meta";
import { NumeroODato, Slot } from "../comun";

export const ajustes = z.object({
  titulo: z.string().min(1).max(90),
  texto: z.string().max(280).optional(),
  imagen: Slot,
  /** Variante «meta»: lo que se ha logrado y lo que se busca, ambos del brief o `[COMPLETAR]`. */
  logrado: NumeroODato.optional(),
  meta: NumeroODato.optional(),
  unidadMeta: z.string().max(30).optional(),
});
export type Ajustes = z.infer<typeof ajustes>;

export const bloqueDato = z.object({
  id: z.string().min(1),
  tipo: z.literal("dato"),
  ajustes: z.object({
    /** Cifra real del brief, o `[COMPLETAR]`. Nunca se inventa. */
    valor: NumeroODato,
    etiqueta: z.string().min(1).max(60),
    unidad: z.string().max(20).optional(),
  }),
});
export type BloqueDato = z.infer<typeof bloqueDato>;

export const bloques = z.array(bloqueDato).min(2).max(4);
export type Bloques = z.infer<typeof bloques>;

export const schema = z.object({ ajustes, bloques });

export const meta: MetaSeccion<keyof Ajustes, BloqueDato["tipo"]> = {
  ajustes: {
    titulo: { etiqueta: "Título", control: "texto", porDefecto: "Lo que logramos juntos" },
    texto: { etiqueta: "Texto", control: "textoLargo", porDefecto: "", opcional: true },
    imagen: { etiqueta: "Imagen", control: "slot", porDefecto: "impacto-imagen" },
    logrado: { etiqueta: "Logrado (variante meta)", control: "numero", porDefecto: "[COMPLETAR]", opcional: true },
    meta: { etiqueta: "Meta (variante meta)", control: "numero", porDefecto: "[COMPLETAR]", opcional: true },
    unidadMeta: { etiqueta: "Unidad de la meta", control: "texto", porDefecto: "", opcional: true },
  },
  bloques: {
    dato: {
      etiqueta: "Dato",
      min: 2,
      max: 4,
      campos: {
        valor: { etiqueta: "Cifra", control: "numero", porDefecto: "[COMPLETAR]", ayuda: "Solo cifras reales del brief." },
        etiqueta: { etiqueta: "Qué mide", control: "texto", porDefecto: "Personas ayudadas" },
        unidad: { etiqueta: "Unidad", control: "texto", porDefecto: "", opcional: true },
      },
    },
  },
};
