"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { useMovimiento } from "@/efectos/movimiento";
import type { TarjetaBanco } from "../banco-tarjetas";
import { formatearPuntaje } from "../radar";
import { TEXTOS } from "../textos";

function Tarjeta({ tarjeta, reducido }: { tarjeta: TarjetaBanco; reducido: boolean }) {
  const [volteada, setVolteada] = useState(false);
  const idPrompt = useId();
  const cara = "absolute inset-0 flex flex-col rounded-2xl border border-linea bg-papel p-5 shadow-sm";
  // Con movimiento la tarjeta gira en 3D; con `reduced-motion` las caras se funden (sin giro).
  const estiloCara = (delante: boolean): React.CSSProperties =>
    reducido
      ? { opacity: volteada === delante ? 0 : 1, transition: "opacity 200ms ease", pointerEvents: volteada === delante ? "none" : "auto" }
      : { backfaceVisibility: "hidden", transform: delante ? undefined : "rotateY(180deg)" };

  return (
    <li className="h-[26rem] w-[82vw] shrink-0 snap-center [perspective:1200px] sm:w-80 sm:snap-start" data-tarjeta-banco={tarjeta.id} data-volteada={volteada ? "true" : "false"}>
      <div
        className="relative size-full"
        style={reducido ? undefined : { transformStyle: "preserve-3d", transition: "transform 700ms cubic-bezier(0.16, 1, 0.3, 1)", transform: volteada ? "rotateY(180deg)" : undefined }}
      >
        <div className={cara} style={estiloCara(true)} aria-hidden={volteada} inert={volteada}>
          <div className="flex items-start justify-between gap-2">
            <p className="font-editorial text-2xl font-semibold leading-tight">{tarjeta.nombre}</p>
            {tarjeta.esEjemplo && <span className="shrink-0 rounded-full bg-marca px-3 py-0.5 text-xs font-medium text-marca-texto">{TEXTOS.banco.ejemplo}</span>}
          </div>
          <p className="mt-2 text-sm text-tinta-suave">{tarjeta.puntaje === null ? TEXTOS.banco.sinPuntaje : `Puntaje ${formatearPuntaje(tarjeta.puntaje)} de 10`}</p>
          <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Técnicas usadas">
            {tarjeta.tecnicas.map((t) => (
              <li key={t} className="rounded-full border border-linea px-2.5 py-0.5 text-xs">
                {t}
              </li>
            ))}
          </ul>
          <div className="mt-auto flex flex-col gap-2">
            {tarjeta.href && (
              <Link href={tarjeta.href} className="inline-flex min-h-11 items-center text-sm font-medium text-marca underline underline-offset-4">
                {TEXTOS.banco.verLanding}
              </Link>
            )}
            <button
              type="button"
              onClick={() => setVolteada(true)}
              aria-expanded={volteada}
              aria-controls={idPrompt}
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-marca px-4 text-sm font-medium text-marca-texto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca"
            >
              {TEXTOS.banco.voltear}
            </button>
          </div>
        </div>

        <div className={cara} style={estiloCara(false)} aria-hidden={!volteada} inert={!volteada} id={idPrompt}>
          <p className="text-sm font-medium">
            {TEXTOS.banco.promptDe} {tarjeta.nombre}
          </p>
          <pre
            tabIndex={volteada ? 0 : -1}
            aria-label={`${TEXTOS.banco.promptDe} ${tarjeta.nombre}`}
            className="mt-2 flex-1 overflow-y-auto whitespace-pre-wrap rounded-md bg-papel-hondo p-3 font-ui text-xs leading-relaxed text-tinta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca"
          >
            {tarjeta.prompt}
          </pre>
          <button
            type="button"
            onClick={() => setVolteada(false)}
            className="mt-3 inline-flex min-h-11 items-center justify-center rounded-md border border-tinta px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca"
          >
            {TEXTOS.banco.volver}
          </button>
        </div>
      </div>
    </li>
  );
}

/**
 * Capítulo 7 · El banco: tarjetas de landings reales en una pista con scroll-snap nativo (sin fijar la pantalla).
 * Cada tarjeta se voltea con clic o Enter y muestra su prompt por detrás.
 */
export function Banco({ tarjetas }: { tarjetas: TarjetaBanco[] }) {
  const { reducido } = useMovimiento();
  return (
    <section id="banco" aria-label="El banco" data-capitulo="7" className="py-20 md:py-28">
      <div className="mx-auto max-w-5xl px-4">
        <h2 className="text-balance font-editorial text-[clamp(1.75rem,6vw,3.5rem)] font-semibold leading-none tracking-tight">{TEXTOS.banco.titular}</h2>
        <p className="mt-3 max-w-2xl text-pretty text-base text-tinta-suave md:text-lg">{TEXTOS.banco.apoyo}</p>
      </div>
      <ul
        role="region"
        aria-label={TEXTOS.banco.region}
        tabIndex={0}
        data-pista-banco
        className="mx-auto mt-8 flex max-w-6xl snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca"
      >
        {tarjetas.map((t) => (
          <Tarjeta key={t.id} tarjeta={t} reducido={reducido} />
        ))}
      </ul>
      <div className="mx-auto mt-4 max-w-5xl px-4">
        <Link href="/banco" className="inline-flex min-h-11 items-center rounded-md border border-tinta px-5 text-base font-medium hover:bg-papel-hondo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca">
          {TEXTOS.banco.enlace}
        </Link>
      </div>
    </section>
  );
}
