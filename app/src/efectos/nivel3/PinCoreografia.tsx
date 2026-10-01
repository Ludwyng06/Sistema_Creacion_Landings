"use client";

import type { ReactNode } from "react";
import { Fijado } from "./Fijado";
import { recorridoPin, umbralBloque } from "./progreso";

/** Bloques de la sección: los `li` (o `[data-bloque]`) y, si no hay, los hijos del contenedor principal. */
export function bloquesDe(interno: HTMLElement): HTMLElement[] {
  const candidatos = [...interno.querySelectorAll<HTMLElement>("li, [data-bloque]")];
  const propios = candidatos.filter((el) => !candidatos.some((otro) => otro !== el && otro.contains(el)));
  if (propios.length >= 2) return propios;
  const contenedor = interno.querySelector<HTMLElement>("section > div");
  const hijos = contenedor ? ([...contenedor.children] as HTMLElement[]) : [];
  return hijos.length >= 2 ? hijos : [];
}

/**
 * `pin-coreografia`: la sección se fija y sus bloques entran en secuencia con el scroll. El avance sale de la
 * variable CSS `--p` (0–1) con `clamp()`, así que solo se animan `transform` y `opacity`.
 */
export function PinCoreografia({ children }: { children: ReactNode }) {
  return (
    <Fijado
      id="pin-coreografia"
      alMontar={({ interno, fijarRecorrido, desactivar }) => {
        const bloques = bloquesDe(interno);
        if (bloques.length < 2) {
          desactivar();
          return;
        }
        bloques.forEach((el, i) => {
          const entra = `clamp(0, calc((var(--p) - ${umbralBloque(i, bloques.length).toFixed(3)}) * 6), 1)`;
          el.style.opacity = `calc(0.12 + ${entra} * 0.88)`;
          el.style.transform = `translate3d(0, calc((1 - ${entra}) * 28px), 0)`;
          el.style.willChange = "transform, opacity";
        });
        fijarRecorrido(recorridoPin(bloques.length, window.innerHeight));
        return () =>
          bloques.forEach((el) => {
            el.style.opacity = "";
            el.style.transform = "";
            el.style.willChange = "";
          });
      }}
    >
      {children}
    </Fijado>
  );
}
