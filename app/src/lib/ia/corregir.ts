import { z } from "zod";
import type { LandingDoc } from "@/lib/contratos";
import { lintearDoc, lintearTexto, type Infraccion } from "@/lib/tecnicas/lista-negra";
import type { PeticionIA } from "./enrutador";
import { escribirRuta, leerRuta, rutaProtegida } from "./rutas";
import type { ResultadoIA } from "./tipos";

// Corrección de infracciones de la lista negra por lotes (tarea `corregir-lista-negra`).
// Lo usan el pipeline `construir` (t1) y `POST /api/corregir`.

export const LOTE_LISTA_NEGRA = 10;

const Correcciones = z.object({ correcciones: z.array(z.object({ ruta: z.string(), texto: z.string() })) });

export interface OpcionesCorregir {
  llamar: <T>(p: PeticionIA<T>) => Promise<ResultadoIA<T>>;
  /** Recibe los avisos (lotes que fallan, correcciones que siguen con infracciones). */
  avisos: string[];
}

export interface ResultadoCorregir {
  /** Ruta → texto nuevo, solo de las correcciones que quedaron limpias. */
  cambios: Map<string, string>;
  proveedores: string[];
  /** Campos con infracción enviados a la IA (sin los protegidos por `editadoPorHumano`). */
  campos: number;
  lotes: number;
  /** Lotes que no pudieron resolverse. */
  lotesFallidos: number;
}

const unicos = (xs: string[]) => [...new Set(xs)];

/** Infracciones que la IA puede corregir: las de campos no protegidos por `editadoPorHumano`. */
export function infraccionesCorregibles(doc: LandingDoc): Infraccion[] {
  return lintearDoc(doc).filter((i) => !rutaProtegida(doc, i.ruta));
}

/**
 * Pide correcciones para los campos con infracciones, en lotes de hasta 10, todos en paralelo.
 * Si todos los lotes fallan lanza un error; si solo fallan algunos, quedan como avisos.
 */
export async function corregirListaNegra(doc: LandingDoc, { llamar, avisos }: OpcionesCorregir): Promise<ResultadoCorregir> {
  const cambios = new Map<string, string>();
  const infracciones = infraccionesCorregibles(doc);
  const porRuta = new Map<string, string[]>();
  for (const i of infracciones) porRuta.set(i.ruta, [...(porRuta.get(i.ruta) ?? []), `${i.regla}: «${i.fragmento}»`]);
  const rutas = [...porRuta.keys()];
  const lotes: string[][] = [];
  for (let k = 0; k < rutas.length; k += LOTE_LISTA_NEGRA) lotes.push(rutas.slice(k, k + LOTE_LISTA_NEGRA));
  if (lotes.length === 0) return { cambios, proveedores: [], campos: 0, lotes: 0, lotesFallidos: 0 };

  const resultados = await Promise.allSettled(
    lotes.map((lote) =>
      llamar({
        tarea: "corregir-lista-negra",
        sistema:
          "Eres editor de estilo y corriges textos de landings en español neutro: verbos concretos, datos del brief, una idea por frase y frases de 8 a 18 palabras.\n\n" +
          "Entrega un objeto JSON { correcciones: [ { ruta, texto } ] } con una entrada por cada ruta recibida; conserva las cifras y el sentido de cada texto.",
        usuario:
          "Reescribe cada texto para que no contenga las infracciones indicadas.\n" +
          JSON.stringify(
            lote.map((ruta) => ({ ruta, texto: leerRuta(doc, ruta), infracciones: porRuta.get(ruta) })),
            null,
            2,
          ),
        esquema: Correcciones,
      }),
    ),
  );

  const proveedores: string[] = [];
  let lotesFallidos = 0;
  resultados.forEach((r, k) => {
    if (r.status === "rejected") {
      lotesFallidos++;
      avisos.push(`No se pudo corregir un lote de la lista negra: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`);
      return;
    }
    proveedores.push(r.value.proveedor);
    for (const c of r.value.datos.correcciones) {
      if (!lotes[k].includes(c.ruta) || !c.texto.trim()) continue;
      if (lintearTexto(c.texto).length > 0) {
        avisos.push(`La corrección de ${c.ruta} sigue con infracciones; se conservó el texto original.`);
        continue;
      }
      cambios.set(c.ruta, c.texto);
    }
  });
  if (lotesFallidos === lotes.length) throw new Error("Ningún lote pudo corregirse.");
  return { cambios, proveedores: unicos(proveedores), campos: rutas.length, lotes: lotes.length, lotesFallidos };
}

/** Aplica ruta → texto sobre una copia del documento. */
export function aplicarCambios(doc: LandingDoc, cambios: Map<string, string>): LandingDoc {
  let actual = doc;
  for (const [ruta, texto] of cambios) actual = escribirRuta(actual, ruta, texto);
  return actual;
}

export interface CorreccionDoc {
  doc: LandingDoc;
  /** Campos corregidos. */
  corregidas: number;
  /** Infracciones que quedan (incluye los campos protegidos). */
  pendientes: Infraccion[];
  proveedores: string[];
}

/** Corrige un documento completo: lo que usa `POST /api/corregir`. */
export async function corregirDoc(doc: LandingDoc, opciones: OpcionesCorregir): Promise<CorreccionDoc> {
  const r = await corregirListaNegra(doc, opciones);
  const corregido = aplicarCambios(doc, r.cambios);
  return { doc: corregido, corregidas: r.cambios.size, pendientes: lintearDoc(corregido), proveedores: r.proveedores };
}
