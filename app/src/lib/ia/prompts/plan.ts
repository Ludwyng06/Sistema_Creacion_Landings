import { z } from "zod";
import type { TipoSeccion } from "@/lib/contratos";
import { ANTI_PROMEDIO, COPY_COLOMBIA, CRO } from "../conocimiento";
import { armarPromptProfesional, RESTRICCIONES_COMUNES, type PromptProfesional } from "./comun";

// Etapa 2 · Plan de secciones (docs/v2 §6.4 y §16.4): parte del blueprint §9.1 con nuestros tipos y no repite lo que ya cubre otra sección.

export const SeccionPlanificada = z.object({
  tipo: z.string().min(1),
  /** Variante del héroe o disposición de la sección, si el tipo tiene y sirve a su objetivo. */
  variante: z.string().max(40).nullable(),
  objetivoPsicologico: z.string().min(15).max(220),
  notasCopy: z.string().min(20).max(400),
  datoAUsar: z.string().min(5).max(240),
});
export type SeccionPlanificada = z.infer<typeof SeccionPlanificada>;

export const PlanSecciones = z.object({ secciones: z.array(SeccionPlanificada).min(6).max(12) });
export type PlanSecciones = z.infer<typeof PlanSecciones>;

export const EJEMPLO_PLAN: PlanSecciones = {
  secciones: [
    { tipo: "heroe", variante: "producto-monumental", objetivoPsicologico: "Que en 3 segundos se entienda qué es y qué cambia en el cuarto.", notasCopy: "Titular con el resultado en palabras del cliente y la contraentrega como riesgo neutralizado; CTA con lo que gana.", datoAUsar: "Beneficio principal del brief y forma de pago." },
    { tipo: "faq", variante: null, objetivoPsicologico: "Matar la duda que frena el pedido justo donde aparece.", notasCopy: "Usa las preguntas reales de la investigación con respuesta corta y verificable.", datoAUsar: "Preguntas reales y objeciones del brief." },
  ],
};

export interface EntradaPlan {
  contextoBrief: string;
  contextoEstrategia: string;
  contextoInvestigacion: string;
  /** Tipos que el plan debe incluir, en el orden en que se leen. */
  obligatorias: TipoSeccion[];
  /** Tipos que puede sumar si sirven al objetivo. */
  opcionales: TipoSeccion[];
  /** Tipos que agrega el sistema con datos reales: el plan no los repite. */
  delSistema: TipoSeccion[];
  /** Variantes válidas del héroe. */
  variantesHeroe: readonly string[];
  espacial: boolean;
}

export function promptPlan(e: EntradaPlan): PromptProfesional {
  return armarPromptProfesional({
    rol: "Eres arquitecto de landings de alta conversión. Recibes una estrategia y devuelves el plan de secciones definitivo: cada sección responde una pregunta del visitante y no repite lo que ya responde otra.",
    tarea: `Devuelve el plan ordenado de las secciones que se redactarán. Incluye TODAS las obligatorias (${e.obligatorias.join(", ")}), en ese orden relativo, y solo suma de las opcionales (${e.opcionales.join(", ") || "ninguna"}) las que sirvan a la estrategia. Para cada una da el objetivo psicológico (la pregunta del visitante que responde), notas de copy concretas (qué dato usar y qué objeción matar) y el dato exacto que debe usar. Objetivo medible: entre 6 y 12 secciones, cada una con un objetivo distinto y una sola garantía en toda la página.`,
    contexto: [`BRIEF\n${e.contextoBrief}`, `ESTRATEGIA\n${e.contextoEstrategia}`, `PAQUETE DE INVESTIGACIÓN\n${e.contextoInvestigacion || "Sin datos externos."}`].join("\n\n"),
    conocimiento: [COPY_COLOMBIA, CRO, ANTI_PROMEDIO],
    restricciones: [
      ...RESTRICCIONES_COMUNES,
      `El sistema agrega después, con datos reales, estas secciones: ${e.delSistema.join(", ")}. No las incluyas ni repitas su contenido: los sellos ya cubren pago contraentrega, envío y retracto; la ficha técnica cubre las especificaciones; los créditos cubren las imágenes.`,
      "Sin redundancias: la garantía va únicamente en la sección `garantia`; el precio únicamente en `oferta`; ninguna otra sección repite el mismo objetivo.",
      "La prueba social va inmediatamente después del precio; como no hay testimonios, esa función la cumple la garantía con sus condiciones reales.",
      `La variante del héroe es una de: ${e.variantesHeroe.join(", ")}. Nunca partido (texto a un lado, imagen al otro).`,
      e.espacial ? "El espacio es ambiente y el producto es el protagonista: ningún titular habla de la NASA ni sugiere respaldo de una agencia." : "Sin temática espacial: no menciones espacio, cielo ni agencias.",
      "`tipo` debe ser exactamente uno de los tipos permitidos; `variante` es null si el tipo no tiene variantes.",
    ],
    formato: { esquema: z.toJSONSchema(PlanSecciones), ejemplo: EJEMPLO_PLAN },
    autocontrol: [
      "¿Están todas las secciones obligatorias y en orden?",
      "¿Cada sección responde una pregunta distinta del visitante (para mí, funciona, cuánto y cómo, y si me equivoco, cómo lo pido)?",
      "¿La garantía aparece una sola vez y el precio una sola vez?",
      "¿Cada nota de copy nombra un dato concreto del brief o de la investigación?",
      "¿Ninguna sección repite lo que agrega el sistema?",
      "¿El héroe usa una variante permitida?",
    ],
  });
}
