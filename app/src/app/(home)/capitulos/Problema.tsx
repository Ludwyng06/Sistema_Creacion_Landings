"use client";

import { useRef } from "react";
import { Escenario } from "../Escenario";
import { useCoreografia } from "../gsap";
import { TEXTOS } from "../textos";

const MINIATURAS = 12;

/** Una landing genérica hecha con divs: título a la izquierda, imagen a la derecha y un degradado morado. */
function Miniatura({ indice }: { indice: number }) {
  return (
    <div data-miniatura className="relative overflow-hidden rounded-md border border-linea bg-papel shadow-sm" style={{ aspectRatio: "4 / 3" }}>
      <div className="absolute inset-x-0 top-0 h-2 bg-formato-suave" />
      <div className="grid h-full grid-cols-2 items-center gap-2 p-2 pt-3">
        <div className="flex flex-col gap-1">
          <span className="h-1.5 w-full rounded-full bg-tinta" />
          <span className="h-1.5 w-4/5 rounded-full bg-tinta" />
          <span className="mt-1 h-1 w-3/5 rounded-full bg-linea" />
          <span className="h-1 w-2/5 rounded-full bg-linea" />
          <span className="mt-1 h-2.5 w-1/2 rounded-full bg-formato" />
        </div>
        <div className="aspect-square w-full rounded-md bg-gradient-to-br from-formato to-rol opacity-90" />
      </div>
      <span className="sr-only">Landing genérica {indice + 1}</span>
      <span data-tacha aria-hidden="true" className="absolute left-[-4%] top-1/2 h-[3px] w-[108%] origin-left -rotate-[8deg] bg-error" />
    </div>
  );
}

/** Capítulo 1 · El problema: doce landings idénticas que se tachan y se derrumban al bajar. */
export function Problema() {
  const seccion = useRef<HTMLElement>(null);

  useCoreografia(seccion, (tl, raiz) => {
    const minis = raiz.querySelectorAll<HTMLElement>("[data-miniatura]");
    const tachas = raiz.querySelectorAll<HTMLElement>("[data-tacha]");
    // 0–50 %: las líneas rojas las tachan una por una.
    tl.fromTo(tachas, { scaleX: 0 }, { scaleX: 1, duration: 0.3, stagger: { each: 0.02, from: "start" } }, 0.05);
    // 55–95 %: se derrumban hacia abajo, cada una con su giro.
    minis.forEach((mini, i) => {
      tl.to(mini, { y: window.innerHeight * 1.1, rotate: (i % 2 ? 1 : -1) * (6 + (i % 5) * 4), opacity: 0.2, duration: 0.3, ease: "power2.in" }, 0.62 + (i % 6) * 0.05);
    });
  });

  return (
    <Escenario id="problema" ref={seccion} etiqueta="El problema" className="flex flex-col items-center justify-center gap-6 px-4 pt-16">
      <div data-mensaje-problema className="relative z-10 max-w-2xl text-center">
        <h2 className="text-balance font-editorial text-[clamp(2rem,7vw,4rem)] font-semibold leading-none tracking-tight">{TEXTOS.problema.titular}</h2>
        <p className="mt-3 text-pretty text-base text-tinta-suave md:text-lg">{TEXTOS.problema.apoyo}</p>
      </div>
      <div className="grid w-full max-w-5xl grid-cols-3 gap-2 md:grid-cols-4 md:gap-3 lg:grid-cols-6" role="img" aria-label="Un muro de doce landings genéricas, todas tachadas">
        {Array.from({ length: MINIATURAS }, (_, i) => (
          <Miniatura key={i} indice={i} />
        ))}
      </div>
    </Escenario>
  );
}
