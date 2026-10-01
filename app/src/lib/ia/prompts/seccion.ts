import { z } from "zod";
import type { Seccion, TipoSeccion } from "@/lib/contratos";
import { guiaAjustesPorSeccion } from "@/lib/tecnicas/guia-secciones";
import { ESQUEMAS_SECCION } from "@/secciones/esquemas";
import { EJEMPLO_POR_TIPO } from "@/secciones/ejemplos-por-tipo";
import { ANTI_PROMEDIO, COPY_COLOMBIA, PSICOLOGIA } from "../conocimiento";
import { armarPromptProfesional, RESTRICCIONES_COMUNES, type PromptProfesional } from "./comun";
import type { SeccionPlanificada } from "./plan";

// Etapa 3 · Redacción por sección (docs/v2 §6.5 y §16.5): una llamada por sección con la estrategia y el objetivo de esa sección.

/** Ejemplo corto de salida excelente por tipo: los `ajustes` y `bloques` de su ejemplo del editor, sin marcadores. */
export function ejemploDeSeccion(tipo: TipoSeccion): { ajustes: Seccion["ajustes"]; bloques: { tipo: string; ajustes: Record<string, unknown> }[] } | null {
  const s = EJEMPLO_POR_TIPO[tipo];
  if (!s) return null;
  return { ajustes: s.ajustes, bloques: s.bloques.map((b) => ({ tipo: b.tipo, ajustes: b.ajustes })) };
}

export function esquemaJsonDeSeccion(tipo: TipoSeccion): unknown {
  const esquema = (ESQUEMAS_SECCION as Record<string, z.ZodType>)[tipo];
  return esquema ? z.toJSONSchema(esquema, { io: "input", unrepresentable: "any" }) : {};
}

const RESUMEN_COMPACTO = `CONOCIMIENTO (resumen)
- Comprador colombiano: primero desconfianza, luego indiferencia; gana el copy más creíble. Contraentrega narrado: no pagas hoy, te llega, lo revisas y solo ahí pagas al mensajero.
- Beneficio antes que característica; números en vez de adjetivos; prueba de sustitución en cada titular; mecanismo «Pensabas que… pero…».
- Anti-promedio de IA: sin tríadas de adjetivos, sin «no solo… sino…», sin gerundios finales, sin flechas en cada botón.`;

export interface EntradaSeccion {
  tipo: TipoSeccion;
  plan: SeccionPlanificada;
  contextoBrief: string;
  contextoEstrategia: string;
  contextoInvestigacion: string;
  /** Titulares ya escritos, para no repetirlos. */
  titularesPrevios: string[];
  /** Slots de imagen que esta sección debe usar, con lo que muestra cada uno. */
  slots: { slot: string; que: string }[];
  /** Instrucción concreta del crítico al corregir esta sección. */
  correccion?: string;
  /** Entrada corta para los proveedores con cupo por minuto pequeño (Groq): conocimiento resumido. */
  compacto?: boolean;
}

export function promptSeccion(e: EntradaSeccion): PromptProfesional {
  const ejemplo = ejemploDeSeccion(e.tipo);
  return armarPromptProfesional({
    rol: "Eres copywriter de respuesta directa especializado en Colombia. Escribes UNA sección de una landing como un experto que le habla a un amigo, no como un folleto, con el ojo de un comprador que desconfía.",
    tarea: `Escribe el contenido de la sección «${e.tipo}${e.plan.variante ? ` (${e.plan.variante})` : ""}». Objetivo psicológico: ${e.plan.objetivoPsicologico}. Notas de copy: ${e.plan.notasCopy}. Dato que debe usar: ${e.plan.datoAUsar}. Objetivo medible: cada campo cumple los límites del esquema y cada frase dice algo que un competidor no podría decir.`,
    contexto: [
      `BRIEF\n${e.contextoBrief}`,
      `ESTRATEGIA\n${e.contextoEstrategia}`,
      `PAQUETE DE INVESTIGACIÓN\n${e.contextoInvestigacion || "Sin datos externos."}`,
      e.slots.length ? `SLOTS DE IMAGEN de esta sección (usa estos nombres exactos):\n${e.slots.map((s) => `- ${s.slot}: ${s.que}`).join("\n")}` : "",
      `TITULARES YA ESCRITOS (no los repitas ni los parafrasees):\n${e.titularesPrevios.map((t) => `- ${t}`).join("\n") || "- (ninguno todavía)"}`,
      e.correccion ? `CORRECCIÓN PEDIDA POR EL CRÍTICO PARA ESTA SECCIÓN (aplícala sin romper las demás reglas):\n${e.correccion}` : "",
    ].filter(Boolean).join("\n\n"),
    conocimiento: e.compacto ? [RESUMEN_COMPACTO] : [COPY_COLOMBIA, PSICOLOGIA, ANTI_PROMEDIO],
    restricciones: [
      ...RESTRICCIONES_COMUNES,
      "Primera mención del producto con posesivo de marca («nuestro», «nuestra»). Botones: imperativo + lo que gana o el riesgo que no corre.",
      "Contraentrega narrado cuando aplique: no pagas hoy → te llega → lo revisas → pagas al mensajero.",
      "Bullets de máximo 5, con el formato «[beneficio coloquial]: [qué pasa en la vida real]».",
      "Respeta los límites de caracteres y de cantidad de bloques del esquema; todo campo sin ? es obligatorio.",
      "Cada dato del vendedor se dice en UNA sola sección: la garantía (días y condiciones) solo en `garantia`, el precio solo en `oferta` y la contraentrega solo en el formulario y en la sección de sellos que agrega el sistema. Las demás secciones no los repiten: si una duda los toca, remite con una frase corta sin volver a dar el número.",
      "No prometas capacidades, resultados ni compatibilidades que el brief no confirme (por ejemplo, lo que se alcanza a ver, cuánto dura o con qué funciona). Sin precio anterior ni descuentos: el precio es el del vendedor.",
      "Testimonios: nunca. Si el tipo de sección pide personas, escribe el contenido sin inventar a nadie.",
      "El precio y el precio anterior son exactamente los del brief; los datos que no estén en el brief ni en la investigación no se escriben.",
    ],
    formato: {
      esquema: esquemaJsonDeSeccion(e.tipo),
      ejemplo: ejemplo ?? undefined,
      nota: `Guía compacta de campos:\n${guiaAjustesPorSeccion([e.tipo])}\nResponde con un objeto { ajustes, bloques } (sin id ni tipo de sección).`,
    },
    autocontrol: [
      "¿Cada campo respeta el máximo de caracteres y la cantidad de bloques?",
      "¿El titular sirve solo para este producto (prueba de sustitución)?",
      "¿Usé el dato indicado y ninguna cifra que no esté en el brief o la investigación?",
      "¿Empiezan las frases con un verbo concreto y no con un adjetivo?",
      "¿Evité las palabras de la lista negra, las tríadas y los gerundios finales?",
      "¿Usé los slots con los nombres exactos que me dieron?",
      "¿El texto no repite un titular ya escrito ni la garantía de otra sección?",
    ],
  });
}
