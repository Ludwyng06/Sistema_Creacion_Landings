import { z } from "zod";
import { COMPLETAR } from "@/componentes/dinero";

/** Nombre de un slot de `doc.assets`. */
export const Slot = z.string().min(1);

/** Cifra que sale del brief; si falta, la IA deja `[COMPLETAR]` (regla 6). */
export const NumeroODato = z.union([z.number().nonnegative(), z.literal(COMPLETAR)]);

export const SinBloques = z.array(z.never()).max(0);

export function contarPalabras(texto: string): number {
  return texto.trim().split(/\s+/).filter(Boolean).length;
}
