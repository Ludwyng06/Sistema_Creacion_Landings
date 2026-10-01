"use client";

import { useEffect, useRef, useState } from "react";
import { useMovimiento } from "./movimiento";

/**
 * `cursor-vivo` (global): un anillo sigue al puntero y muestra una palabra según lo que
 * tenga encima (`data-cursor="Ver"`, `"Enviar"`…). Solo con `pointer: fine` y sin
 * `prefers-reduced-motion`; si no, no se pinta y queda el cursor nativo.
 */
export function CursorVivo() {
  const { reducido, punteroFino } = useMovimiento();
  const activo = punteroFino && !reducido;
  const anillo = useRef<HTMLDivElement>(null);
  const [etiqueta, setEtiqueta] = useState("");

  useEffect(() => {
    const anfitrion = anillo.current?.parentElement;
    if (!activo || !anfitrion) return;

    const objetivo = { x: -100, y: -100 };
    const actual = { x: -100, y: -100 };
    let cuadro = 0;

    const dibujar = () => {
      actual.x += (objetivo.x - actual.x) * 0.2;
      actual.y += (objetivo.y - actual.y) * 0.2;
      if (anillo.current) {
        anillo.current.style.transform = `translate3d(${actual.x}px, ${actual.y}px, 0) translate(-50%, -50%)`;
      }
      cuadro = requestAnimationFrame(dibujar);
    };
    cuadro = requestAnimationFrame(dibujar);

    const alMover = (evento: PointerEvent) => {
      objetivo.x = evento.clientX;
      objetivo.y = evento.clientY;
      const destino = evento.target instanceof Element ? evento.target.closest("[data-cursor]") : null;
      setEtiqueta(destino?.getAttribute("data-cursor") ?? "");
    };
    const alSalir = () => {
      objetivo.x = -100;
      objetivo.y = -100;
      setEtiqueta("");
    };

    anfitrion.addEventListener("pointermove", alMover);
    anfitrion.addEventListener("pointerleave", alSalir);
    return () => {
      cancelAnimationFrame(cuadro);
      anfitrion.removeEventListener("pointermove", alMover);
      anfitrion.removeEventListener("pointerleave", alSalir);
    };
  }, [activo]);

  if (!activo) return null;

  return (
    <div
      ref={anillo}
      aria-hidden="true"
      data-efecto="cursor-vivo"
      className="pointer-events-none fixed left-0 top-0 z-[60] grid place-items-center rounded-full border-2 border-acento text-xs font-medium text-acento-texto will-change-transform"
      style={{
        width: etiqueta ? 72 : 18,
        height: etiqueta ? 72 : 18,
        background: etiqueta ? "var(--c-acento)" : "transparent",
        transition: "width 200ms, height 200ms, background 200ms",
      }}
    >
      {etiqueta}
    </div>
  );
}
