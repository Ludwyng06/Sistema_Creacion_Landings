import { z } from "zod";
import type { MetaSeccion } from "../meta";

// La `variante` vive en la sección (contrato), no en los ajustes.
export const ajustes = z.object({
  titular: z.string().min(1).max(120),
  subtitular: z.string().max(240).optional(),
  textoBoton: z.string().min(1).max(40),
  /** Nombre del slot de `doc.assets` (imagen o video). */
  slot: z.string().min(1).optional(),
  /**
   * Slots adicionales: antes y después (antes-despues-heroe), el collage (mosaico-editorial) o, en `producto-monumental`,
   * `poster-a-sangre` y `video-inmersivo`, el fondo del banco en `slots[0]` (con `slot` como el producto en primer plano).
   */
  slots: z.array(z.string().min(1)).max(5).optional(),
  /** Solo con un dato real del brief (calificación, reconocimiento); nunca inventado. */
  sello: z.string().max(80).optional(),
});
export type Ajustes = z.infer<typeof ajustes>;

export const bloqueBeneficioCorto = z.object({
  id: z.string().min(1),
  tipo: z.literal("beneficio-corto"),
  ajustes: z.object({ texto: z.string().min(1).max(60) }),
});
export type BloqueBeneficioCorto = z.infer<typeof bloqueBeneficioCorto>;

export const bloques = z.array(bloqueBeneficioCorto).max(4);
export type Bloques = z.infer<typeof bloques>;

export const schema = z.object({ ajustes, bloques });

export const meta: MetaSeccion<keyof Ajustes, BloqueBeneficioCorto["tipo"]> = {
  ajustes: {
    titular: { etiqueta: "Titular", control: "textoLargo", porDefecto: "Titular del héroe" },
    subtitular: { etiqueta: "Subtítulo", control: "textoLargo", porDefecto: "", opcional: true },
    textoBoton: { etiqueta: "Texto del botón", control: "texto", porDefecto: "Quiero el mío" },
    slot: {
      etiqueta: "Imagen o video",
      control: "slot",
      porDefecto: "heroe-producto",
      opcional: true,
      ayuda: "La variante «problema-primero» no usa imagen.",
    },
    slots: {
      etiqueta: "Slots adicionales",
      control: "slot",
      lista: true,
      porDefecto: [],
      opcional: true,
      ayuda: "Antes y después (2), collage (3 a 5) o el fondo del banco (1) en los héroes espaciales, según la variante.",
    },
    sello: {
      etiqueta: "Sello de confianza",
      control: "texto",
      porDefecto: "",
      opcional: true,
      ayuda: "Úsalo solo con un dato real del brief.",
    },
  },
  bloques: {
    "beneficio-corto": {
      etiqueta: "Beneficio corto",
      min: 0,
      max: 4,
      campos: { texto: { etiqueta: "Texto", control: "texto", porDefecto: "Beneficio" } },
    },
  },
};
