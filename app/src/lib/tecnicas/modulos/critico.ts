import type { Brief, LandingDoc, ModuloTecnica, PromptEstructurado } from "@/lib/contratos";
import { armarPrompt, bloqueBrief, numerar } from "../armado";
import { error, resultado } from "./util";

export const RUBRICA_CRITICO = [
  "Claridad en 3 s (20 %): el héroe dice qué es, para quién y el beneficio principal.",
  "Fricción (15 %): pasos, textos o secciones que frenan la llegada al formulario.",
  "Móvil (15 %): jerarquía, tamaños y orden a 390 px.",
  "Confianza (15 %): garantía, prueba social real y datos concretos.",
  "Persuasión (15 %): beneficio antes que característica y objeciones respondidas.",
  "Originalidad (5 %): se nota la semilla y se evita el look genérico.",
  "Factor asombro (10 %): un momento memorable por cada tercio de la página, todos guiando la mirada al formulario.",
  "Accesibilidad (5 %): contraste, textos alternativos, tamaño táctil y `reduced-motion`.",
].join("\n");

const ROL_AUDITOR = "Eres auditor senior de UX y CRO y evalúas con evidencia.";

/**
 * Prompt del auditor (segunda llamada a la IA, con un modelo distinto al creador).
 * Devuelve solo el JSON `Critica`; el creador nunca se evalúa a sí mismo.
 */
export function generarPromptCritico(doc: LandingDoc, brief: Brief, docAuditado?: unknown): PromptEstructurado {
  const tarea = [
    "Puntúa cada criterio de la rúbrica de 0 a 10 y cita como evidencia el campo exacto del JSON (por ejemplo `secciones[0].ajustes.titular`).",
    "Calcula `puntaje` como el promedio ponderado de los criterios con los pesos de la rúbrica.",
    "Registra en `problemas` cada hallazgo con su ruta y propón en `correcciones` operaciones aplicables sobre el JSON, con la ruta del campo y el valor nuevo.",
  ];
  const contexto = [
    `Rúbrica del auditor (puntaje total de 0 a 10, ponderado):\n${RUBRICA_CRITICO}`,
    bloqueBrief(brief),
    // Con `docAuditado` (resumen compacto) el auditor lee menos tokens; sin él recibe el documento completo.
    docAuditado !== undefined
      ? `Documento \`LandingDoc\` a auditar (resumen: textos, estructura y recursos; sin tokens ni prompts de imagen):\n${JSON.stringify(docAuditado)}`
      : `Documento \`LandingDoc\` a auditar:\n${JSON.stringify(doc, null, 2)}`,
  ];
  const formato = [
    "Entrega únicamente el JSON `Critica`, sin texto antes ni después: { puntaje, porCriterio[ { criterio, puntaje, evidencia } ], problemas[], correcciones[] }, con puntajes de 0 a 10 y un elemento de `porCriterio` por cada criterio de la rúbrica.",
    "Antes de responder, razona paso a paso cada criterio con evidencia del JSON; entrega solo el resultado final en el formato pedido.",
  ];
  return {
    rol: ROL_AUDITOR,
    tarea: numerar(tarea),
    contexto: contexto.join("\n\n"),
    formato: formato.join("\n\n"),
    aportes: [
      { tecnica: "critico", bloque: "rol", texto: ROL_AUDITOR },
      ...tarea.map((texto) => ({ tecnica: "critico" as const, bloque: "tarea" as const, texto })),
      ...contexto.map((texto) => ({ tecnica: "critico" as const, bloque: "contexto" as const, texto })),
      ...formato.map((texto) => ({ tecnica: "critico" as const, bloque: "formato" as const, texto })),
    ],
  };
}

export const tecnicaCritico: ModuloTecnica = {
  id: "critico",
  numero: 3,
  nombre: "Crítico con subagentes",
  fase: "definir",
  descripcionCorta: "Un segundo agente audita el resultado con una rúbrica y devuelve correcciones aplicables.",
  prioridad: 8,
  // Lo que la técnica aporta al prompt del CREADOR. La auditoría es una llamada aparte:
  // ver `generarPromptCritico`.
  aporta: {
    rol: "Eres creador de landings y trabajas con un auditor senior de UX y CRO que revisará tu entrega con evidencia.",
    tarea: ["Construye el documento para que supere 8/10 en la rúbrica del auditor, que lo evaluará aparte."],
    contexto: [`Rúbrica del auditor (puntaje total de 0 a 10, ponderado):\n${RUBRICA_CRITICO}`],
    formato: ["No incluyas el campo `critica` en tu respuesta: lo completa el auditor en una llamada aparte."],
  },
  // Prompt del creador con la parte del crítico; el del auditor sale de `generarPromptCritico(doc, brief)`.
  generarPromptIndividual(brief, semilla) {
    return armarPrompt({ brief, modulos: [tecnicaCritico], semilla, modo: "individual" });
  },
  verificador(doc) {
    const puntaje = doc.critica?.puntaje;
    if (typeof puntaje !== "number" || !Number.isFinite(puntaje)) {
      return resultado([error("critica.puntaje", "El documento no trae `critica.puntaje`.")]);
    }
    return resultado([]);
  },
};
