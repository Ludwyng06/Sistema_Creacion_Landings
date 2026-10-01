import { z } from "zod";
import { BriefGeneral, TIPOS_LANDING, type Encargo, type Faltante, type TipoLanding } from "@/lib/contratos";
import { ejecutar, type DepsEnrutador } from "@/lib/ia/enrutador";
import { COPY_COLOMBIA } from "@/lib/ia/conocimiento";
import { armarPromptProfesional, RESTRICCIONES_COMUNES, type PromptProfesional } from "@/lib/ia/prompts/comun";
import { esEspacial } from "./fuentes";

// Intake (docs/v2 §6.1 y §16.2, con la estructura de prompt de la 15-A): de la descripción libre al `BriefGeneral`.
// Detecta tipo, temática y faltantes críticos, y NUNCA inventa fecha, lugar, precio ni cifras: si faltan, van a `faltantes`.

export const EJEMPLO_BRIEF_GENERAL: BriefGeneral = {
  tipo: "evento",
  nombre: "Noche de observación de meteoros",
  tematica: "espacio",
  publico: "Familias y aficionados al cielo que quieren ver meteoros sin equipo especial.",
  propuesta: "Una noche al aire libre para ver la lluvia de meteoros con guía y sin telescopio.",
  beneficios: ["Ver meteoros a simple vista con una guía que te dice dónde mirar", "Una salida para compartir en familia o con amigos", "Aprender a reconocer las constelaciones del cielo de esa noche"],
  datosClave: [{ nombre: "Lugar", valor: "Villa de Leyva", origen: "usuario" }],
  faltantes: [{ clave: "fecha", pregunta: "¿Qué fecha?" }, { clave: "whatsapp", pregunta: "¿Cuál es tu WhatsApp?" }],
  lugar: "Villa de Leyva",
};

export function promptIntake(e: Encargo): PromptProfesional {
  const datos = Object.entries(e.datos ?? {}).filter(([, v]) => v.trim());
  return armarPromptProfesional({
    rol: "Eres analista de encargos de una agencia de landings en Colombia. Conviertes una idea dicha en una frase en datos estructurados, con criterio de quien sabe qué dato cambia la conversión y cuál no se puede inventar.",
    tarea: "Convierte la descripción libre en el `BriefGeneral`: detecta el tipo de landing y la temática, define el público y la propuesta, escribe entre 3 y 5 beneficios (lo que gana quien asiste, compra, aprende o apoya), recoge los datos clave con su origen y marca como `faltantes` (máximo 3, en orden de importancia) los datos que cambian la conversión y no se dijeron. Objetivo medible: ningún dato del brief que no esté dicho o que no sea una inferencia segura.",
    contexto: [
      `DESCRIPCIÓN DE LA PERSONA\n${e.descripcion}`,
      e.tipo ? `TIPO ELEGIDO POR LA PERSONA: ${e.tipo}` : "TIPO: sin elegir (detéctalo).",
      e.estilo || e.paleta ? `ESTILO Y PALETA ELEGIDOS: ${e.estilo ?? "auto"} / ${e.paleta ?? "auto"}` : "",
      datos.length ? `DATOS QUE LA PERSONA FIJÓ A MANO (son ciertos, úsalos tal cual)\n${datos.map(([k, v]) => `- ${k}: ${v}`).join("\n")}` : "",
      e.link ? `ENLACE DE REFERENCIA: ${e.link}` : "",
      e.fotos?.length ? `La persona adjuntó ${e.fotos.length} foto(s).` : "",
    ].filter(Boolean).join("\n\n"),
    conocimiento: [
      COPY_COLOMBIA,
      `TIPOS DE LANDING: ${TIPOS_LANDING.join(", ")}. producto = algo físico que se vende con precio; servicio = agencia, consultoría o profesional; evento = algo que pasa en una fecha y lugar; divulgacion = explica un tema; curso = formación con temario; app = software; causa = apoyo o donación; local = restaurante, tienda o negocio con sede.\nTEMÁTICAS: espacio (cielo, astronomía, cohetes, luna, auroras), producto, alimentos, belleza, tecnologia, general. Si el producto o la estética tiene relación con el espacio, la temática es espacio.`,
    ],
    restricciones: [
      ...RESTRICCIONES_COMUNES,
      "NUNCA inventes fecha, lugar, precio, horarios, nombres de ponentes, WhatsApp ni cifras. Si no están en la descripción ni en los datos fijados, no los pongas en el brief y agrégalos a `faltantes` con su clave (`fecha`, `lugar`, `precio`, `whatsapp`, `horario`).",
      "Los `datosClave` con origen «usuario» repiten lo que dijo la persona; un dato que viene de otra fuente lleva el nombre de esa fuente como origen.",
      "`faltantes`: máximo 3, cada uno con `clave` y una `pregunta` corta en español («¿Qué fecha?»).",
      "Los beneficios no llevan cifras ni promesas que la descripción no respalde.",
    ],
    formato: { esquema: z.toJSONSchema(BriefGeneral), ejemplo: EJEMPLO_BRIEF_GENERAL },
    autocontrol: [
      "¿El tipo y la temática salen de lo que dijo la persona?",
      "¿Cada fecha, lugar, precio o cifra del brief aparece tal cual en la descripción o en los datos fijados?",
      "¿Los datos que faltan y cambian la conversión están en `faltantes` (máximo 3)?",
      "¿Hay entre 3 y 5 beneficios sin cifras inventadas?",
      "¿Puse en `tematica` espacio si el tema toca el cielo, la astronomía o los cohetes?",
    ],
  });
}

// ---------- Que el intake no invente ----------

const sinTildes = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Texto del que puede salir un dato: la descripción y lo que la persona fijó a mano. */
export function textoFuente(e: Encargo): string {
  return sinTildes([e.descripcion, e.link ?? "", ...Object.values(e.datos ?? {})].join(" \n "));
}

const dig = (t: string) => t.replace(/\D/g, "");

/** `true` si el valor se puede rastrear en la fuente: cada palabra de 4 letras o más y cada número aparece en ella. */
export function rastreable(valor: string, fuente: string): boolean {
  const v = sinTildes(valor);
  const numeros = v.match(/\d[\d.,]*/g) ?? [];
  const fuenteDigitos = dig(fuente);
  for (const n of numeros) if (!fuenteDigitos.includes(dig(n)) && !fuente.includes(n)) return false;
  const palabras = (v.match(/[a-z]{4,}/g) ?? []).filter((p) => !["de", "del", "para", "con", "desde", "hasta"].includes(p));
  return palabras.every((p) => fuente.includes(p));
}

const PREGUNTAS: Record<string, string> = {
  fecha: "¿Qué fecha?",
  lugar: "¿En qué lugar?",
  precio: "¿Cuánto cuesta?",
  whatsapp: "¿Cuál es tu WhatsApp?",
  horario: "¿En qué horario?",
};

/** Datos que cada tipo necesita para convertir (en orden de importancia). */
const REQUERIDOS: Record<TipoLanding, string[]> = {
  evento: ["fecha", "lugar", "whatsapp"],
  producto: ["precio", "whatsapp"],
  servicio: ["whatsapp"],
  curso: ["fecha", "precio", "whatsapp"],
  local: ["lugar", "horario", "whatsapp"],
  causa: ["whatsapp"],
  app: [],
  divulgacion: [],
};

export interface IntakeResultado {
  brief: BriefGeneral;
  /** Datos del modelo que no se pudieron rastrear y se quitaron (para el aviso). */
  descartados: string[];
  proveedor?: string;
}

/**
 * Deja el brief sin nada inventado: el tipo elegido manda; la fecha, el lugar, el precio y el WhatsApp solo quedan si están en la
 * descripción o en lo que la persona fijó; lo que falta pasa a `faltantes` (máximo 3) y lo que la persona fijó se impone.
 */
export function sanearBrief(bruto: BriefGeneral, e: Encargo): IntakeResultado {
  const fuente = textoFuente(e);
  const datos = e.datos ?? {};
  const descartados: string[] = [];
  const b: BriefGeneral = { ...bruto, tipo: e.tipo ?? bruto.tipo };
  if (esEspacial(e.descripcion) && b.tematica !== "espacio") b.tematica = "espacio";

  const fijo = (k: string) => datos[k]?.trim() || undefined;
  const conservar = <T extends string | number>(clave: "fecha" | "lugar" | "whatsapp" | "precio", valor: T | undefined): T | undefined => {
    if (valor === undefined) return undefined;
    if (rastreable(String(valor), fuente)) return valor;
    descartados.push(`${clave}: ${String(valor)}`);
    return undefined;
  };
  const fecha = fijo("fecha") ?? conservar("fecha", b.fecha);
  const lugar = fijo("lugar") ?? conservar("lugar", b.lugar);
  const whatsapp = fijo("whatsapp") ?? conservar("whatsapp", b.whatsapp);
  const precioFijo = fijo("precio") ? Number(dig(fijo("precio")!)) : undefined;
  const precio = precioFijo || conservar("precio", b.precio);
  b.fecha = fecha;
  b.lugar = lugar;
  b.whatsapp = whatsapp;
  b.precio = precio;

  // Agenda y ponentes solo si la persona los dijo (cada nombre u hora rastreable).
  b.ponentes = b.ponentes?.filter((p) => rastreable(`${p.nombre}`, fuente)) ?? undefined;
  if (b.ponentes && b.ponentes.length === 0) b.ponentes = undefined;
  b.agenda = b.agenda?.filter((a) => rastreable(`${a.cuando} ${a.titulo}`, fuente)) ?? undefined;
  if (b.agenda && b.agenda.length === 0) b.agenda = undefined;

  b.datosClave = b.datosClave.filter((d) => {
    if (d.origen.toLowerCase() !== "usuario") return true;
    if (rastreable(d.valor, fuente)) return true;
    descartados.push(`${d.nombre}: ${d.valor}`);
    return false;
  });

  // Faltantes: los requeridos por tipo que no se tienen, más los que el modelo vio; sin repetir y sin lo que ya se tiene.
  const tiene: Record<string, boolean> = { fecha: !!b.fecha, lugar: !!b.lugar, precio: b.precio !== undefined, whatsapp: !!b.whatsapp, horario: !!fijo("horario") || /\d\s?(am|pm|a\. ?m|p\. ?m|h\b)/.test(fuente) };
  const lista: Faltante[] = [];
  const ya = new Set<string>();
  for (const clave of REQUERIDOS[b.tipo]) {
    if (!tiene[clave] && !ya.has(clave)) {
      ya.add(clave);
      lista.push({ clave, pregunta: PREGUNTAS[clave] ?? `¿${clave}?` });
    }
  }
  for (const f of b.faltantes) {
    const clave = f.clave.toLowerCase();
    if (tiene[clave] || ya.has(clave) || fijo(clave)) continue;
    ya.add(clave);
    lista.push({ clave, pregunta: f.pregunta });
  }
  b.faltantes = lista.slice(0, 3);
  return { brief: b, descartados };
}

export async function ejecutarIntake(e: Encargo, deps?: DepsEnrutador): Promise<IntakeResultado> {
  const p = promptIntake(e);
  const r = await ejecutar({ tarea: "intake", sistema: p.sistema, usuario: p.usuario, esquema: BriefGeneral, maxTokens: 2500, temperatura: 0.2, rapido: true }, deps);
  return { ...sanearBrief(r.datos, e), proveedor: r.proveedor };
}
