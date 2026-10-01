import type { ResultadoVerificacion } from "@/lib/contratos";

export type Problema = ResultadoVerificacion["problemas"][number];

export function resultado(problemas: Problema[]): ResultadoVerificacion {
  return { ok: !problemas.some((p) => p.severidad === "error"), problemas };
}

export const error = (ruta: string, mensaje: string): Problema => ({ ruta, mensaje, severidad: "error" });

/** Minúsculas, sin tildes ni signos de puntuación y con espacios simples. */
export function normalizarTexto(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[¿?¡!.,;:«»"'()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Recorre un valor anidado y entrega cada string con su ruta. */
export function* recorrerStrings(valor: unknown, ruta: string): Generator<[string, string]> {
  if (typeof valor === "string") yield [ruta, valor];
  else if (Array.isArray(valor)) {
    for (let i = 0; i < valor.length; i++) yield* recorrerStrings(valor[i], `${ruta}[${i}]`);
  } else if (valor && typeof valor === "object") {
    for (const [k, v] of Object.entries(valor)) yield* recorrerStrings(v, `${ruta}.${k}`);
  }
}
