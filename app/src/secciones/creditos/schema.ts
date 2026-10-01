import { z } from "zod";
import type { MetaSeccion } from "../meta";
import { SinBloques } from "../comun";

// La lista sale sola de los `Asset` con crédito y licencia: aquí solo se ajusta el título.
export const ajustes = z.object({
  titulo: z.string().min(1).max(60),
});
export type Ajustes = z.infer<typeof ajustes>;

export const bloques = SinBloques;

export const schema = z.object({ ajustes, bloques });

export const meta: MetaSeccion<keyof Ajustes, never> = {
  ajustes: {
    titulo: { etiqueta: "Título", control: "texto", porDefecto: "Créditos de las imágenes", ayuda: "La lista se arma sola con las imágenes que traen crédito y licencia." },
  },
  bloques: {},
};
