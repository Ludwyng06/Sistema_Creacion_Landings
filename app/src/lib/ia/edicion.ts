import { z } from "zod";
import { PromptEstructurado, Seccion, type Brief, type LandingDoc } from "@/lib/contratos";
import { lintearPrompt, lintearTexto } from "@/lib/tecnicas/lista-negra";
import { registro } from "@/secciones/registro";
import { ejecutar } from "./enrutador";
import { obtenerDepsEnrutador } from "./deps";
import { forzarRuta, valoresProtegidos } from "./rutas";
import type { ResultadoIA } from "./tipos";

// Edición con IA (todo por el enrutador): regenerar una sección, mejorar un prompt y proponer objeciones.

export class ErrorEdicion extends Error {}

const llamar = <T>(p: Parameters<typeof ejecutar<T>>[0]): Promise<ResultadoIA<T>> => ejecutar(p, obtenerDepsEnrutador());

export interface RegeneracionSeccion {
  doc: LandingDoc;
  seccionId: string;
  proveedor: string;
}

/**
 * Pide solo esa sección a la IA, conserva `id`, `tipo` y los valores de `editadoPorHumano`,
 * y valida con el esquema de su tipo y con el linter.
 */
export async function regenerarSeccion(
  doc: LandingDoc,
  brief: Brief,
  seccionId: string,
  instruccion?: string,
): Promise<RegeneracionSeccion> {
  const indice = doc.secciones.findIndex((s) => s.id === seccionId);
  if (indice === -1) throw new ErrorEdicion(`No existe la sección «${seccionId}».`);
  const actual = doc.secciones[indice];
  const protegidos = valoresProtegidos(actual);

  const r = await llamar({
    tarea: "landing",
    sistema:
      "Eres estratega de conversión y redactor de respuesta directa en español neutro. Regeneras UNA sección de una landing conservando su intención.\n\n" +
      "Entrega únicamente el JSON de la sección { id, tipo, variante?, visible, intencion, ajustes, bloques, animacion?, efectos? }. Usa solo los colores y tipografías de los tokens y los datos del brief; si un dato falta, escribe \"[COMPLETAR]\".",
    usuario:
      `Brief:\n${JSON.stringify(brief, null, 2)}\n\nTokens:\n${JSON.stringify(doc.tokens, null, 2)}\n\n` +
      `Tipo de sección: ${actual.tipo}\nIntención: ${JSON.stringify(actual.intencion)}\n\nSección actual:\n${JSON.stringify(actual, null, 2)}\n\n` +
      (instruccion ? `Instrucción de la persona: ${instruccion}\n\n` : "") +
      (protegidos.length > 0
        ? `Estos campos los editó una persona y se conservan tal cual: ${protegidos.map((p) => p.ruta).join(", ")}.\n\n`
        : "") +
      "Regenera la sección completa con el mismo tipo.",
    esquema: Seccion,
  });

  let nueva = { ...r.datos, id: actual.id, tipo: actual.tipo } as z.infer<typeof Seccion>;
  for (const p of protegidos) nueva = forzarRuta(nueva, p.ruta, p.valor);
  if (actual.editadoPorHumano) nueva = { ...nueva, editadoPorHumano: actual.editadoPorHumano };

  const def = registro[actual.tipo];
  if (def) {
    const v = def.schema.safeParse({ ajustes: nueva.ajustes, bloques: nueva.bloques });
    if (!v.success) throw new ErrorEdicion(`La sección regenerada no cumple el esquema de «${actual.tipo}»:\n${z.prettifyError(v.error)}`);
  }
  const infracciones: string[] = [];
  const recorrer = (valor: unknown, ruta: string) => {
    if (typeof valor === "string") {
      for (const i of lintearTexto(valor, ruta)) infracciones.push(`${i.ruta}: ${i.regla} «${i.fragmento}»`);
    } else if (Array.isArray(valor)) valor.forEach((x, i) => recorrer(x, `${ruta}[${i}]`));
    else if (valor && typeof valor === "object") for (const [k, x] of Object.entries(valor)) recorrer(x, `${ruta}.${k}`);
  };
  recorrer(nueva.ajustes, "ajustes");
  nueva.bloques.forEach((b, j) => recorrer(b.ajustes, `bloques[${j}].ajustes`));
  if (infracciones.length > 0) {
    throw new ErrorEdicion(`La sección regenerada tiene infracciones de la lista negra:\n${infracciones.join("\n")}`);
  }

  const secciones = doc.secciones.map((s, i) => (i === indice ? nueva : s));
  return { doc: { ...doc, secciones }, seccionId, proveedor: r.proveedor };
}

const MejoraPrompt = z.object({ prompt: PromptEstructurado, cambios: z.array(z.string()) });

/** Meta-prompting de docs/04 §10: reescribe el prompt manteniendo los 4 bloques. */
export async function mejorarPrompt(prompt: PromptEstructurado): Promise<{ prompt: PromptEstructurado; cambios: string[]; proveedor: string }> {
  const r = await llamar({
    tarea: "mejorar-prompt",
    sistema:
      "Eres experto en ingeniería de prompts. Reescribe este prompt manteniendo sus 4 bloques (rol, tarea, contexto, formato), haz más específicas las instrucciones de la Tarea y añade un ejemplo few-shot en el Contexto. " +
      "Redacta con instrucciones positivas, en español neutro.\n\n" +
      'Entrega un objeto JSON { prompt: { rol, tarea, contexto, formato, aportes }, cambios: string[] }. Conserva `aportes` tal cual llega.',
    usuario: `Prompt a mejorar:\n${JSON.stringify(prompt, null, 2)}`,
    esquema: MejoraPrompt,
  });
  const mejorado = { ...r.datos.prompt, aportes: prompt.aportes };
  for (const b of ["rol", "tarea", "contexto", "formato"] as const) {
    if (!mejorado[b].trim()) throw new ErrorEdicion(`El prompt mejorado dejó vacío el bloque «${b}».`);
  }
  const infracciones = lintearPrompt(mejorado);
  if (infracciones.length > 0) {
    throw new ErrorEdicion(
      `El prompt mejorado usa expresiones de la lista negra: ${infracciones.map((i) => `${i.ruta}: «${i.fragmento}»`).join(", ")}.`,
    );
  }
  return { prompt: mejorado, cambios: r.datos.cambios, proveedor: r.proveedor };
}

const Objeciones = z.object({ objeciones: z.array(z.string().min(1)).min(1) });

/** Propone 5 objeciones realistas para el brief. */
export async function proponerObjeciones(brief: Brief): Promise<{ objeciones: string[]; proveedor: string }> {
  const r = await llamar({
    tarea: "objeciones",
    sistema:
      "Eres estratega de conversión especializado en productos físicos. Propones las 5 dudas u objeciones más realistas que frenan la compra, escritas como pregunta del comprador en español neutro.\n\n" +
      "Entrega un objeto JSON { objeciones: string[] } con exactamente 5 elementos.",
    usuario: `Brief del producto:\n${JSON.stringify(brief, null, 2)}`,
    esquema: Objeciones,
    maxTokens: 800,
  });
  const lista = [...new Set(r.datos.objeciones.map((o) => o.trim()).filter(Boolean))].slice(0, 5);
  return { objeciones: lista, proveedor: r.proveedor };
}
