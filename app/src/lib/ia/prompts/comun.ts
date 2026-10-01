import { PALABRAS_VETADAS } from "@/lib/tecnicas/lista-negra";

// Estructura obligatoria de todo prompt profesional del pipeline: ROL, TAREA, CONTEXTO, CONOCIMIENTO, RESTRICCIONES,
// FORMATO (esquema exacto + ejemplo) y AUTOCONTROL. Lo fijo va en `sistema`; los datos de la corrida van en `usuario` (CONTEXTO).

export interface PromptProfesional {
  sistema: string;
  usuario: string;
}

export interface PartesPrompt {
  rol: string;
  tarea: string;
  /** Datos de la corrida (brief, investigación, estrategia, semilla y tokens), ya en texto. */
  contexto: string;
  conocimiento: string[];
  restricciones: string[];
  formato: { esquema: unknown; ejemplo?: unknown; nota?: string };
  autocontrol: string[];
}

export const RESTRICCIONES_COMUNES = [
  "Español neutro de Colombia, tuteo. Verbos concretos que se puedan filmar; números en vez de adjetivos; frases cortas.",
  "Fidelidad: no inventes cifras, precios, medidas, fechas, garantías, tiempos de entrega, testimonios ni calificaciones. Usa solo los datos del brief y de la investigación con fuente.",
  "`[COMPLETAR]` solo cuando el dato es imprescindible y de verdad no existe en el brief ni en la investigación; nunca como relleno.",
  "Nada de escasez falsa, precios tachados sin respaldo ni promesas de salud o de resultados garantizados.",
  `Lista negra (no uses estas palabras): ${PALABRAS_VETADAS.join(", ")}.`,
  "Olores de IA prohibidos: tríadas de adjetivos, «no solo X, sino Y», frases que terminan en gerundio, titulares que sirven para cualquier competidor, flecha «→» en cada botón, etiquetas en mayúsculas sobre cada título.",
  "Responde únicamente con JSON válido que cumpla el esquema; sin markdown ni texto antes o después.",
];

const lista = (xs: string[]) => xs.map((x, i) => `${i + 1}. ${x}`).join("\n");

export function armarPromptProfesional(p: PartesPrompt): PromptProfesional {
  const ejemplo = p.formato.ejemplo !== undefined ? `\n\nEjemplo de salida excelente (solo muestra la forma; no copies su contenido):\n${JSON.stringify(p.formato.ejemplo, null, 2)}` : "";
  const sistema = [
    `## ROL\n${p.rol}`,
    `## TAREA\n${p.tarea}`,
    `## CONOCIMIENTO\n${p.conocimiento.join("\n\n")}`,
    `## RESTRICCIONES\n${lista(p.restricciones)}`,
    `## FORMATO\nEsquema JSON exacto de la respuesta:\n${JSON.stringify(p.formato.esquema)}${p.formato.nota ? `\n${p.formato.nota}` : ""}${ejemplo}`,
    `## AUTOCONTROL\nAntes de responder revisa, una por una, y corrige lo que falle:\n${lista(p.autocontrol)}`,
  ].join("\n\n");
  return { sistema, usuario: `## CONTEXTO\n${p.contexto}` };
}
