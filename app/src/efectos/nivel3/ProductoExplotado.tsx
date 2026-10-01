"use client";

import type { ReactNode } from "react";
import { Fijado } from "./Fijado";

const CAPAS_MAXIMAS = 5;

/** Capas del producto: las imágenes (o marcadores de asset) de la sección, sin contar las anidadas. */
export function capasDe(interno: HTMLElement): HTMLElement[] {
  const candidatas = [...interno.querySelectorAll<HTMLElement>(".media-slot, [data-marcador-slot]")];
  return candidatas.filter((el) => !candidatas.some((otro) => otro !== el && otro.contains(el))).slice(0, CAPAS_MAXIMAS);
}

/**
 * `producto-explotado`: las capas del producto se separan en Z (y un poco en X e Y) con el scroll y se vuelven a armar.
 * La separación es `sin(--p × 180°)`: cero al inicio y al final, máxima a mitad del recorrido.
 */
export function ProductoExplotado({ children }: { children: ReactNode }) {
  return (
    <Fijado
      id="producto-explotado"
      recorridoVh={1.6}
      alMontar={({ interno, desactivar }) => {
        const capas = capasDe(interno);
        if (capas.length === 0) {
          desactivar();
          return;
        }
        const abierto = "sin(calc(var(--p) * 180deg))";
        capas.forEach((capa, i) => {
          const c = i - (capas.length - 1) / 2;
          // Una sola capa: se despega hacia la cámara y se inclina; varias: se reparten en profundidad.
          const [x, y, z] = capas.length === 1 ? [0, 0, 140] : [c * 26, c * -60, c * 110];
          capa.style.transform = `perspective(1200px) translate3d(calc(${abierto} * ${x}px), calc(${abierto} * ${y}px), calc(${abierto} * ${z}px)) rotateX(calc(${abierto} * 9deg))`;
          capa.style.willChange = "transform";
        });
        return () =>
          capas.forEach((capa) => {
            capa.style.transform = "";
            capa.style.willChange = "";
          });
      }}
    >
      {children}
    </Fijado>
  );
}
