import { z, type ZodType } from "zod";

// Versión compacta de las entradas de IA para los proveedores con cupo por minuto pequeño (Groq: 8.000 tokens).
// No cambia las reglas: quita lo que se repite (ejemplos, campos ya descritos en el esquema, JSON con sangría).

const LINEAS_QUE_SOBRAN = [
  /^Estilos visuales reservados:.*$/m, // el héroe partido ya lo prohíben la tarea y el validador
  /^- `(?:version|meta|tokens|secciones\[\]|assets\[\])`:.*$/gm, // el esquema JSON describe estos campos
  /^Antes de responder, razona paso a paso.*$/m, // en modelos con razonamiento solo gasta la salida
];

/** Pasa a una línea los objetos JSON con sangría (el brief y los tokens del contexto). */
export function compactarJSONs(texto: string): string {
  return texto.replace(/^\{\n[\s\S]*?\n\}$/gm, (bloque) => {
    try {
      return JSON.stringify(JSON.parse(bloque));
    } catch {
      return bloque;
    }
  });
}

/** Quita los ejemplos few-shot (`Ejemplos few-shot:` y las líneas `Ejemplo X · …` que le siguen). */
export function quitarEjemplos(texto: string): string {
  return texto.replace(/^Ejemplos few-shot:\n(?:Ejemplo [A-Z] · .*(?:\n|$))+/m, "");
}

/** Quita el bloque «Tipos de sección disponibles»: cada tipo ya aparece con sus ajustes en «Ajustes y bloques válidos». */
export function quitarTiposDeSeccion(texto: string): string {
  return texto.replace(/^Tipos de sección disponibles:\n(?:- `.*(?:\n|$))+\n?/m, "");
}

/** Variantes de héroe: solo el nombre. Efectos de nivel 1 y 2: solo el nombre (los de nivel 3 conservan dónde valen). */
export function acortarCatalogos(texto: string): string {
  return texto
    .replace(/(^Variantes de héroe aprobadas[^\n]*\n)((?:- `[a-z-]+`: .*(?:\n|$))+)/m, (_t, titulo: string, lista: string) =>
      titulo + lista.replace(/^(- `[a-z-]+`): .*$/gm, "$1"),
    )
    .replace(/^(- `[a-z-]+`) · nivel ([12]) · .*$/gm, "$1 · nivel $2");
}

/** Quita los tokens visuales del contexto: el sistema los impone después, así que el modelo no necesita copiarlos. */
export function quitarTokens(texto: string): string {
  return texto
    .replace(/^Tokens de la semilla[^\n]*\n\{.*\}\n\n?/m, "")
    .replace("Copia `tokens` y `meta.semilla` tal cual llegan en el contexto.", "Copia `meta.semilla` tal cual llega; los tokens visuales los pone el sistema.");
}

/** Entrada de la tarea `landing` sin repeticiones. */
export function compactarEntrada(p: { sistema: string; usuario: string }): { sistema: string; usuario: string } {
  let sistema = p.sistema.replace(
    "Entrega un único objeto JSON `LandingDoc`, sin texto antes ni después, con estos campos:",
    "Entrega un único objeto JSON `LandingDoc` (su esquema va al final), sin texto antes ni después.",
  );
  for (const linea of LINEAS_QUE_SOBRAN) sistema = sistema.replace(linea, "");
  let usuario = quitarTokens(acortarCatalogos(quitarTiposDeSeccion(quitarEjemplos(compactarJSONs(p.usuario)))));
  sistema = quitarTokens(sistema);
  for (const linea of LINEAS_QUE_SOBRAN) usuario = usuario.replace(linea, "");
  const limpiar = (t: string) => t.replace(/\n{3,}/g, "\n\n").trim();
  return { sistema: limpiar(sistema), usuario: limpiar(usuario) };
}

const CLAVES_QUE_SOBRAN = new Set(["$schema", "additionalProperties", "pattern", "minLength", "propertyNames"]);
const ENTERO_SEGURO = Number.MAX_SAFE_INTEGER;

/** JSON Schema sin lo que el modelo no necesita para escribir el JSON (Zod valida todo del lado nuestro). */
export function esquemaCompacto(esquema: ZodType): unknown {
  const limpiar = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(limpiar);
    if (typeof v !== "object" || v === null) return v;
    const r: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) {
      if (CLAVES_QUE_SOBRAN.has(k)) continue;
      if ((k === "minimum" || k === "maximum") && typeof x === "number" && Math.abs(x) >= ENTERO_SEGURO) continue;
      r[k] = limpiar(x);
    }
    return r;
  };
  return limpiar(z.toJSONSchema(esquema));
}

/** Como `instruccionEsquema`, pero con el esquema compacto. */
export function instruccionEsquemaCompacta(esquema: ZodType): string {
  return (
    "Responde únicamente con un objeto JSON válido, sin texto adicional ni bloques de código, " +
    "que cumpla este JSON Schema:\n" +
    JSON.stringify(esquemaCompacto(esquema))
  );
}
