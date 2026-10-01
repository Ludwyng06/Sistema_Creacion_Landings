import type { BloquePrompt, PromptEstructurado } from "@/lib/contratos";

export type LineaDiff = { tipo: "igual" | "quita" | "agrega"; texto: string };

/** Diff simple por líneas: lo que ya no está, lo nuevo y lo que se mantiene (en el orden del nuevo texto). */
export function diffLineas(antes: string, despues: string): LineaDiff[] {
  const lineas = (t: string) => t.split("\n").filter((l) => l.trim() !== "");
  const a = lineas(antes);
  const d = lineas(despues);
  const enAntes = new Set(a);
  const enDespues = new Set(d);
  return [
    ...a.filter((l) => !enDespues.has(l)).map((texto) => ({ tipo: "quita" as const, texto })),
    ...d.map((texto) => ({ tipo: enAntes.has(texto) ? ("igual" as const) : ("agrega" as const), texto })),
  ];
}

export const BLOQUES: BloquePrompt[] = ["rol", "tarea", "contexto", "formato"];

/** Bloques cuyo texto cambió, con su diff. */
export function diffPrompt(
  antes: PromptEstructurado,
  despues: PromptEstructurado,
): { bloque: BloquePrompt; lineas: LineaDiff[] }[] {
  return BLOQUES.filter((b) => antes[b] !== despues[b]).map((bloque) => ({
    bloque,
    lineas: diffLineas(antes[bloque], despues[bloque]),
  }));
}

/** Parte un texto en segmentos para resaltar la primera aparición de `fragmento`. */
export function partirResaltado(texto: string, fragmento: string): { texto: string; resaltado: boolean }[] {
  const f = fragmento.trim();
  const i = f ? texto.indexOf(f) : -1;
  if (i < 0) return [{ texto, resaltado: false }];
  return [
    { texto: texto.slice(0, i), resaltado: false },
    { texto: f, resaltado: true },
    { texto: texto.slice(i + f.length), resaltado: false },
  ].filter((s) => s.texto !== "");
}
