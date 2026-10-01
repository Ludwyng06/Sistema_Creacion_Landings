import { z } from "zod";
import { NivelConciencia } from "@/lib/contratos";
import { ANTI_PROMEDIO, COPY_COLOMBIA, CRO, OFERTAS, PSICOLOGIA } from "../conocimiento";
import { armarPromptProfesional, RESTRICCIONES_COMUNES, type PromptProfesional } from "./comun";

// Etapa 1 · Estrategia (docs/v2 §6.3 y §16.3): el diagnóstico que hacen los copywriters de respuesta directa antes de escribir una línea.

export const Estrategia = z.object({
  avatar: z.object({ quien: z.string().min(20).max(300), escenaCotidiana: z.string().min(20).max(300) }),
  nivelConciencia: NivelConciencia,
  dolorEnEscena: z.string().min(20).max(300),
  deseo: z.string().min(10).max(200),
  beneficioDelBeneficio: z.string().min(10).max(200),
  mecanismoUnico: z.object({
    pensabas: z.string().min(10).max(160),
    pero: z.string().min(10).max(200),
    datoReal: z.string().min(5).max(200),
  }),
  objeciones: z.array(z.object({ objecion: z.string().min(5).max(120), respuesta: z.string().min(10).max(240) })).min(4).max(6),
  oferta: z.object({ principal: z.string().min(5).max(200), garantia: z.string().min(5).max(200), porQueAhora: z.string().max(200).nullable() }),
  angulos: z.object({ principal: z.string().min(10).max(200), alternos: z.array(z.string().min(10).max(200)).min(2).max(3) }),
  tono: z.string().min(5).max(120),
  cta: z.object({ texto: z.string().min(5).max(40), gana: z.string().min(5).max(120) }),
  precio: z.string().min(10).max(240),
});
export type Estrategia = z.infer<typeof Estrategia>;

export const EJEMPLO_ESTRATEGIA: Estrategia = {
  avatar: { quien: "Mariana, 34 años, vive en un apartamento en Envigado y trabaja desde casa con un computador en la sala.", escenaCotidiana: "A las 4 p. m. de un martes se da cuenta de que lleva seis horas sin pararse y la espalda ya le avisa." },
  nivelConciencia: "problema",
  dolorEnEscena: "Cierra el computador con los hombros hacia adelante y camina a la cocina apoyando la mano en la cintura.",
  deseo: "Terminar la jornada sin dolor y sin acordarse de la postura.",
  beneficioDelBeneficio: "Llegar a la noche con energía para lo que quiere hacer y no para recuperarse.",
  mecanismoUnico: { pensabas: "Pensabas que corregir la postura exige fuerza de voluntad todo el día", pero: "pero una vibración suave te avisa justo cuando te encorvas y tú solo te enderezas", datoReal: "Sensor de inclinación con aviso por vibración (dato del vendedor)." },
  objeciones: [{ objecion: "¿Se nota debajo de la ropa?", respuesta: "Va pegado a la espalda, debajo de la camiseta, y no marca la tela." },
    { objecion: "¿Y si no llega o llega dañado?", respuesta: "No pagas nada hoy: lo revisas frente al mensajero y solo ahí pagas." },
    { objecion: "¿Cuánto dura la batería?", respuesta: "Se carga por USB; la duración exacta es la que da el vendedor en la ficha." },
    { objecion: "¿Qué hago si no me sirve?", respuesta: "Tienes 30 días de garantía y 5 días hábiles de retracto por la Ley 1480." },
  ],
  oferta: { principal: "Un corrector con cable de carga y guía de uso", garantia: "30 días: si llega con un defecto de fábrica, lo cambiamos.", porQueAhora: null },
  angulos: { principal: "Autonomía: dejar de pedirle a otra persona que te recuerde sentarte derecho.", alternos: ["Costo acumulado de no resolverlo", "Prueba de 30 días sin riesgo"] },
  tono: "Cercano y directo, de amigo que sabe del tema.",
  cta: { texto: "Pedir el mío y pagar al recibir", gana: "Lo revisa antes de pagar" },
  precio: "Se muestra $89.900 junto a la contraentrega; enmarcado por día frente al costo de una sesión de fisioterapia si hay dato en la investigación.",
};

export interface EntradaEstrategia {
  contextoBrief: string;
  contextoInvestigacion: string;
  contextoSemilla: string;
  /** Ángulo alterno a probar en un intento nuevo (el principal queda como uno de los alternos). */
  anguloForzado?: string;
  /** Tipo de landing distinto de producto: la conversión no es «comprar» sino asistir, aprender, apoyar o escribir. */
  enfoque?: { tipo: string; conversion: string; verbo: string };
}

export function promptEstrategia(e: EntradaEstrategia): PromptProfesional {
  return armarPromptProfesional({
    rol: e.enfoque
      ? `Eres estratega senior de conversión y copywriter de respuesta directa en Colombia, especializado en landings de tipo ${e.enfoque.tipo}. Antes de escribir una sola línea de copy haces el diagnóstico completo, con criterio de persona desconfiada y sin adornos.`
      : "Eres estratega senior de conversión y copywriter de respuesta directa para ecommerce de contraentrega en Colombia. Antes de escribir una sola línea de copy haces el diagnóstico completo, con criterio de comprador desconfiado y sin adornos.",
    tarea:
      "Entrega la estrategia de esta landing: avatar concreto (una persona, no una demografía), nivel de conciencia, dolor como escena cotidiana, deseo y beneficio del beneficio (prueba primero el ángulo de autonomía), mecanismo único con la fórmula «Pensabas que… pero…» sacado de un dato REAL del producto, las objeciones principales en palabras del cliente con su respuesta (usa las preguntas reales de la investigación), la oferta con garantía y un «por qué ahora» solo si es real (si no, null), un ángulo principal y ángulos alternos, el tono, el CTA específico y cómo presentar el precio frente a los precios de referencia. Objetivo medible: que cada campo sea concreto y usable por el redactor sin volver a preguntar.",
    contexto: [
      `BRIEF\n${e.contextoBrief}`,
      `PAQUETE DE INVESTIGACIÓN\n${e.contextoInvestigacion || "Sin datos externos: trabaja solo con el brief."}`,
      `SEMILLA Y TOKENS\n${e.contextoSemilla}`,
      e.enfoque ? `CONVERSIÓN DE ESTA LANDING: ${e.enfoque.conversion}. La estrategia habla de ${e.enfoque.verbo}, no de comprar; la oferta es lo que la persona gana al dar ese paso, sin inventar precio, fecha ni lugar.` : "",
      e.anguloForzado ? `ÁNGULO OBLIGATORIO DE ESTE INTENTO: el ángulo principal es «${e.anguloForzado}». Pon el anterior entre los alternos.` : "",
    ].filter(Boolean).join("\n\n"),
    conocimiento: [COPY_COLOMBIA, CRO, OFERTAS, PSICOLOGIA, ANTI_PROMEDIO],
    restricciones: [
      ...RESTRICCIONES_COMUNES,
      "El mecanismo único sale de datos reales (material, diseño, capacidad, proceso, garantía). Si no hay un mecanismo real, usa la diferencia más tangible y dilo en `datoReal`.",
      "Las objeciones son las del cliente, no las que el vendedor quisiera oír. Usa las preguntas reales y las objeciones del brief.",
      "El precio de las tiendas es solo referencia: el precio de la landing es el del vendedor.",
      "Sin urgencia inventada: `porQueAhora` es null salvo que exista corte de despacho, temporada o fecha real en el brief.",
    ],
    formato: { esquema: z.toJSONSchema(Estrategia), ejemplo: EJEMPLO_ESTRATEGIA },
    autocontrol: [
      "¿El avatar tiene un lugar, una hora y una acción concretos?",
      "¿El mecanismo único sale de un dato del brief o de la investigación y no de una especificación disfrazada?",
      "¿Hay entre 4 y 6 objeciones en palabras del cliente, cada una con respuesta verificable?",
      "¿El CTA dice qué gana o qué riesgo no corre, no «Comprar»?",
      "¿Ninguna cifra, garantía o fecha sale de mi imaginación?",
      "¿El ángulo principal pasaría la prueba de sustitución (no sirve para la competencia)?",
    ],
  });
}
