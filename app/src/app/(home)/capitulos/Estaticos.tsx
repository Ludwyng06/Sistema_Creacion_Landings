"use client";

import { useRef } from "react";
import { VideoScroll } from "@/efectos/VideoScroll";
import { rutasDelCierre } from "@/efectos/video-scroll/fuente";
import { useMovimiento } from "@/efectos/movimiento";
import { BotonMagnetico } from "../BotonMagnetico";
import { Escenario } from "../Escenario";
import { TEXTOS } from "../textos";
import { useProgresoDeElemento } from "../use-scroll-chapter";

// Capítulo 8 · Cierre. (Los capítulos 5, 6 y 7 viven en Semilla.tsx, Critico.tsx y Banco.tsx.)

/** Cuándo aparece cada pieza (0–1 del recorrido): titular, frase y botón, una tras otra mientras el sendero avanza. */
export const APARICION = { titular: [0.1, 0.3], apoyo: [0.3, 0.45], boton: [0.45, 0.6] } as const;

/** Opacidad 0–1 de una pieza según el progreso (función pura). */
export function aparicion(p: number, [desde, hasta]: readonly [number, number] | readonly number[]): number {
  return Math.min(1, Math.max(0, (p - desde) / (hasta - desde)));
}

/**
 * Capítulo 8 · Cierre: el sendero junto al acantilado avanza con el scroll (video vertical 9:16, efecto `video-scroll`) mientras
 * aparecen el titular, la frase y el botón. En móvil es el fondo a pantalla completa; en escritorio, una ventana alta centrada
 * de 9:16 (el clip mide 720 px de ancho: estirarlo a toda la pantalla se vería borroso) con el texto encima, apilado.
 * El texto es claro sobre un velo oscuro para mantener el contraste AA.
 */
export function Cierre() {
  const { reducido } = useMovimiento();
  const seccion = useRef<HTMLElement>(null);
  const titular = useRef<HTMLHeadingElement>(null);
  const apoyo = useRef<HTMLParagraphElement>(null);
  const boton = useRef<HTMLDivElement>(null);

  const progreso = useProgresoDeElemento(seccion, (p) => {
    if (reducido) return; // sin recorrido: todo a la vista desde el inicio
    const poner = (el: HTMLElement | null, [desde, hasta]: readonly number[]) => {
      if (!el) return;
      const a = aparicion(p, [desde, hasta]);
      el.style.opacity = String(a);
      el.style.transform = `translate3d(0, ${(1 - a) * 24}px, 0)`;
      el.style.pointerEvents = a < 0.5 ? "none" : "auto";
    };
    poner(titular.current, APARICION.titular);
    poner(apoyo.current, APARICION.apoyo);
    poner(boton.current, APARICION.boton);
  });

  // Con movimiento reducido no hay recorrido: el póster fijo y todo el texto a la vista.
  const visible = reducido ? undefined : { opacity: 0 };

  return (
    <Escenario id="cierre" ref={seccion} etiqueta="Cierre" className="flex items-center justify-center bg-tinta md:bg-papel">
      <div
        data-marco-cierre
        className="relative h-svh w-full overflow-hidden bg-tinta md:h-auto md:aspect-[9/16] md:w-[min(28rem,calc((100svh-5rem)*0.5625))] md:rounded-3xl md:shadow-xl"
      >
        <VideoScroll progreso={progreso} rutas={rutasDelCierre} />
        <div data-velo-cierre aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-b from-tinta/70 via-tinta/65 to-tinta/75" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 px-6 text-center">
          <h2 ref={titular} style={visible} className="max-w-[14ch] text-balance font-editorial text-[clamp(2.25rem,9vw,3.25rem)] font-semibold leading-[0.95] tracking-tight text-papel will-change-transform">
            {TEXTOS.cierre.titular}
          </h2>
          <p ref={apoyo} style={visible} className="text-lg text-papel will-change-transform">
            {TEXTOS.cierre.apoyo}
          </p>
          <div ref={boton} style={visible} className="will-change-transform">
            <BotonMagnetico href="/crear" sobreOscuro>
              {TEXTOS.cierre.boton}
            </BotonMagnetico>
          </div>
        </div>
      </div>
    </Escenario>
  );
}
