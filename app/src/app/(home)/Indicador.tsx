"use client";

import { CAPITULOS } from "./capitulos";
import { useScrollChapter } from "./use-scroll-chapter";

/** Marca de dónde vas en el recorrido: número y nombre del capítulo. Es solo orientación visual. */
export function Indicador() {
  const { capitulo } = useScrollChapter();
  return (
    <p
      aria-hidden="true"
      data-indicador-capitulo={capitulo.numero}
      className="pointer-events-none fixed bottom-3 left-3 z-40 rounded-full bg-tinta/85 px-3 py-1 text-xs font-medium text-papel"
    >
      {capitulo.numero + 1} / {CAPITULOS.length} · {capitulo.nombre}
    </p>
  );
}
