import type { LandingDoc, PromptEstructurado } from "@/lib/contratos";

// Técnica 7 · Restricciones negativas (docs/04 §7): lista negra de texto y patrones, con ruta del campo.
//
// Decisiones:
// - Coincidencia por palabra completa sobre texto normalizado (sin tildes, sin mayúsculas):
//   "potencia tu" marca, "potencial" no; "innovación" (sustantivo) no marca, "innovador/a/es/as" sí.
// - Las tríadas retóricas NO se lintean (no hay forma fiable de detectarlas): viven en el prompt.
// - "cura" cuenta como promesa médica solo como palabra completa.

export interface Infraccion {
  /** Ruta del campo, p. ej. `secciones[2].bloques[0].ajustes.texto`. Vacía si se linteó un texto suelto. */
  ruta: string;
  regla: string;
  fragmento: string;
}

/** Expresiones vetadas de docs/04 §7 (con sus flexiones de género y número). */
export const PALABRAS_VETADAS = [
  "revolucionario",
  "revolucionaria",
  "revolucionarios",
  "revolucionarias",
  "innovador",
  "innovadora",
  "innovadores",
  "innovadoras",
  "potenciar",
  "potencia tu",
  "desbloquea",
  "desbloquear",
  "sumérgete",
  "descubre el poder",
  "eleva tu",
  "sin igual",
  "de otro nivel",
  "experiencia única",
  "soluciones integrales",
  "ecosistema",
  "vanguardista",
  "vanguardistas",
  "de última generación",
  "transforma tu vida",
  "cambia las reglas del juego",
  "en el mundo actual",
  "en la era digital",
  "no busques más",
  "imprescindible",
  "imprescindibles",
  "mágico",
  "mágica",
  "mágicos",
  "mágicas",
  "increíble",
  "increíbles",
  "asombroso",
  "asombrosa",
  "asombrosos",
  "asombrosas",
  "perfecto para todos",
  "perfecta para todos",
  "y mucho más",
] as const;

/** Minúsculas y sin diacríticos; `mapa[j]` es el índice del texto original que originó el carácter `j`. */
function normalizar(texto: string): { norm: string; mapa: number[] } {
  let norm = "";
  const mapa: number[] = [];
  let i = 0;
  for (const c of texto) {
    const n = c.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
    for (let k = 0; k < n.length; k++) mapa.push(i);
    norm += n;
    i += c.length;
  }
  return { norm, mapa };
}

function escapar(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Regex de palabra completa para una frase; los espacios admiten cualquier espacio en blanco. */
function regexFrase(frase: string): RegExp {
  const cuerpo = normalizar(frase).norm.split(/\s+/).map(escapar).join("\\s+");
  return new RegExp(`(?<![\\p{L}\\p{N}])${cuerpo}(?![\\p{L}\\p{N}])`, "gu");
}

const REGEX_PALABRAS = PALABRAS_VETADAS.map(regexFrase);

interface Patron {
  regla: string;
  regex: RegExp;
}

const NO_LETRA_ANTES = "(?<![\\p{L}\\p{N}])";
const NO_LETRA_DESPUES = "(?![\\p{L}\\p{N}])";
const palabra = (fuente: string) => new RegExp(`${NO_LETRA_ANTES}${fuente}${NO_LETRA_DESPUES}`, "gu");

const PATRONES: Patron[] = [
  { regla: "exclamacion-doble", regex: /!!+|¡¡+/gu },
  {
    regla: "no-es-solo",
    regex: new RegExp(
      `${NO_LETRA_ANTES}no\\s+es\\s+(?:solo|solamente|tan\\s+solo|simplemente)${NO_LETRA_DESPUES}[^.!?;\\n]{0,120}?[,;]\\s*(?:es|son|sino)${NO_LETRA_DESPUES}`,
      "gu",
    ),
  },
  {
    regla: "siguiente-nivel",
    regex: new RegExp(
      `${NO_LETRA_ANTES}lleva\\s+tus?${NO_LETRA_DESPUES}[^.!?\\n]{0,60}?${NO_LETRA_ANTES}al\\s+siguiente\\s+nivel${NO_LETRA_DESPUES}`,
      "gu",
    ),
  },
  { regla: "calidad-premium", regex: palabra("calidad\\s+premium") },
  { regla: "promesa-absoluta", regex: palabra("cura") },
  { regla: "promesa-absoluta", regex: palabra("elimina\\s+para\\s+siempre") },
  { regla: "promesa-absoluta", regex: palabra("100\\s*%\\s*garantizad[oa]s?") },
  { regla: "promesa-absoluta", regex: palabra("sin\\s+efectos\\s+secundarios") },
  { regla: "promesa-absoluta", regex: palabra("resultados\\s+inmediatos") },
];

// Solo emojis reales: © ® ™ y símbolos similares no cuentan.
const EMOJI = /\p{Emoji_Presentation}|\p{Extended_Pictographic}️/gu;

function recorte(texto: string, mapa: number[], desde: number, largo: number): string {
  const ini = mapa[desde];
  const ultimo = mapa[desde + largo - 1];
  const fin = ultimo + String.fromCodePoint(texto.codePointAt(ultimo) ?? 32).length;
  return texto.slice(ini, fin).trim();
}

/** Revisa un texto suelto. `ruta` se copia a cada infracción. */
export function lintearTexto(texto: string, ruta = ""): Infraccion[] {
  const infracciones: Infraccion[] = [];
  const original = texto.normalize("NFC");
  const { norm, mapa } = normalizar(original);
  const agregar = (regla: string, desde: number, largo: number) =>
    infracciones.push({ ruta, regla, fragmento: recorte(original, mapa, desde, largo) });

  for (const re of REGEX_PALABRAS) {
    for (const m of norm.matchAll(re)) agregar("palabra-vetada", m.index, m[0].length);
  }
  for (const { regla, regex } of PATRONES) {
    for (const m of norm.matchAll(regex)) agregar(regla, m.index, m[0].length);
  }

  const emojis = [...original.matchAll(EMOJI)];
  if (emojis.length > 1) {
    infracciones.push({ ruta, regla: "emoji", fragmento: emojis.map((e) => e[0]).join(" ") });
  }

  for (const parrafo of original.split(/\n+/)) {
    const guiones = parrafo.match(/—/g)?.length ?? 0;
    if (guiones > 1) infracciones.push({ ruta, regla: "guion-largo", fragmento: parrafo.trim().slice(0, 120) });
  }
  return infracciones;
}

function recorrer(valor: unknown, ruta: string, salida: Infraccion[]): void {
  if (typeof valor === "string") salida.push(...lintearTexto(valor, ruta));
  else if (Array.isArray(valor)) valor.forEach((v, i) => recorrer(v, `${ruta}[${i}]`, salida));
  else if (valor && typeof valor === "object") {
    for (const [k, v] of Object.entries(valor)) recorrer(v, `${ruta}.${k}`, salida);
  }
}

/** Recorre todos los strings de `ajustes` y `bloques` de todas las secciones. */
export function lintearDoc(doc: LandingDoc): Infraccion[] {
  const salida: Infraccion[] = [];
  doc.secciones.forEach((s, i) => {
    recorrer(s.ajustes, `secciones[${i}].ajustes`, salida);
    s.bloques.forEach((b, j) => recorrer(b.ajustes, `secciones[${i}].bloques[${j}].ajustes`, salida));
  });
  return salida;
}

/**
 * Lintea un prompt salvo los aportes de la técnica 7, que citan las expresiones vetadas.
 * Los demás fragmentos del prompt deben quedar en cero.
 */
export function lintearPrompt(prompt: PromptEstructurado): Infraccion[] {
  const salida: Infraccion[] = [];
  for (const bloque of ["rol", "tarea", "contexto", "formato"] as const) {
    let texto = prompt[bloque];
    for (const a of prompt.aportes) {
      if (a.tecnica === "negativas" && a.bloque === bloque) texto = texto.replace(a.texto, "");
    }
    salida.push(...lintearTexto(texto, bloque));
  }
  return salida;
}
