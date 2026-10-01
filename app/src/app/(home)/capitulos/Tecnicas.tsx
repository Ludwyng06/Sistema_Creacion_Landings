"use client";

import { useMemo, useRef } from "react";
import { CAPAS, ESTILO_CAPA, fichasDeTecnicas } from "../capas";
import { Escenario } from "../Escenario";
import { useCoreografia } from "../gsap";
import { TEXTOS } from "../textos";

// Desde dónde llega cada ficha: los bordes de la pantalla, alternando (izquierda, derecha, arriba, abajo).
const ORIGENES = [
  { x: -1.1, y: -0.2 },
  { x: 1.1, y: -0.3 },
  { x: -1.1, y: 0.3 },
  { x: 1.1, y: 0.2 },
  { x: -0.2, y: -1.1 },
  { x: 0.3, y: 1.1 },
  { x: 0.2, y: -1.1 },
  { x: -0.3, y: 1.1 },
];

/** Capítulo 3 · Las 8 técnicas: las fichas vuelan desde los bordes y encajan en las 4 capas del prompt. */
export function Tecnicas() {
  const seccion = useRef<HTMLElement>(null);
  const fichas = useMemo(() => fichasDeTecnicas(), []);

  useCoreografia(seccion, (tl, raiz) => {
    const anchoPantalla = window.innerWidth;
    const altoPantalla = window.innerHeight;
    raiz.querySelectorAll<HTMLElement>("[data-ficha]").forEach((ficha, i) => {
      const o = ORIGENES[i % ORIGENES.length];
      tl.fromTo(
        ficha,
        { x: o.x * anchoPantalla, y: o.y * altoPantalla, rotate: (i % 2 ? 1 : -1) * (14 + i * 3), opacity: 0 },
        { x: 0, y: 0, rotate: 0, opacity: 1, duration: 0.14, ease: "power3.out" },
        0.04 + i * 0.09,
      );
    });
    // Cuando todas encajaron, cada capa se marca con su color.
    tl.fromTo("[data-capa]", { scale: 0.97 }, { scale: 1, duration: 0.12, stagger: 0.03 }, 0.82);
  });

  return (
    <Escenario id="tecnicas" ref={seccion} etiqueta="Las 8 técnicas" className="flex flex-col items-center justify-center gap-4 px-4 pt-16">
      <div className="max-w-2xl text-center">
        <h2 className="text-balance font-editorial text-[clamp(1.75rem,6vw,3.5rem)] font-semibold leading-none tracking-tight">{TEXTOS.tecnicas.titular}</h2>
        <p className="mt-2 text-pretty text-sm text-tinta-suave md:text-lg">{TEXTOS.tecnicas.apoyo}</p>
      </div>
      <div className="grid w-full max-w-5xl grid-cols-1 gap-2 md:grid-cols-2 md:gap-3">
        {CAPAS.map((capa) => {
          const estilo = ESTILO_CAPA[capa];
          return (
            <div key={capa} data-capa={capa} className={`rounded-xl border-2 p-2 md:p-3 ${estilo.caja}`}>
              <p className={`mb-1.5 text-xs font-semibold uppercase tracking-wider md:text-sm ${estilo.titulo}`}>{TEXTOS.tecnicas.capas[capa]}</p>
              <ul className="grid grid-cols-2 gap-2">
                {fichas
                  .filter((f) => f.capa === capa)
                  .map((f) => (
                    <li key={f.id} data-ficha={f.id} className={`rounded-lg border-2 bg-papel p-2 shadow-sm will-change-transform ${estilo.ficha}`}>
                      <p className="text-[0.7rem] font-medium leading-tight text-tinta-suave md:text-xs">Técnica {f.numero}</p>
                      <p className="text-sm font-semibold leading-tight md:text-base">{f.nombre}</p>
                      <p className="mt-1 hidden text-xs leading-snug text-tinta-suave md:block">{f.resumen}</p>
                      <span className="mt-1.5 flex gap-1" aria-label={`Aporta a: ${f.aporta.map((c) => TEXTOS.tecnicas.capas[c]).join(", ")}`}>
                        {CAPAS.map((c) => (
                          <span key={c} aria-hidden="true" className={`size-2 rounded-full ${f.aporta.includes(c) ? ESTILO_CAPA[c].punto : "bg-linea"}`} />
                        ))}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          );
        })}
      </div>
    </Escenario>
  );
}
