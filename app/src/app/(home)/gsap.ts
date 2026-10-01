"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useMovimiento } from "@/efectos/movimiento";

let registrado = false;
export function registrarGsap(): typeof gsap {
  if (!registrado && typeof window !== "undefined") {
    gsap.registerPlugin(ScrollTrigger);
    registrado = true;
  }
  return gsap;
}

/**
 * Coreografía ligada al scroll de un capítulo alto: una línea de tiempo con `ScrollTrigger` (scrub) que
 * recorre todo el capítulo. Con `prefers-reduced-motion` no se crea nada y el capítulo queda en su estado final.
 * Solo anima `transform` y `opacity` para sostener los 60 fps.
 */
export function useCoreografia(
  capitulo: RefObject<HTMLElement | null>,
  construir: (tl: gsap.core.Timeline, raiz: HTMLElement) => void,
  /** Si cambia (por ejemplo el ancho medido de un marco), la línea de tiempo se vuelve a construir. */
  clave?: unknown,
): void {
  const { reducido } = useMovimiento();
  const construirRef = useRef(construir);
  useLayoutEffect(() => {
    construirRef.current = construir;
  });

  useLayoutEffect(() => {
    const raiz = capitulo.current;
    if (reducido || !raiz) return;
    const g = registrarGsap();
    const contexto = g.context(() => {
      const tl = g.timeline({
        defaults: { ease: "none" },
        scrollTrigger: { trigger: raiz, start: "top top", end: "bottom bottom", scrub: 0.6 },
      });
      construirRef.current(tl, raiz);
    }, raiz);
    return () => contexto.revert();
  }, [capitulo, reducido, clave]);
}
