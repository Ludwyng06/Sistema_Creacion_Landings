import { z, type ZodType } from "zod";

type Nodo = Record<string, unknown>;

const esNodo = (v: unknown): v is Nodo => typeof v === "object" && v !== null && !Array.isArray(v);
const ENTERO_SEGURO = Number.MAX_SAFE_INTEGER;

/** Une una lista de `{ type, const }` (ya vistos como `{ type, enum: [x] }`) en un solo `{ type, enum }`, o `null`. */
function unirConstantes(opciones: unknown[]): Nodo | null {
  const tipos = new Set<unknown>();
  const valores: unknown[] = [];
  for (const o of opciones) {
    if (!esNodo(o) || !Array.isArray(o.enum) || o.enum.length !== 1) return null;
    tipos.add(o.type);
    valores.push(o.enum[0]);
  }
  return tipos.size === 1 && !tipos.has(undefined) ? { type: [...tipos][0], enum: valores } : { enum: valores };
}

/**
 * JSON Schema apto para `responseJsonSchema` de Gemini. La API rechaza con un 400 sin detalle las uniones de
 * el arreglo de secciones cuando trae `minItems`/`maxItems` (causa comprobada al bisecar el esquema real contra la API)
 * y no acepta bien las uniones de constantes (`anyOf` de `{ type, const }`) con que Zod emite `radio` e `intensidad`.
 * Se reescriben como `enum` y se quitan `$schema`, `propertyNames`, los límites de tamaño de arreglos y los límites
 * enteros fuera del rango seguro. Zod sigue validando todo del lado nuestro.
 */
export function esquemaParaGemini(esquema: ZodType): Nodo {
  const limpiar = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(limpiar);
    if (!esNodo(v)) return v;
    const r: Nodo = {};
    for (const [k, x] of Object.entries(v)) {
      if (k === "$schema" || k === "propertyNames" || k === "minItems" || k === "maxItems") continue;
      if ((k === "minimum" || k === "maximum") && typeof x === "number" && Math.abs(x) >= ENTERO_SEGURO) continue;
      r[k] = limpiar(x);
    }
    if (Array.isArray(r.anyOf)) {
      const union = unirConstantes(r.anyOf);
      if (union) {
        delete r.anyOf;
        Object.assign(r, union);
      }
    }
    if ("const" in r) {
      r.enum = [r.const];
      delete r.const;
    }
    return r;
  };
  return limpiar(z.toJSONSchema(esquema)) as Nodo;
}
