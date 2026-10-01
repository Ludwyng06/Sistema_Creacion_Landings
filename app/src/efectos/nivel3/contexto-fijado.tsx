"use client";

import { createContext, useContext, type RefObject } from "react";

export interface ApiFijado {
  /** Progreso 0–1 del efecto; se actualiza en cada cuadro de scroll sin volver a renderizar. */
  progreso: RefObject<number>;
  /** Avisa a `cb` en cada cambio de progreso. Devuelve la función que cancela la suscripción. */
  suscribir: (cb: (p: number) => void) => () => void;
}

const Contexto = createContext<ApiFijado | null>(null);
export const ProveedorFijado = Contexto.Provider;

/** Progreso del efecto de nivel 3 que envuelve al componente; `null` fuera de uno. */
export const useFijado = (): ApiFijado | null => useContext(Contexto);
