import { lintearDoc } from "@/lib/tecnicas/lista-negra";
import { resultadoDe, type Validador } from "./comun";

/** Envuelve `lintearDoc`: rojo con cualquier infracción. */
export const validarListaNegra: Validador = (doc) => ({
  resultado: resultadoDe(
    "lista-negra",
    lintearDoc(doc).map((i) => ({ ruta: i.ruta, mensaje: `${i.regla}: «${i.fragmento}»` })),
    "rojo",
  ),
});
