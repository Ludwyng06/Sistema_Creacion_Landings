"use client";

import { useMemo, useRef } from "react";
import { useMovimiento } from "@/efectos/movimiento";
import { Escenario } from "../Escenario";
import {
  PUNTAJES_ANTES,
  PUNTAJES_DESPUES,
  PUNTAJE_MAXIMO,
  ejesDeRubrica,
  entreValores,
  formatearPuntaje,
  poligono,
  puntajePonderado,
  puntoDeEje,
} from "../radar";
import { TEXTOS } from "../textos";
import { useProgresoDeElemento } from "../use-scroll-chapter";

const ANCHO = 520;
const ALTO = 450;
const CENTRO = { x: ANCHO / 2, y: 225 };
const RADIO = 125;
const ANILLOS = [2.5, 5, 7.5, 10];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const tramo = (p: number, desde: number, hasta: number) => clamp01((p - desde) / (hasta - desde));

/** Ancla del texto de un eje según hacia dónde apunta. */
function anclaDe(x: number): "start" | "middle" | "end" {
  const d = x - CENTRO.x;
  if (d > 12) return "start";
  if (d < -12) return "end";
  return "middle";
}

/**
 * Capítulo 6 · El crítico: radar de 8 ejes dibujado a mano en SVG. Con el scroll se trazan los ejes, aparece el
 * puntaje de antes (6,2), el polígono crece hasta el de después (9,1) y salen las anotaciones. Los nombres de los
 * ejes vienen de la rúbrica del crítico. Con `reduced-motion` el radar ya está dibujado.
 */
export function Critico() {
  const { reducido } = useMovimiento();
  const seccion = useRef<HTMLElement>(null);
  const anillos = useRef<SVGGElement>(null);
  const ejesTrazo = useRef<SVGGElement>(null);
  const antes = useRef<SVGPolygonElement>(null);
  const despues = useRef<SVGPolygonElement>(null);
  const puntaje = useRef<HTMLSpanElement>(null);
  const notas = useRef<HTMLOListElement>(null);

  const ejes = useMemo(() => ejesDeRubrica(), []);
  const totalAntes = useMemo(() => puntajePonderado(PUNTAJES_ANTES, ejes), [ejes]);
  const totalDespues = useMemo(() => puntajePonderado(PUNTAJES_DESPUES, ejes), [ejes]);
  const ceros = ejes.map(() => 0);

  const dibujar = (p: number) => {
    const trazo = tramo(p, 0, 0.2);
    ejesTrazo.current?.querySelectorAll<SVGLineElement>("line").forEach((l) => {
      l.style.strokeDashoffset = String((1 - trazo) * RADIO);
    });
    if (anillos.current) anillos.current.style.opacity = String(trazo);
    const mostrarAntes = tramo(p, 0.15, 0.3);
    const crece = tramo(p, 0.4, 0.85);
    if (antes.current) {
      antes.current.setAttribute("points", poligono(entreValores(ceros, PUNTAJES_ANTES, mostrarAntes), RADIO, CENTRO));
      antes.current.style.opacity = String(mostrarAntes * (1 - 0.6 * crece));
    }
    if (despues.current) {
      despues.current.setAttribute("points", poligono(entreValores(PUNTAJES_ANTES, PUNTAJES_DESPUES, crece), RADIO, CENTRO));
      despues.current.style.opacity = String(tramo(p, 0.3, 0.4));
    }
    if (puntaje.current) puntaje.current.textContent = formatearPuntaje(totalAntes + (totalDespues - totalAntes) * crece);
    notas.current?.querySelectorAll<HTMLElement>("li").forEach((li, i) => {
      const t = tramo(p, 0.55 + i * 0.1, 0.65 + i * 0.1);
      li.style.opacity = String(t);
      li.style.transform = `translate3d(0, ${(1 - t) * 10}px, 0) rotate(${[-2, 1.5, -1][i % 3]}deg)`;
    });
  };
  useProgresoDeElemento(seccion, reducido ? undefined : dibujar);

  // Estado inicial y estado final (reduced-motion): el radar ya dibujado.
  const inicial = reducido ? 1 : 0;
  const valoresAntes = reducido ? PUNTAJES_ANTES : ceros;
  const valoresDespues = reducido ? PUNTAJES_DESPUES : ceros;

  return (
    <Escenario id="critico" ref={seccion} etiqueta="El crítico" className="flex flex-col items-center justify-center gap-3 px-4 pt-16 lg:flex-row lg:gap-16">
      <div className="max-w-md text-center lg:text-left">
        <h2 className="text-balance font-editorial text-[clamp(1.75rem,6vw,3.5rem)] font-semibold leading-none tracking-tight">{TEXTOS.critico.titular}</h2>
        <p className="mt-2 text-pretty text-sm text-tinta-suave md:text-lg">{TEXTOS.critico.apoyo}</p>
        <p className="mt-2 hidden text-xs text-tinta-suave md:block">{TEXTOS.critico.ilustrativo}</p>
      </div>

      <div className="flex w-full max-w-xl flex-col items-center">
        <svg
          viewBox={`0 0 ${ANCHO} ${ALTO}`}
          role="img"
          aria-label={TEXTOS.critico.grafico}
          data-radar
          className="h-auto w-[min(94vw,42svh)] overflow-visible lg:w-[min(36rem,70svh)]"
        >
          <g ref={anillos} style={{ opacity: inicial }} className="stroke-linea" fill="none" strokeWidth={1}>
            {ANILLOS.map((v) => (
              <polygon key={v} points={poligono(ejes.map(() => v), RADIO, CENTRO)} />
            ))}
          </g>
          <g ref={ejesTrazo} className="stroke-tinta-suave" strokeWidth={1}>
            {ejes.map((_, i) => {
              const fin = puntoDeEje(i, ejes.length, RADIO, PUNTAJE_MAXIMO, CENTRO);
              return <line key={i} x1={CENTRO.x} y1={CENTRO.y} x2={fin.x} y2={fin.y} strokeDasharray={RADIO} style={{ strokeDashoffset: reducido ? 0 : RADIO }} />;
            })}
          </g>
          <polygon
            ref={antes}
            data-poligono="antes"
            points={poligono(valoresAntes, RADIO, CENTRO)}
            className="fill-tinta-suave/20 stroke-tinta-suave"
            strokeWidth={2}
            strokeDasharray="6 5"
            style={{ opacity: reducido ? 0.4 : 0 }}
          />
          <polygon
            ref={despues}
            data-poligono="despues"
            points={poligono(valoresDespues, RADIO, CENTRO)}
            className="fill-marca/35 stroke-marca"
            strokeWidth={3}
            strokeLinejoin="round"
            style={{ opacity: reducido ? 1 : 0 }}
          />
          {ejes.map((eje, i) => {
            const punto = puntoDeEje(i, ejes.length, RADIO + 20, PUNTAJE_MAXIMO, CENTRO);
            return (
              <text
                key={eje.nombre}
                x={punto.x}
                y={punto.y}
                textAnchor={anclaDe(punto.x)}
                dominantBaseline="middle"
                fontSize={16}
                className="fill-tinta font-ui"
                data-eje={i}
              >
                {eje.nombre}
              </text>
            );
          })}
        </svg>

        <p className="flex items-baseline gap-2 text-tinta" aria-live="off">
          <span className="text-sm text-tinta-suave">{TEXTOS.critico.puntaje}</span>
          <span ref={puntaje} data-puntaje className="font-editorial text-5xl font-semibold tabular-nums">
            {formatearPuntaje(reducido ? totalDespues : totalAntes)}
          </span>
          <span className="text-sm text-tinta-suave">de 10</span>
        </p>

        <ol ref={notas} className="mt-2 flex w-full flex-col gap-1 md:flex-row md:justify-center md:gap-3">
          {TEXTOS.critico.anotaciones.map((texto, i) => (
            <li
              key={texto}
              data-anotacion={i}
              style={{ opacity: reducido ? 1 : 0, transform: reducido ? `rotate(${[-2, 1.5, -1][i]}deg)` : undefined }}
              className="rounded-md border border-dashed border-tinta-suave bg-papel px-3 py-1 font-editorial text-sm italic text-tinta"
            >
              <span aria-hidden="true">{["①", "②", "③"][i]} </span>
              {texto}
            </li>
          ))}
        </ol>
        <p className="mt-2 text-xs text-tinta-suave md:hidden">{TEXTOS.critico.ilustrativo}</p>
      </div>
    </Escenario>
  );
}
