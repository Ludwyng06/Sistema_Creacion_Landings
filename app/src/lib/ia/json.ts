import { z, type ZodType } from "zod";
import { ErrorIA } from "./tipos";

const CIERRE = { "{": "}", "[": "]" } as const;

/** Devuelve el primer objeto o arreglo balanceado que empieza en `inicio`, o null. */
function balanceado(texto: string, inicio: number): string | null {
  const pila: string[] = [];
  let enCadena = false;
  let escape = false;
  for (let i = inicio; i < texto.length; i++) {
    const c = texto[i];
    if (enCadena) {
      if (escape) escape = false;
      else if (c === "\\") escape = true;
      else if (c === '"') enCadena = false;
      continue;
    }
    if (c === '"') enCadena = true;
    else if (c === "{" || c === "[") pila.push(CIERRE[c]);
    else if (c === "}" || c === "]") {
      if (pila.pop() !== c) return null;
      if (pila.length === 0) return texto.slice(inicio, i + 1);
    }
  }
  return null;
}

/** Todos los objetos o arreglos JSON de primer nivel que hay en el texto, en orden de aparición. */
function candidatos(texto: string): { valor: unknown; largo: number }[] {
  const encontrados: { valor: unknown; largo: number }[] = [];
  for (let i = 0; i < texto.length; i++) {
    if (texto[i] !== "{" && texto[i] !== "[") continue;
    const candidato = balanceado(texto, i);
    if (candidato === null) continue;
    try {
      encontrados.push({ valor: JSON.parse(candidato), largo: candidato.length });
      i += candidato.length - 1; // lo anidado no cuenta como candidato aparte
    } catch {
      // no era JSON válido; se prueba con el siguiente inicio
    }
  }
  return encontrados;
}

/**
 * Extrae y parsea el JSON de un texto, aunque venga en bloques Markdown, con texto alrededor o precedido de un
 * razonamiento (`<think>…</think>` o pasos con llaves sueltas). Con varios candidatos gana el más largo: la respuesta
 * completa siempre pesa más que los ejemplos o fragmentos que el modelo cita mientras piensa.
 */
export function extraerJSON(texto: string): unknown {
  const limpio = texto.replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, " ");
  const cerca = /```(?:json)?\s*([\s\S]*?)```/i.exec(limpio);
  const fuentes = cerca ? [cerca[1], limpio] : [limpio];
  for (const fuente of fuentes) {
    const lista = candidatos(fuente);
    if (lista.length > 0) return lista.reduce((a, b) => (b.largo > a.largo ? b : a)).valor;
  }
  throw new ErrorIA("json", "La respuesta no contiene un JSON válido.");
}

/** Quita las propiedades de objeto con valor null (los modelos ponen null donde el campo es opcional); los null de arreglos se dejan. */
export function sinNulos(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(sinNulos);
  if (valor && typeof valor === "object") {
    return Object.fromEntries(Object.entries(valor).filter(([, v]) => v !== null).map(([k, v]) => [k, sinNulos(v)]));
  }
  return valor;
}

/** Valida con Zod; devuelve los datos o lanza ErrorIA('json') con el mensaje legible. Si falla, reintenta sin las propiedades null. */
export function validar<T>(esquema: ZodType<T>, valor: unknown): T {
  const r = esquema.safeParse(valor);
  if (r.success) return r.data;
  const sin = esquema.safeParse(sinNulos(valor));
  if (sin.success) return sin.data;
  throw new ErrorIA("json", z.prettifyError(r.error));
}
