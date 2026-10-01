import type { Brief, LandingDoc, ResultadoValidador } from "@/lib/contratos";
import { MSG_ANTI_SPLIT, type ResultadoAntiSplit } from "./anti-split-render";
import { validarA11y } from "./a11y";
import { validarAntiSplit } from "./anti-split";
import type { Validador } from "./comun";
import { validarDatos } from "./datos";
import { validarEfectos } from "./efectos";
import { validarEsquema } from "./esquema";
import { validarEstructura } from "./estructura";
import { validarListaNegra } from "./lista-negra";

export { describirProblemas, crearValidadorEsquema } from "./esquema";
export type { Validador } from "./comun";

/**
 * Última medición del validador de render (`anti-split-render.ts`, de B). Solo se llena en el navegador: el iframe
 * de la vista previa mide el DOM y avisa con `postMessage`. En el servidor no hay DOM, así que queda `null`.
 */
let medicionRender: ResultadoAntiSplit | null = null;

/** Guarda (o borra, con `null`) la medición de render que leerá el validador. */
export function registrarMedicionRender(resultado: ResultadoAntiSplit | null): void {
  medicionRender = resultado;
}

if (typeof window !== "undefined") {
  window.addEventListener("message", (e: MessageEvent) => {
    if (e.origin !== window.location.origin) return;
    const dato = e.data as { tipo?: string; resultado?: ResultadoAntiSplit } | null;
    if (dato?.tipo === MSG_ANTI_SPLIT && dato.resultado) medicionRender = dato.resultado;
  });
}

/** Traduce una medición a salud: sin medir queda «pendiente» (gris); a menos de 1024 px «no aplica» y va en verde. */
export function saludDeMedicionRender(medicion: ResultadoAntiSplit | null): ResultadoValidador {
  if (!medicion) return { id: "anti-split-render", estado: "pendiente", problemas: [] };
  if (medicion.aplica && medicion.split) {
    return {
      id: "anti-split-render",
      estado: "rojo",
      problemas: [{ ruta: "secciones.0", mensaje: medicion.explicacion }],
    };
  }
  return { id: "anti-split-render", estado: "verde", problemas: [] };
}

const antiSplitRender: Validador = () => ({ resultado: saludDeMedicionRender(medicionRender) });

/** Los 8 validadores en el orden de docs/05 §4. */
export const VALIDADORES: Validador[] = [
  validarEsquema,
  validarEstructura,
  validarAntiSplit,
  antiSplitRender,
  validarListaNegra,
  validarDatos,
  validarA11y,
  validarEfectos,
];

/** Corre los validadores en orden, encadenando los documentos corregidos. */
export function validarTodo(doc: LandingDoc, brief?: Brief): { doc: LandingDoc; salud: ResultadoValidador[] } {
  let actual = doc;
  const salud: ResultadoValidador[] = [];
  for (const validar of VALIDADORES) {
    const { resultado, doc: corregido } = validar(actual, brief);
    salud.push(resultado);
    if (corregido) actual = corregido;
  }
  return { doc: actual, salud };
}
