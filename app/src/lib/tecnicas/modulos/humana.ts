import type { LandingDoc, ModuloTecnica } from "@/lib/contratos";
import { armarPrompt } from "../armado";
import { error, normalizarTexto, recorrerStrings, resultado, type Problema } from "./util";

const ETIQUETAS_GENERICAS = ["enviar", "saber mas", "click aqui", "clic aqui", "comprar ahora"];
const CLAVES_BOTON = /(?:^|\.)(?:textoBoton|etiquetaBoton|textoCta|cta|boton)$/;
const MIN_PALABRAS_TEXTO_LARGO = 12;
export const FRASE_MIN = 8;
export const FRASE_MAX = 18;

function palabras(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}

/** Longitud media de frase de un texto, en palabras. */
export function longitudMediaFrase(textos: string[]): number | null {
  const frases = textos
    .flatMap((t) => t.split(/[.!?…]+/))
    .map(palabras)
    .filter((n) => n > 0);
  if (frases.length === 0) return null;
  return frases.reduce((a, b) => a + b, 0) / frases.length;
}

export function verificarHumana(doc: LandingDoc) {
  const problemas: Problema[] = [];
  const largos: string[] = [];

  const revisar = (valor: unknown, base: string) => {
    for (const [ruta, texto] of recorrerStrings(valor, base)) {
      if (CLAVES_BOTON.test(ruta)) {
        if (ETIQUETAS_GENERICAS.includes(normalizarTexto(texto))) {
          problemas.push(error(ruta, `La etiqueta «${texto}» es genérica: usa un texto con beneficio.`));
        }
      } else if (palabras(texto) >= MIN_PALABRAS_TEXTO_LARGO && texto !== "[COMPLETAR]") {
        largos.push(texto);
      }
    }
  };
  doc.secciones.forEach((s, i) => {
    revisar(s.ajustes, `secciones[${i}].ajustes`);
    s.bloques.forEach((b, j) => revisar(b.ajustes, `secciones[${i}].bloques[${j}].ajustes`));
  });

  const media = longitudMediaFrase(largos);
  if (media !== null && (media < FRASE_MIN || media > FRASE_MAX)) {
    problemas.push(
      error("secciones", `La longitud media de frase es ${media.toFixed(1)} palabras y debe estar entre ${FRASE_MIN} y ${FRASE_MAX}.`),
    );
  }
  return resultado(problemas);
}

export const tecnicaHumana: ModuloTecnica = {
  id: "humana",
  numero: 8,
  nombre: "Redacción humana",
  fase: "entregar",
  descripcionCorta: "Voz en español neutro, historia antes que características y botones que prometen un beneficio.",
  prioridad: 7,
  aporta: {
    rol: "Eres redactor de respuesta directa con voz humana en español neutro.",
    tarea: [
      "Escribe en español neutro y en segunda persona (tú), con frases de 8 a 18 palabras, verbos concretos, un dato por afirmación y cero relleno.",
      "En la sección `problema-solucion` narra primero la frustración concreta y el alivio, y presenta las características después.",
      "Redacta botones que prometen un beneficio o reducen la ansiedad, por ejemplo «Quiero el mío» o «Quiero que me contacten hoy».",
    ],
    contexto: [
      "Pauta de voz: segunda persona, presente, cifras exactas del brief y una idea por frase; los ejemplos A y B muestran el registro esperado para el copy y los botones.",
    ],
    formato: [
      "Cada `textoBoton` promete un beneficio y los textos largos promedian entre 8 y 18 palabras por frase.",
    ],
  },
  generarPromptIndividual(brief, semilla) {
    return armarPrompt({ brief, modulos: [tecnicaHumana], semilla, modo: "individual" });
  },
  verificador: verificarHumana,
};
