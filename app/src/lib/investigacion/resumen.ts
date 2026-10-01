import { z } from "zod";
import { CategoriaBrief, NivelConciencia } from "@/lib/contratos";
import { ejecutar, type DepsEnrutador } from "@/lib/ia/enrutador";
import { COMPLETAR, quitarCifras, tieneCifra } from "./cifras";
import type { Fragmento } from "./fragmentos";
import type { Fuente, Sugerencia, Sugerencias } from "@/lib/contratos";

// Tarea `investigar`: resume solo los fragmentos de las búsquedas. Cada dato cita los ids de los fragmentos de donde sale;
// el código convierte los ids en fuentes y descarta lo que no cite ninguna (fidelidad: nada sin fuente).

const ItemIA = z.object({
  texto: z.string().min(1),
  fuentes: z.array(z.string()).default([]),
  tieneCifra: z.boolean().default(false),
});
const CampoIA = z.object({
  texto: z.string().min(1),
  fuentes: z.array(z.string()).default([]),
  confianza: z.number().min(0).max(1).default(0.5),
});

export const ResumenIA = z.object({
  beneficios: z.array(ItemIA).default([]),
  objeciones: z.array(ItemIA).default([]),
  preguntas: z.array(ItemIA).default([]),
  incluye: z.array(ItemIA).default([]),
  problema: CampoIA.optional(),
  publico: CampoIA.optional(),
  categoria: CategoriaBrief.optional(),
  nivelConciencia: z
    .object({
      valor: NivelConciencia,
      motivo: z.string().min(1),
      fuentes: z.array(z.string()).default([]),
      confianza: z.number().min(0).max(1).default(0.5),
    })
    .optional(),
});
export type ResumenIA = z.infer<typeof ResumenIA>;

export const SISTEMA_INVESTIGAR =
  "Resumes lo que dicen las búsquedas de Google sobre un producto físico, para ayudar a alguien que prepara su landing. " +
  'Usa SOLO los fragmentos recibidos: no agregues nada que no esté en ellos ni completes con lo que sepas. Cada dato cita en `fuentes` los ids de los fragmentos de donde sale (por ejemplo ["f2","f5"]). ' +
  `PROHIBIDO escribir cifras: precios, calificaciones, número de opiniones, porcentajes, cantidades, medidas, fechas y testimonios. Si un fragmento las trae, deja la idea sin el número o usa ${COMPLETAR} y marca \`tieneCifra: true\`. ` +
  "Español neutro, verbos concretos, frases de máximo 20 palabras. Responde con un JSON con: " +
  "`beneficios` (hasta 5: qué gana quien lo usa), `objeciones` (hasta 5: dudas o quejas que frenan la compra), `preguntas` (hasta 5: lo que la gente pregunta), " +
  "`incluye` (solo lo que el producto trae, si lo dicen los fragmentos; si no, lista vacía), " +
  "`problema` y `publico` ({ texto, fuentes, confianza de 0 a 1 }: una frase cada uno), " +
  `\`categoria\` (una de: ${CategoriaBrief.options.join(", ")}), ` +
  "`nivelConciencia` ({ valor: inconsciente, problema, solucion, producto o total; motivo de una línea; fuentes; confianza }). " +
  "Cada beneficio, objeción, pregunta e incluye es { texto, fuentes, tieneCifra }. Si no hay base para un campo, omítelo.";

/** Entrada de la IA: los fragmentos con sus cifras ya tapadas (así el modelo no las copia). */
export function armarUsuario(nombre: string, categoria: string | undefined, rasgos: string[], fragmentos: Fragmento[]): string {
  const lineas = fragmentos.map((f) => `[${f.id}] (${f.fuente.sitio}) ${quitarCifras(f.titulo, nombre)} — ${quitarCifras(f.texto, nombre)}`);
  return [
    `Producto: ${nombre}`,
    ...(categoria ? [`Categoría: ${categoria}`] : []),
    ...(rasgos.length ? [`Rasgos vistos en la foto: ${rasgos.join("; ")}`] : []),
    "",
    "Fragmentos de las búsquedas:",
    ...lineas,
  ].join("\n");
}

const MAX_POR_GRUPO = 5;

/** Ids citados → fuentes reales (sin repetir). Los ids inventados se ignoran. */
export function fuentesDe(ids: string[], fragmentos: Fragmento[]): Fuente[] {
  const porId = new Map(fragmentos.map((f) => [f.id, f.fuente]));
  const vistas = new Map<string, Fuente>();
  for (const id of ids) {
    const f = porId.get(id.trim());
    if (f) vistas.set(f.url, f);
  }
  return [...vistas.values()];
}

/** Regla de fidelidad: sin cifras en el texto (van como [COMPLETAR]) y sin sugerencias sin fuente. */
export function aSugerencias(items: ResumenIA["beneficios"], fragmentos: Fragmento[], nombre: string): Sugerencia[] {
  const vistos = new Set<string>();
  const salida: Sugerencia[] = [];
  for (const i of items) {
    const fuentes = fuentesDe(i.fuentes, fragmentos);
    const texto = quitarCifras(i.texto.replace(/\s+/g, " ").trim(), nombre);
    const clave = texto.toLowerCase();
    if (!texto || fuentes.length === 0 || vistos.has(clave)) continue;
    vistos.add(clave);
    salida.push({ texto, fuentes, tieneCifra: i.tieneCifra || tieneCifra(i.texto, nombre) });
    if (salida.length >= MAX_POR_GRUPO) break;
  }
  return salida;
}

export interface EntradaResumen {
  nombre: string;
  categoria?: string;
  rasgos: string[];
  fragmentos: Fragmento[];
}

export async function resumirFragmentos(
  e: EntradaResumen,
  deps?: DepsEnrutador,
): Promise<{ resumen: ResumenIA; sugerencias: Sugerencias; proveedor: string }> {
  const r = await ejecutar(
    {
      tarea: "investigar",
      sistema: SISTEMA_INVESTIGAR,
      usuario: armarUsuario(e.nombre, e.categoria, e.rasgos, e.fragmentos),
      esquema: ResumenIA,
      maxTokens: 2200,
      temperatura: 0.2,
      rapido: true,
    },
    deps,
  );
  const sugerencias: Sugerencias = {
    beneficios: aSugerencias(r.datos.beneficios, e.fragmentos, e.nombre),
    objeciones: aSugerencias(r.datos.objeciones, e.fragmentos, e.nombre),
    preguntas: aSugerencias(r.datos.preguntas, e.fragmentos, e.nombre),
  };
  return { resumen: r.datos, sugerencias, proveedor: r.proveedor };
}
