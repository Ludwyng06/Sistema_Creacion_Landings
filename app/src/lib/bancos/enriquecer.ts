import { z } from "zod";
import { ejecutar, type DepsEnrutador } from "@/lib/ia/enrutador";

// Enriquecimiento con IA por el enrutador (tarea `describir-medio`, proveedor barato): título y descripción en español
// y 5 etiquetas por medio. La orientación y los colores dominantes no los pide a la IA: salen de la imagen misma.

export interface MedioParaDescribir {
  id: string;
  titulo: string;
  texto: string;
  banco: string;
  /** Tema del banco, en español, para ubicar a la IA («La Luna»). */
  tema: string;
}

export const DescripcionMedios = z.object({
  medios: z.array(
    z.object({
      id: z.string().min(1),
      titulo: z.string().min(3).max(90),
      descripcion: z.string().min(10).max(260),
      etiquetas: z.array(z.string().min(2).max(28)).min(3).max(6),
    }),
  ),
});
export type DescripcionMedios = z.infer<typeof DescripcionMedios>;

export const SISTEMA_DESCRIBIR_MEDIO =
  "Eres editor de un banco de imágenes para landings en español de Colombia. Recibes fichas en inglés de fotos reales y las describes. " +
  "Usa SOLO lo que dice cada ficha: no inventes lugares, fechas, cifras, nombres ni el equipo que la tomó. " +
  "Todo el texto va en español, también el título: tradúcelo. Para cada medio devuelve: `titulo` (hasta 12 palabras, sin comillas), `descripcion` (una o dos frases que dicen qué se ve, en español neutro y con verbos concretos) " +
  "y `etiquetas` (5 palabras en minúscula, sin #, útiles para buscar la imagen por tema, color o ambiente). " +
  "No sugieras que la NASA ni ninguna otra entidad respalda un producto. Responde con un JSON { medios: [ { id, titulo, descripcion, etiquetas } ] } con el mismo id de cada ficha.";

const PALABRAS_INGLES = /\b(the|of|by|from|and|with|in|at|on|is|are|was|for|to|that|this)\b/gi;

/** Un texto en español casi no usa estas palabras; con una sola es señal de que la IA no tradujo. */
export function pareceIngles(texto: string): boolean {
  return (texto.match(PALABRAS_INGLES) ?? []).length >= 1;
}

export function armarUsuarioDescribir(lote: MedioParaDescribir[]): string {
  return lote
    .map((m) => `[${m.id}] Banco: ${m.tema}\nTítulo original: ${m.titulo}\nFicha: ${m.texto.slice(0, 600) || "(sin descripción)"}`)
    .join("\n\n");
}

/**
 * Describe un lote de medios. Devuelve solo los que la IA respondió bien; los demás quedan pendientes
 * (`npm run bancos -- --solo-ia` los reintenta cuando haya cuota).
 */
export async function describirMedios(lote: MedioParaDescribir[], deps?: DepsEnrutador): Promise<Map<string, DescripcionMedios["medios"][number]>> {
  const salida = new Map<string, DescripcionMedios["medios"][number]>();
  if (lote.length === 0) return salida;
  const ids = new Set(lote.map((m) => m.id));
  const r = await ejecutar(
    {
      tarea: "describir-medio",
      sistema: SISTEMA_DESCRIBIR_MEDIO,
      usuario: armarUsuarioDescribir(lote),
      esquema: DescripcionMedios,
      maxTokens: 300 * lote.length + 200,
      temperatura: 0.2,
      rapido: true,
    },
    deps,
  );
  for (const m of r.datos.medios) {
    if (!ids.has(m.id) || salida.has(m.id) || pareceIngles(`${m.titulo} ${m.descripcion}`)) continue; // en inglés: queda pendiente
    salida.set(m.id, { ...m, etiquetas: [...new Set(m.etiquetas.map((e) => e.trim().toLowerCase().replace(/^#/, "")))].slice(0, 5) });
  }
  return salida;
}
