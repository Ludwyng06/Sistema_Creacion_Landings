"use client";

import { useEffect, useRef, useState } from "react";
import { CreditoCorto } from "@/componentes/CreditoCorto";
import { MediaSlot } from "@/componentes/MediaSlot";
import type { BloqueImagen } from "./schema";

type Imagen = BloqueImagen["ajustes"];

/**
 * Carrusel con scroll-snap y una fila de miniaturas: deslizar con el dedo o el teclado, o tocar una miniatura.
 * La miniatura activa se sigue con `IntersectionObserver`; sin él, la primera queda activa.
 */
export function CarruselDeslizante({ titulo, imagenes }: { titulo: string; imagenes: Imagen[] }) {
  const pista = useRef<HTMLUListElement>(null);
  const [activa, setActiva] = useState(0);

  useEffect(() => {
    const el = pista.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observador = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) if (e.isIntersecting && e.intersectionRatio >= 0.6) setActiva(Number((e.target as HTMLElement).dataset.indice));
      },
      { root: el, threshold: [0.6] },
    );
    el.querySelectorAll("[data-indice]").forEach((li) => observador.observe(li));
    return () => observador.disconnect();
  }, [imagenes.length]);

  function ir(i: number) {
    setActiva(i);
    const li = pista.current?.querySelector<HTMLElement>(`[data-indice="${i}"]`);
    if (li && pista.current) pista.current.scrollTo({ left: li.offsetLeft - pista.current.offsetLeft, behavior: "smooth" });
  }

  return (
    <div className="mt-10" data-carrusel-deslizante>
      <ul
        ref={pista}
        role="region"
        aria-label={titulo}
        tabIndex={0}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento"
      >
        {imagenes.map((imagen, i) => (
          <li key={`${imagen.slot}-${i}`} data-indice={i} className="w-full shrink-0 snap-center md:w-[70%]">
            <figure>
              <MediaSlot slot={imagen.slot} slotPorDefecto={imagen.slot} relacion="4:5" />
              {imagen.pie && <figcaption className="mt-2 text-sm text-suave">{imagen.pie}</figcaption>}
              <CreditoCorto slot={imagen.slot} className="mt-1" />
            </figure>
          </li>
        ))}
      </ul>
      <ul className="mt-2 flex gap-2 overflow-x-auto" aria-label="Miniaturas">
        {imagenes.map((imagen, i) => (
          <li key={`${imagen.slot}-m-${i}`} className="w-16 shrink-0">
            <button
              type="button"
              onClick={() => ir(i)}
              aria-label={`Ver la imagen ${i + 1} de ${imagenes.length}`}
              aria-current={activa === i ? "true" : undefined}
              className="block w-full overflow-hidden rounded-token border-2 border-transparent aria-[current=true]:border-acento focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento"
            >
              <MediaSlot slot={imagen.slot} slotPorDefecto={imagen.slot} relacion="1:1" compacto />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
