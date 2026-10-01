"use client";

import { useRef, type ReactNode } from "react";
import { useMovimiento, useRevelado } from "./movimiento";

/**
 * `revelar-suave`: la sección sube y aparece al entrar en pantalla (transform + opacity). La que ya está a la vista al
 * cargar anima con CSS desde el primer pintado (`entrada-subir`); las de más abajo esperan su turno (`useRevelado`).
 */
export function Revelar({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const { reducido } = useMovimiento();
  const estado = useRevelado(ref);
  const alCargar = estado === "inicial" || estado === "arriba";

  return (
    <div
      ref={ref}
      data-efecto="revelar-suave"
      data-estado={reducido ? "estatico" : estado === "oculto" ? "oculto" : "visible"}
      className={
        reducido
          ? undefined
          : alCargar
            ? "entrada-subir"
            : `transition-[opacity,transform] duration-700 ease-out ${estado === "oculto" ? "translate-y-6 opacity-0" : "translate-y-0 opacity-100"}`
      }
    >
      {children}
    </div>
  );
}
