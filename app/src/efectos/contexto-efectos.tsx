"use client";

import { createContext, useContext } from "react";
import type { EfectoId } from "@/lib/contratos";

const SIN_EFECTOS: readonly EfectoId[] = [];

const ContextoEfectos = createContext<readonly EfectoId[]>(SIN_EFECTOS);

/** Lo alimenta `LandingRender` con los efectos ya filtrados de la sección. */
export const ProveedorEfectos = ContextoEfectos.Provider;

export function useEfecto(id: EfectoId): boolean {
  return useContext(ContextoEfectos).includes(id);
}
