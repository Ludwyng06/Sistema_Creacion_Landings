"use client";

import type { ReactNode, Ref } from "react";
import { useMovimiento } from "@/efectos/movimiento";
import { CAPITULOS, type IdCapitulo } from "./capitulos";

interface Props {
  id: IdCapitulo;
  ref?: Ref<HTMLElement>;
  children: ReactNode;
  /** Clases del contenido fijo (la pantalla que se queda mientras corre el capítulo). */
  className?: string;
  /** Etiqueta accesible de la sección. */
  etiqueta?: string;
}

/**
 * Un capítulo del recorrido: una sección alta (su recorrido de scroll) con una pantalla fija (`sticky`) dentro.
 * Con `prefers-reduced-motion` no hay recorrido: la sección mide lo que su contenido y nada se queda fijo.
 */
export function Escenario({ id, ref, children, className = "", etiqueta }: Props) {
  const { reducido } = useMovimiento();
  const capitulo = CAPITULOS.find((c) => c.id === id)!;
  return (
    <section
      ref={ref}
      id={id}
      aria-label={etiqueta ?? capitulo.nombre}
      data-capitulo={capitulo.numero}
      style={reducido ? undefined : { height: `${capitulo.alto}svh` }}
      className="relative"
    >
      <div className={`${reducido ? "min-h-svh py-24" : "sticky top-0 h-svh"} overflow-hidden ${className}`}>{children}</div>
    </section>
  );
}
