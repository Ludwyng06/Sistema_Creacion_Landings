"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useEfecto } from "@/efectos/contexto-efectos";
import { useFijado } from "@/efectos/nivel3/contexto-fijado";
import { limitar as limitar01 } from "@/efectos/nivel3/progreso";
import { useAsset } from "./contexto-landing";
import { MediaSlot } from "./MediaSlot";
import type { Relacion } from "./MarcadorAsset";

type Props = {
  slotAntes: string;
  slotDespues: string;
  etiquetaAntes?: string;
  etiquetaDespues?: string;
  relacion?: Relacion;
  /** Nombre accesible del control deslizante. */
  nombre?: string;
  /** Clase de ancho máximo del slider (no afecta a la pareja de marcadores). */
  anchoSlider?: string;
};

const PASO = 5;

function limitar(valor: number): number {
  return Math.max(0, Math.min(100, valor));
}

/**
 * Comparador antes/después con slider. Solo se usa cuando existen los dos archivos: el divisor es un `role="slider"` con teclado
 * (flechas, Inicio, Fin, RePág, AvPág) y `aria-valuenow`; también se arrastra con el puntero.
 */
function Deslizador({
  slotAntes,
  slotDespues,
  etiquetaAntes = "Antes",
  etiquetaDespues = "Después",
  relacion = "4:5",
  nombre = "Comparar antes y después",
  anchoSlider = "",
}: Props) {
  const [posicion, setPosicion] = useState(50);
  const contenedor = useRef<HTMLDivElement>(null);
  const arrastrando = useRef(false);

  // `antes-despues-scroll`: el scroll de la sección fijada mueve el divisor de 0 a 100 %.
  const porScroll = useEfecto("antes-despues-scroll");
  const fijado = useFijado();
  useEffect(() => {
    if (!porScroll || !fijado) return;
    const aplicar = (p: number) => setPosicion(Math.round(limitar01((p - 0.05) / 0.9) * 100));
    aplicar(fijado.progreso.current ?? 0);
    return fijado.suscribir(aplicar);
  }, [porScroll, fijado]);

  function desdePuntero(evento: PointerEvent<HTMLDivElement>) {
    const caja = contenedor.current?.getBoundingClientRect();
    if (!caja || caja.width === 0) return;
    setPosicion(Math.round(limitar(((evento.clientX - caja.left) / caja.width) * 100)));
  }

  function alTeclear(evento: KeyboardEvent<HTMLDivElement>) {
    const cambios: Record<string, (actual: number) => number> = {
      ArrowLeft: (a) => a - PASO,
      ArrowDown: (a) => a - PASO,
      ArrowRight: (a) => a + PASO,
      ArrowUp: (a) => a + PASO,
      PageDown: (a) => a - 20,
      PageUp: (a) => a + 20,
      Home: () => 0,
      End: () => 100,
    };
    const cambio = cambios[evento.key];
    if (!cambio) return;
    evento.preventDefault();
    setPosicion((actual) => limitar(cambio(actual)));
  }

  return (
    <div
      ref={contenedor}
      data-comparador
      style={{ aspectRatio: relacion.replace(":", " / ") }}
      className={`relative mx-auto w-full touch-pan-y select-none overflow-hidden rounded-tarjeta ${anchoSlider}`}
      onPointerDown={(evento) => {
        arrastrando.current = true;
        evento.currentTarget.setPointerCapture?.(evento.pointerId);
        desdePuntero(evento);
      }}
      onPointerMove={(evento) => {
        if (arrastrando.current) desdePuntero(evento);
      }}
      onPointerUp={() => {
        arrastrando.current = false;
      }}
      onPointerCancel={() => {
        arrastrando.current = false;
      }}
    >
      <div className="absolute inset-0">
        <MediaSlot slot={slotDespues} slotPorDefecto={slotDespues} relacion={relacion} llenar />
      </div>
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - posicion}% 0 0)` }}>
        <MediaSlot slot={slotAntes} slotPorDefecto={slotAntes} relacion={relacion} llenar />
      </div>

      <span className="pointer-events-none absolute left-3 top-3 rounded-token bg-texto px-3 py-1 text-xs font-medium uppercase tracking-widest text-fondo">
        {etiquetaAntes}
      </span>
      <span className="pointer-events-none absolute right-3 top-3 rounded-token bg-acento px-3 py-1 text-xs font-medium uppercase tracking-widest text-acento-texto">
        {etiquetaDespues}
      </span>

      <div
        role="slider"
        tabIndex={0}
        aria-label={nombre}
        aria-orientation="horizontal"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={posicion}
        aria-valuetext={`${posicion} % de «${etiquetaAntes}» visible`}
        onKeyDown={alTeclear}
        className="group absolute inset-y-0 z-10 w-11 -translate-x-1/2 cursor-ew-resize focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento"
        style={{ left: `${posicion}%` }}
      >
        <span aria-hidden="true" className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-texto" />
        <span
          aria-hidden="true"
          className="absolute left-1/2 top-1/2 grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-texto text-fondo"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 7l-5 5 5 5M15 7l5 5-5 5" />
          </svg>
        </span>
      </div>
    </div>
  );
}

/** Mientras falte algún archivo: los dos marcadores completos, uno tras otro (en fila en escritorio). */
function ParMarcadores({ slotAntes, slotDespues, etiquetaAntes = "Antes", etiquetaDespues = "Después", relacion = "4:5" }: Props) {
  const lados = [
    { etiqueta: etiquetaAntes, slot: slotAntes, fondo: "bg-texto text-fondo" },
    { etiqueta: etiquetaDespues, slot: slotDespues, fondo: "bg-acento text-acento-texto" },
  ];
  return (
    <div data-comparador-marcadores className="grid w-full gap-6 md:grid-cols-2">
      {lados.map(({ etiqueta, slot, fondo }) => (
        <figure key={slot}>
          <figcaption className="mb-2">
            <span
              className={`rounded-token px-3 py-1 text-xs font-medium uppercase tracking-widest ${fondo}`}
            >
              {etiqueta}
            </span>
          </figcaption>
          <MediaSlot slot={slot} slotPorDefecto={slot} relacion={relacion} />
        </figure>
      ))}
    </div>
  );
}

/**
 * Comparador antes/después. El slider solo se activa cuando existen los dos archivos;
 * mientras falte alguno se muestran los dos marcadores (con su botón «Buscar en bancos» (solo en el editor)),
 * de modo que el tirador nunca tapa un marcador.
 */
export function Comparador(props: Props) {
  const antes = useAsset(props.slotAntes);
  const despues = useAsset(props.slotDespues);
  if (antes?.ruta && despues?.ruta) return <Deslizador {...props} />;
  return <ParMarcadores {...props} />;
}
