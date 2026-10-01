import { VARIANTES_HEROE } from "@/lib/contratos";
import { resultadoDe, type Problema, type Validador } from "./comun";

const DOS_COLUMNAS = /grid-cols-2|flex-row|\bfloat\b/i;

/** Variante de héroe del catálogo y sin `html-libre` que arme dos columnas en el primer viewport. */
export const validarAntiSplit: Validador = (doc) => {
  const problemas: Problema[] = [];
  doc.secciones.forEach((s, i) => {
    if (s.tipo === "heroe" && !(VARIANTES_HEROE as readonly string[]).includes(s.variante ?? "")) {
      problemas.push({
        ruta: `secciones[${i}].variante`,
        mensaje: `Variante de héroe fuera del catálogo: «${s.variante ?? "sin variante"}».`,
      });
    }
    if (s.tipo === "html-libre") {
      if (i === 0) {
        problemas.push({ ruta: `secciones[${i}]`, mensaje: "Un html-libre no puede ser la primera sección: el héroe va primero." });
      } else if (i === 1) {
        const html = typeof s.ajustes.html === "string" ? s.ajustes.html : "";
        if (DOS_COLUMNAS.test(html)) {
          problemas.push({
            ruta: `secciones[${i}].ajustes.html`,
            mensaje: "El html-libre del primer viewport usa clases o estilos de dos columnas (grid-cols-2, flex-row o float).",
          });
        }
      }
    }
  });
  return { resultado: resultadoDe("anti-split", problemas, "rojo") };
};
