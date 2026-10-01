"use client";

import { useRef } from "react";
import { VideoScroll } from "@/efectos/VideoScroll";
import { BotonMagnetico } from "../BotonMagnetico";
import { Escenario } from "../Escenario";
import { TEXTOS } from "../textos";
import { TitularCinetico } from "../TitularCinetico";
import { useProgresoDeElemento } from "../use-scroll-chapter";

/** En móvil no hay clip vertical: se usa el 16:9 con `cover` y el recorte se corre a la izquierda, donde está la fila de celulares. */
const ENFOQUE_MOVIL = { x: 0.28, y: 0.5 };

/** Desde qué parte del recorrido la portada se funde al papel del capítulo 1. */
const INICIO_FUNDIDO = 0.78;

const suavizar = (t: number) => t * t * (3 - 2 * t);

/**
 * Capítulo 0 · Portada: el clip de la fábrica de neón a pantalla completa, navegable con el scroll (efecto `video-scroll`),
 * con el titular cinético y el botón magnético encima. El clip es oscuro: el texto va en claro sobre un velo oscuro que se
 * retira cuando el texto se despide, y al final la escena se funde al papel del capítulo 1.
 */
export function Portada() {
  const seccion = useRef<HTMLElement>(null);
  const texto = useRef<HTMLDivElement>(null);
  const aviso = useRef<HTMLParagraphElement>(null);
  const velo = useRef<HTMLDivElement>(null);
  const fundido = useRef<HTMLDivElement>(null);

  // El texto se despide en el primer cuarto del recorrido para dejar ver el video; se escribe sin pasar por React.
  const progreso = useProgresoDeElemento(seccion, (p) => {
    const salida = Math.min(1, Math.max(0, (p - 0.08) / 0.2));
    if (texto.current) {
      texto.current.style.opacity = String(1 - salida);
      texto.current.style.transform = `translate3d(0, ${-salida * 40}px, 0)`;
      texto.current.style.pointerEvents = salida > 0.9 ? "none" : "auto";
    }
    if (aviso.current) aviso.current.style.opacity = String(Math.max(0, 1 - p * 12));
    // El velo baja a un tercio cuando el texto ya no está, para que el video se vea con todo su color.
    if (velo.current) velo.current.style.opacity = String(1 - salida * 0.65);
    if (fundido.current) fundido.current.style.opacity = String(suavizar(Math.min(1, Math.max(0, (p - INICIO_FUNDIDO) / (1 - INICIO_FUNDIDO)))));
  });

  return (
    <Escenario id="portada" ref={seccion} etiqueta="Portada" className="bg-tinta">
      <VideoScroll progreso={progreso} enfoqueMovil={ENFOQUE_MOVIL} />
      <div
        ref={velo}
        data-velo-portada
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-tinta/75 via-tinta/70 to-tinta/75"
        aria-hidden="true"
      />
      <div
        ref={texto}
        className="absolute inset-0 flex flex-col items-center justify-center gap-6 px-5 text-center will-change-transform"
      >
        <TitularCinetico
          texto={TEXTOS.portada.titular}
          className="max-w-[16ch] text-balance font-editorial text-[clamp(2.5rem,11vw,6.5rem)] font-semibold leading-[0.95] tracking-tight text-papel md:max-w-[18ch]"
        />
        <p className="max-w-md text-pretty text-lg text-papel">{TEXTOS.portada.apoyo}</p>
        <BotonMagnetico href="/crear" sobreOscuro>
          {TEXTOS.portada.boton}
        </BotonMagnetico>
      </div>
      <p ref={aviso} className="absolute inset-x-0 bottom-6 text-center text-sm font-medium text-papel">
        {TEXTOS.portada.avisoScroll}
        <span aria-hidden="true" className="block text-xl">
          ↓
        </span>
      </p>
      {/* Cierre de la portada: un degradado hacia el color del papel para entrar al capítulo 1 sin corte. */}
      <div ref={fundido} data-fundido-portada className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-papel/70 to-papel opacity-0" aria-hidden="true" />
    </Escenario>
  );
}
