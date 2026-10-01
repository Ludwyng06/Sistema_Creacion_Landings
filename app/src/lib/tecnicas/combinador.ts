import type { Brief, PromptEstructurado, Semilla, TecnicaId } from "@/lib/contratos";
import { armarPrompt } from "./armado";
import { modulos } from "./modulos";
import { tirarSemilla } from "./semillas";

// Motor de combinación (docs/04 §9). Sin llamadas a IA.

/** Perfil "Esencial": ambicioso + sustractivo + negativas. */
export const PERFIL_ESENCIAL: TecnicaId[] = ["ambicioso", "sustractivo", "negativas"];

function numeroDesdeTexto(texto: string): number {
  let h = 2166136261;
  for (const c of texto) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) % 1_000_000;
}

/** Técnicas efectivas: sin selección usa el perfil Esencial y la 7 siempre está activa. */
export function tecnicasEfectivas(tecnicas: TecnicaId[]): TecnicaId[] {
  const elegidas = new Set<TecnicaId>(tecnicas.length > 0 ? tecnicas : PERFIL_ESENCIAL);
  elegidas.add("negativas");
  return modulos
    .filter((m) => elegidas.has(m.id))
    .sort((a, b) => a.prioridad - b.prioridad)
    .map((m) => m.id);
}

/**
 * Combina las técnicas en un solo prompt de 4 bloques.
 * Orden: 2 → 1 → 6 → 4 → 5 → 7 → 8 → 3. Si se elige la técnica 1 sin semilla,
 * la semilla sale de un número derivado del nombre del producto (reproducible).
 */
export function combinar(brief: Brief, tecnicas: TecnicaId[], semilla?: Semilla): PromptEstructurado {
  const ids = tecnicasEfectivas(tecnicas);
  const orden = ids.map((id) => modulos.find((m) => m.id === id)!);
  const semillaEfectiva =
    semilla ?? (ids.includes("semilla") ? tirarSemilla(numeroDesdeTexto(brief.nombre), brief.intensidad).semilla : undefined);
  return armarPrompt({ brief, modulos: orden, semilla: semillaEfectiva, modo: "combinado" });
}
