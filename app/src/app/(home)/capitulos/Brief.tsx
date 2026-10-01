"use client";

import { useEffect, useRef } from "react";
import { useMovimiento } from "@/efectos/movimiento";
import { Escenario } from "../Escenario";
import { TEXTOS } from "../textos";
import { useProgresoDeElemento } from "../use-scroll-chapter";

const EJEMPLO = TEXTOS.brief.ejemplo;
/** Con esta parte de la frase escrita aparecen los chips del tipo detectado, y poco después las fuentes. */
const UMBRAL_TIPO = 0.6;
const UMBRAL_FUENTES = 0.8;

/** La parte de la frase escrita según el progreso 0–1 (función pura): nunca retrocede. */
export function textoEscrito(progreso: number): string {
  return EJEMPLO.slice(0, Math.round(Math.min(1, Math.max(0, progreso)) * EJEMPLO.length));
}

/** Qué piezas ya se ven con ese progreso de escritura. */
export function piezasVisibles(progreso: number): { tipo: boolean; fuentes: number } {
  const p = Math.min(1, Math.max(0, progreso));
  const fuentes = p < UMBRAL_FUENTES ? 0 : Math.min(TEXTOS.brief.listaFuentes.length, 1 + Math.floor(((p - UMBRAL_FUENTES) / (1 - UMBRAL_FUENTES)) * TEXTOS.brief.listaFuentes.length));
  return { tipo: p >= UMBRAL_TIPO, fuentes };
}

/** Los de fuente pasan de «apagados» a «activos» por su borde y su fondo; el texto conserva siempre su contraste. */
const Chip = ({ children, sitio }: { children: string; sitio?: boolean }) => (
  <span
    className={`inline-flex min-h-8 items-center rounded-full border px-3 text-sm font-medium text-tinta transition-colors duration-300 ${sitio ? "border-linea bg-transparent group-data-[activa=true]:border-marca group-data-[activa=true]:bg-marca/10" : "border-linea bg-papel-hondo"}`}
  >
    {children}
  </span>
);

/** Capítulo 2 · El brief: un solo campo que se escribe solo con un ejemplo de otro tipo y activa tipo y fuentes. */
export function BriefCap() {
  const seccion = useRef<HTMLElement>(null);
  const campo = useRef<HTMLSpanElement>(null);
  const tipo = useRef<HTMLDivElement>(null);
  const fuentes = useRef<(HTMLSpanElement | null)[]>([]);
  const { reducido } = useMovimiento();

  const pintar = (p: number) => {
    if (campo.current) campo.current.textContent = textoEscrito(p);
    const v = piezasVisibles(p);
    if (tipo.current) tipo.current.style.opacity = v.tipo ? "1" : "0";
    fuentes.current.forEach((el, i) => el && (el.dataset.activa = String(i < v.fuentes)));
  };
  // Se termina de escribir al 85 % del recorrido y el resto queda leyéndose.
  const progreso = useProgresoDeElemento(seccion, (p) => pintar(p / 0.85));

  useEffect(() => {
    if (reducido) pintar(1);
    else pintar((progreso.current ?? 0) / 0.85);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al cambiar la preferencia de movimiento
  }, [reducido]);

  return (
    <Escenario id="brief" ref={seccion} etiqueta="La idea" className="flex flex-col items-center justify-center gap-6 px-4 pt-16">
      <div className="max-w-2xl text-center">
        <h2 className="text-balance font-editorial text-[clamp(2rem,7vw,4rem)] font-semibold leading-none tracking-tight">{TEXTOS.brief.titular}</h2>
        <p className="mt-3 text-pretty text-base text-tinta-suave md:text-lg">{TEXTOS.brief.apoyo}</p>
      </div>
      <form onSubmit={(e) => e.preventDefault()} aria-label="Ejemplo de encargo" className="flex w-full max-w-xl flex-col gap-4 rounded-xl border border-linea bg-papel p-4 shadow-sm md:p-6">
        <div>
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-tinta-suave">{TEXTOS.brief.campo}</span>
          <div role="group" aria-label={`${TEXTOS.brief.campo} ${EJEMPLO}`} className="relative min-h-11 rounded-md border border-linea bg-papel-hondo px-3 py-2 text-base text-tinta md:text-lg">
            {/* El texto completo, invisible, reserva el alto final: al escribir, nada se mueve. */}
            <span aria-hidden="true" className="invisible block">
              {EJEMPLO}{" "}
            </span>
            <span aria-hidden="true" className="absolute inset-0 px-3 py-2">
              <span ref={campo}>{EJEMPLO}</span>
              <span className="ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 animate-pulse bg-tinta" />
            </span>
          </div>
        </div>
        <div ref={tipo} data-detectado className="transition-opacity duration-300" style={reducido ? undefined : { opacity: 0 }}>
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-tinta-suave">{TEXTOS.brief.detectado}</span>
          <div className="flex flex-wrap gap-2">
            <Chip>{TEXTOS.brief.tipo}</Chip>
            <Chip>{TEXTOS.brief.tematica}</Chip>
          </div>
        </div>
        <div data-fuentes>
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-tinta-suave">{TEXTOS.brief.fuentes}</span>
          <div className="flex flex-wrap gap-2">
            {TEXTOS.brief.listaFuentes.map((f, i) => (
              <span key={f} ref={(el) => void (fuentes.current[i] = el)} data-activa={reducido ? "true" : "false"} className="group">
                <Chip sitio>{f}</Chip>
              </span>
            ))}
          </div>
        </div>
      </form>
    </Escenario>
  );
}
