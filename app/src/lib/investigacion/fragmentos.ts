import type { Fuente } from "@/lib/contratos";
import type { RespuestaBusqueda } from "./serpapi";

/** Un pedazo de resultado de búsqueda con su fuente. El resumen de la IA solo puede apoyarse en estos. */
export interface Fragmento {
  id: string;
  tipo: "organico" | "pregunta" | "conocimiento";
  titulo: string;
  texto: string;
  fuente: Fuente;
}

const MAX_ORGANICOS = 8;
const MAX_PREGUNTAS = 4;
const MAX_TEXTO = 320;
/** Tope de fragmentos que se le pasan a la IA: mantiene la entrada corta (cabe en el cupo de Groq). */
export const MAX_FRAGMENTOS = 24;

const recortar = (t: string) => (t.length > MAX_TEXTO ? `${t.slice(0, MAX_TEXTO - 1).trimEnd()}…` : t);
const limpio = (t: unknown) => (typeof t === "string" ? t.replace(/\s+/g, " ").trim() : "");

/** Nombre del sitio desde el enlace: `https://www.ejemplo.com.co/x` → `ejemplo.com.co`. */
export function sitioDe(url: string, respaldo = ""): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return respaldo || url;
  }
}

/** Dominios que no son una fuente: traducción, copias en caché, redirecciones de buscadores y acortadores. */
const DOMINIOS_NO_FUENTE = [
  /^translate\.google\./,
  /\.translate\.goog$/,
  /^translate\.(?:yandex|baidu)\./,
  /^webcache\.googleusercontent\.com$/,
  /^cache\.google\./,
  /^(?:web\.)?archive\.(?:org|is|ph)$/,
  /^(?:l|lm|m)\.facebook\.com$/,
  /^l\.instagram\.com$/,
  /^r\.search\.yahoo\.com$/,
  /^(?:bit\.ly|t\.co|goo\.gl|tinyurl\.com|ow\.ly|is\.gd|cutt\.ly|rb\.gy|lnkd\.in|shorturl\.at|buff\.ly|t\.ly)$/,
];

/** `true` si el enlace es una traducción, una caché, una redirección o un acortador (no sirve para citar). */
export function esFuenteInvalida(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    if (DOMINIOS_NO_FUENTE.some((r) => r.test(host))) return true;
    return /^(?:google|bing)\.[a-z.]+$/.test(host) && /^\/(?:url|aclk|translate)/.test(u.pathname);
  } catch {
    return true;
  }
}

function fuenteDe(url: unknown, nombre: unknown): Fuente | null {
  const enlace = limpio(url);
  if (!/^https?:\/\//i.test(enlace) || esFuenteInvalida(enlace)) return null;
  return { url: enlace, sitio: sitioDe(enlace, limpio(nombre)) };
}

/**
 * Extrae de `organic_results`, `related_questions` («La gente también pregunta») y `knowledge_graph` el título,
 * el fragmento, el enlace y el sitio. Descarta lo que no trae enlace o texto y repite ninguno.
 */
export function extraerFragmentos(busquedas: RespuestaBusqueda[]): Fragmento[] {
  const salida: Omit<Fragmento, "id">[] = [];
  const vistos = new Set<string>();
  const agregar = (f: Omit<Fragmento, "id">) => {
    const clave = `${f.fuente.url}|${f.texto}`;
    if (!f.texto || vistos.has(clave)) return;
    vistos.add(clave);
    salida.push(f);
  };
  for (const b of busquedas) {
    const kg = b.knowledge_graph;
    if (kg) {
      const fuente = fuenteDe(kg.source?.link, kg.source?.name);
      if (fuente && limpio(kg.description)) agregar({ tipo: "conocimiento", titulo: limpio(kg.title), texto: recortar(limpio(kg.description)), fuente });
    }
    for (const r of (b.organic_results ?? []).slice(0, MAX_ORGANICOS)) {
      const fuente = fuenteDe(r.link, r.source ?? r.displayed_link);
      if (fuente) agregar({ tipo: "organico", titulo: limpio(r.title), texto: recortar(limpio(r.snippet)), fuente });
    }
    for (const q of (b.related_questions ?? []).slice(0, MAX_PREGUNTAS)) {
      const fuente =
        fuenteDe(q.link, q.source ?? q.displayed_link) ??
        (b.consulta ? { url: `https://www.google.com/search?${new URLSearchParams({ q: b.consulta })}`, sitio: "Google · La gente también pregunta" } : null);
      const pregunta = limpio(q.question);
      if (fuente && pregunta) agregar({ tipo: "pregunta", titulo: pregunta, texto: recortar(limpio(q.snippet) || pregunta), fuente });
    }
  }
  return salida.slice(0, MAX_FRAGMENTOS).map((f, i) => ({ ...f, id: `f${i + 1}` }));
}
