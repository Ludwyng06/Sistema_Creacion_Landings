import type { Brief, LandingDoc, ModuloTecnica } from "@/lib/contratos";
import { armarPrompt } from "../armado";
import { error, normalizarTexto, recorrerStrings, resultado, type Problema } from "./util";

/** Textos del documento donde una objeción puede estar respondida. */
function respuestasDelDoc(doc: LandingDoc): string[] {
  const textos: string[] = [];
  for (const s of doc.secciones) {
    if (s.intencion.objecionQueResponde) textos.push(s.intencion.objecionQueResponde);
    if (s.tipo === "faq") {
      for (const b of s.bloques) {
        for (const [, texto] of recorrerStrings(b.ajustes, "")) textos.push(texto);
      }
    }
  }
  return textos.map(normalizarTexto).filter(Boolean);
}

/**
 * Cada sección declara `intencion.objetivo` y, si se entrega el brief, cada objeción
 * queda respondida en `objecionQueResponde` o en un bloque de FAQ (pregunta u `objecion`).
 */
export function verificarAmbicioso(doc: LandingDoc, brief?: Pick<Brief, "objeciones">) {
  const problemas: Problema[] = [];
  doc.secciones.forEach((s, i) => {
    if (!s.intencion.objetivo.trim()) {
      problemas.push(error(`secciones[${i}].intencion.objetivo`, "La sección no declara su objetivo."));
    }
  });
  if (brief) {
    const respuestas = respuestasDelDoc(doc);
    for (const objecion of brief.objeciones) {
      const clave = normalizarTexto(objecion);
      const respondida = respuestas.some((r) => r.includes(clave) || clave.includes(r));
      if (!respondida) {
        problemas.push(error("secciones", `La objeción «${objecion}» no está respondida en ninguna sección ni en la FAQ.`));
      }
    }
  }
  return resultado(problemas);
}

export const tecnicaAmbicioso: ModuloTecnica = {
  id: "ambicioso",
  numero: 2,
  nombre: "Prompt ambicioso",
  fase: "descubrir",
  descripcionCorta: "Especifica el objetivo psicológico de cada sección y responde las objeciones antes de que aparezcan.",
  prioridad: 1,
  aporta: {
    rol: "Eres estratega de conversión especializado en productos físicos.",
    tarea: [
      "Elige el marco según el nivel de conciencia del brief: PAS con héroe «problema-primero» para los niveles inconsciente y problema, y AIDA con héroe de producto para los niveles solución, producto y total.",
      "Para cada sección define el objetivo psicológico, el copy principal, el elemento visual y el CTA, y responde las objeciones del brief dentro de las secciones adecuadas (FAQ, comparativa y garantía).",
      "Usa sesgos con respaldo real: prueba social con datos del brief, anclaje con el precio anterior real, aversión a la pérdida con una oferta con fecha y reciprocidad con el regalo incluido.",
    ],
    contexto: [
      "Nivel de conciencia (Eugene Schwartz), objeciones y beneficios: se leen del brief. Propón la estructura máxima; el diseño sustractivo la recorta.",
    ],
    formato: [
      "Cada sección lleva `intencion: { objetivo, emocion, objecionQueResponde? }` y cada objeción del brief queda respondida en al menos una sección.",
    ],
  },
  generarPromptIndividual(brief, semilla) {
    return armarPrompt({ brief, modulos: [tecnicaAmbicioso], semilla, modo: "individual" });
  },
  // Con el brief comprueba además que cada objeción esté respondida.
  verificador: (doc, brief) => verificarAmbicioso(doc, brief),
};
