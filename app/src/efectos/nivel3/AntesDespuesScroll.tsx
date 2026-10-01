"use client";

import type { ReactNode } from "react";
import { Fijado } from "./Fijado";

/**
 * `antes-despues-scroll`: la sección se fija y el scroll mueve el divisor del comparador de un lado al otro
 * (el `Comparador` lee el progreso con `useFijado`). Sin comparador con los dos archivos no se fija nada.
 */
export function AntesDespuesScroll({ children }: { children: ReactNode }) {
  return (
    <Fijado
      id="antes-despues-scroll"
      recorridoVh={1.2}
      toleranciaAlto={1.8}
      alMontar={({ interno, desactivar }) => {
        if (!interno.querySelector("[data-comparador]")) desactivar();
      }}
    >
      {children}
    </Fijado>
  );
}
