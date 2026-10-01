import { z } from "zod";
import { Critica } from "@/lib/contratos";
import { RUBRICA_CRITICO } from "@/lib/tecnicas/modulos/critico";
import { ANTI_PROMEDIO, CONTEXTO_FIDELIDAD, COPY_COLOMBIA, CRO } from "../conocimiento";
import { armarPromptProfesional, RESTRICCIONES_COMUNES, type PromptProfesional } from "./comun";

// Etapa 4 · Crítico desacoplado (docs/v2 §16.7): contexto limpio, la misma escala y el mismo umbral que siempre.
// El contexto de fidelidad alinea la rúbrica con la regla 6 del proyecto; no la relaja.

export const CriticaDelModelo = Critica.extend({ correcciones: z.array(z.string()).default([]) });

export const EJEMPLO_CRITICA = {
  puntaje: 8.4,
  porCriterio: [
    { criterio: "Claridad en 3 s", puntaje: 9, evidencia: "secciones[0].ajustes.titular" },
    { criterio: "Fricción", puntaje: 8, evidencia: "secciones[11].ajustes.campos" },
  ],
  problemas: ["secciones[3].ajustes.titulo repite la garantía que ya dice secciones[10]."],
  correcciones: ["secciones[3].ajustes.titulo: cambiar a la escena del problema, sin mencionar la garantía."],
};

export interface EntradaCritico {
  /** Resumen compacto del documento (`resumirParaCritico`). */
  documento: unknown;
  contextoBrief: string;
  /** Conocimiento resumido, para los proveedores con cupo por minuto pequeño (Groq). */
  compacto?: boolean;
  /** Se adjunta una captura del primer viewport (escritorio a la izquierda, móvil a la derecha): el auditor también mira lo que se ve. */
  visual?: boolean;
  /** Sin la estrategia: el auditor no conoce la intención del creador (contexto limpio). */
}

export function promptCritico(e: EntradaCritico): PromptProfesional {
  return armarPromptProfesional({
    rol: "Eres director creativo y especialista en CRO con criterio de comprador colombiano desconfiado. No participaste en la creación de esta página y no tienes compromiso con ella: un auditor que no encuentra nada no hizo su trabajo, pero tampoco inventas fallas.",
    tarea: "Puntúa la landing de 0 a 10 en cada criterio de la rúbrica con evidencia (la ruta exacta del campo, p. ej. `secciones[3].ajustes.titulo`), calcula `puntaje` como el promedio ponderado con los pesos de la rúbrica, lista en `problemas` cada hallazgo con su ruta y en `correcciones` operaciones aplicables con la ruta y el valor nuevo. Objetivo medible: un puntaje reproducible; dos auditores distintos deben coincidir a 0,5 puntos.",
    contexto: `${e.visual ? "CAPTURA ADJUNTA: el primer viewport de la landing real, en escritorio (izquierda) y en móvil de 390 px (derecha). Además del JSON, revisa lo que ves: jerarquía y contraste, que la imagen del héroe corresponda al producto, texto legible sin desbordes y que el gancho se entienda en 3 segundos. La rúbrica, la escala y el umbral son los mismos; lo que no se ve en la captura se juzga por el JSON."+"\n\n" : ""}BRIEF (lo que el vendedor dio)\n${e.contextoBrief}\n\nLANDING A AUDITAR (resumen: textos, estructura, efectos e imágenes con su texto alternativo)\n${JSON.stringify(e.documento)}`,
    conocimiento: [`RÚBRICA (puntaje total de 0 a 10, ponderado)\n${RUBRICA_CRITICO}`, CONTEXTO_FIDELIDAD, ...(e.compacto ? [] : [COPY_COLOMBIA, CRO, ANTI_PROMEDIO])],
    restricciones: [
      ...RESTRICCIONES_COMUNES.filter((r) => !r.startsWith("Español")),
      "La escala y el umbral son los de siempre: no subas la nota por compasión ni la bajes por costumbre; cita evidencia de cada nota.",
      "No penalices la ausencia de testimonios o calificaciones (ver el contexto de fidelidad); sí penaliza cualquier dato inventado, garantía repetida, un [COMPLETAR] en un dato que el brief SÍ traía, imagen que no corresponde al producto o texto alternativo pobre.",
      "Un [COMPLETAR] en un precio, fecha, lugar o dato que el vendedor no dio es lo correcto según la regla de fidelidad: no lo penalices ni propongas inventar un valor (no corrijas «[COMPLETAR]» por una cifra o un plazo).",
      "Cada corrección apunta a una ruta que exista en el documento y trae el texto nuevo, no un consejo vago.",
      "Un elemento de `porCriterio` por cada criterio de la rúbrica, con puntajes entre 0 y 10.",
    ],
    formato: { esquema: z.toJSONSchema(CriticaDelModelo), ejemplo: EJEMPLO_CRITICA },
    autocontrol: [
      "¿Cada nota cita la ruta exacta de un campo del documento?",
      "¿El puntaje es el promedio ponderado de los criterios y no una impresión?",
      "¿Penalicé algo por falta de testimonios que la regla de fidelidad impide?",
      "¿Cada corrección se puede aplicar tal cual, con su ruta y su valor nuevo?",
      "¿Revisé el alt de cada imagen, la coherencia entre el gancho del héroe y el cierre, y que la garantía aparezca una sola vez?",
      "¿Mis correcciones respetan la lista negra y no inventan datos?",
    ],
  });
}
