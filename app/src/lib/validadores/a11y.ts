import { CONTRASTE_TEXTO, contraste } from "@/lib/tecnicas/semillas";
import { resultadoDe, type Problema, type Validador } from "./comun";

/** Contraste AA de texto/fondo y acentoTexto/acento, y `alt` en imágenes. Amarillo. */
export const validarA11y: Validador = (doc) => {
  const problemas: Problema[] = [];
  const c = doc.tokens.colores;
  const pares: [string, string, string, string][] = [
    ["tokens.colores.texto", c.texto, c.fondo, "texto sobre fondo"],
    ["tokens.colores.acentoTexto", c.acentoTexto, c.acento, "acentoTexto sobre acento"],
  ];
  for (const [ruta, a, b, nombre] of pares) {
    const r = contraste(a, b);
    if (r < CONTRASTE_TEXTO) {
      problemas.push({
        ruta,
        mensaje: `Contraste ${r.toFixed(2)}:1 en ${nombre}; se necesita ${CONTRASTE_TEXTO}:1. Prueba blanco o negro.`,
      });
    }
  }
  doc.assets.forEach((a, i) => {
    if (a.tipo === "imagen" && !a.alt.trim()) {
      problemas.push({ ruta: `assets[${i}].alt`, mensaje: `La imagen del slot «${a.slot}» no tiene texto alternativo.` });
    }
  });
  return { resultado: resultadoDe("a11y", problemas) };
};
