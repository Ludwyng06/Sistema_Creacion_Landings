"use client";

import { useRef, type PointerEvent, type ReactNode } from "react";
import { useEfecto } from "./contexto-efectos";
import { useMovimiento } from "./movimiento";

const FUERZA = 0.3;
const MAXIMO_PX = 14;

function limitar(valor: number): number {
  return Math.max(-MAXIMO_PX, Math.min(MAXIMO_PX, valor));
}

/**
 * `boton-magnetico`: el botón se acerca un poco al puntero. Solo con `pointer: fine`
 * y sin `prefers-reduced-motion`; en los demás casos es un contenedor inerte.
 */
export function Magnetico({ children, className = "" }: { children: ReactNode; className?: string }) {
  const efecto = useEfecto("boton-magnetico");
  const { reducido, punteroFino } = useMovimiento();
  const ref = useRef<HTMLSpanElement>(null);
  const activo = efecto && punteroFino && !reducido;

  function alMover(evento: PointerEvent<HTMLSpanElement>) {
    const caja = ref.current?.getBoundingClientRect();
    if (!caja || !ref.current) return;
    const dx = evento.clientX - (caja.left + caja.width / 2);
    const dy = evento.clientY - (caja.top + caja.height / 2);
    ref.current.style.transform = `translate3d(${limitar(dx * FUERZA)}px, ${limitar(dy * FUERZA)}px, 0)`;
  }

  function alSalir() {
    if (ref.current) ref.current.style.transform = "translate3d(0, 0, 0)";
  }

  return (
    <span
      ref={ref}
      data-efecto={activo ? "boton-magnetico" : undefined}
      className={`inline-block ${activo ? "transition-transform duration-200 ease-out" : ""} ${className}`}
      onPointerMove={activo ? alMover : undefined}
      onPointerLeave={activo ? alSalir : undefined}
    >
      {children}
    </span>
  );
}
