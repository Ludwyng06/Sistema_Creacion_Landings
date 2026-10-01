"use client";

import { useEffect, useRef } from "react";
import { useEfecto } from "./contexto-efectos";
import { useMovimiento } from "./movimiento";

type Props = {
  textos: string[];
  /** De 1 (lenta) a 10 (rápida). */
  velocidad: number;
};

function Grupo({ textos, oculto, referencia }: { textos: string[]; oculto?: boolean; referencia?: React.Ref<HTMLUListElement> }) {
  return (
    <ul ref={referencia} aria-hidden={oculto || undefined} className="flex shrink-0 items-center">
      {textos.map((texto, i) => (
        <li key={`${texto}-${i}`} className="flex shrink-0 items-center">
          <span className="whitespace-nowrap px-6">{texto}</span>
          <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
        </li>
      ))}
    </ul>
  );
}

/**
 * Cinta de texto. Con `marquee-reactivo` su velocidad y su dirección siguen al scroll.
 * Con `prefers-reduced-motion` no se mueve: los textos quedan quietos y legibles.
 */
export function Marquee({ textos, velocidad }: Props) {
  const reactivo = useEfecto("marquee-reactivo");
  const { reducido } = useMovimiento();
  const pista = useRef<HTMLDivElement>(null);
  const grupo = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (reducido) return;
    const base = 20 + velocidad * 15; // px por segundo
    let x = 0;
    let direccion = -1;
    let impulso = 0;
    let ultimoY = window.scrollY;
    let ultimo = performance.now();
    let cuadro = 0;

    const paso = (ahora: number) => {
      const dt = Math.min((ahora - ultimo) / 1000, 0.1);
      ultimo = ahora;
      if (reactivo) {
        const delta = window.scrollY - ultimoY;
        ultimoY = window.scrollY;
        impulso = impulso * 0.92 + Math.abs(delta) * 0.35;
        if (delta !== 0) direccion = delta > 0 ? -1 : 1;
      }
      x += direccion * base * (1 + Math.min(impulso, 6)) * dt;
      const ancho = grupo.current?.offsetWidth ?? 0;
      if (ancho > 0) {
        if (x <= -ancho) x += ancho;
        if (x > 0) x -= ancho;
      }
      if (pista.current) pista.current.style.transform = `translate3d(${x}px, 0, 0)`;
      cuadro = requestAnimationFrame(paso);
    };
    cuadro = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(cuadro);
  }, [reducido, reactivo, velocidad]);

  if (reducido) {
    return (
      <ul
        data-efecto={reactivo ? "marquee-reactivo" : undefined}
        data-estado="estatico"
        className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-5"
      >
        {textos.map((texto, i) => (
          <li key={`${texto}-${i}`} className="flex items-center">
            <span className="px-3">{texto}</span>
            {i < textos.length - 1 && <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div
      data-efecto={reactivo ? "marquee-reactivo" : undefined}
      data-estado="animado"
      className="overflow-hidden"
    >
      <div ref={pista} className="flex w-max will-change-transform">
        <Grupo textos={textos} referencia={grupo} />
        <Grupo textos={textos} oculto />
        <Grupo textos={textos} oculto />
        <Grupo textos={textos} oculto />
      </div>
    </div>
  );
}
