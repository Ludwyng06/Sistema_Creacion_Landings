"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useMedia, useMovimiento } from "@/efectos/movimiento";
import { Escenario } from "../Escenario";
import { CAPTURAS, desplazamientoEn, escalaPara, paradas, type CapturaLanding } from "../capturas";
import { morphEn, opacidadesDeCapas, semillasDelHome } from "../semillas-home";
import { TEXTOS } from "../textos";
import { useProgresoDeElemento } from "../use-scroll-chapter";

/** El desplazamiento de la landing ocupa casi todo el recorrido; el morph entre semillas corre aparte (ver `semillas-home`). */
const INICIO_DESPLAZAMIENTO = 0.04;
const FIN_DESPLAZAMIENTO = 0.96;

const Titulos = ({ className = "" }: { className?: string }) => (
  <div className={className}>
    <h2 className="text-balance font-editorial text-[clamp(1.6rem,5vw,3.25rem)] font-semibold leading-none tracking-tight">{TEXTOS.semilla.titular}</h2>
    <p className="mt-2 text-pretty text-sm text-tinta-suave md:text-lg [@media(max-height:820px)]:hidden">{TEXTOS.semilla.apoyo}</p>
  </div>
);

const Captura = ({ captura, className = "" }: { captura: CapturaLanding; className?: string }) => (
  // eslint-disable-next-line @next/next/no-img-element -- captura local con medidas propias
  <img src={captura.archivo} alt="" width={captura.ancho} height={captura.alto} decoding="async" draggable={false} className={`block w-full select-none ${className}`} />
);

/** Barra de un navegador: tres puntos y la dirección de la landing. */
const BarraNavegador = () => (
  <div aria-hidden="true" className="flex h-9 shrink-0 items-center gap-3 border-b border-linea bg-papel-hondo px-4">
    <span className="flex gap-1.5">
      <span className="size-2.5 rounded-full bg-tinta/25" />
      <span className="size-2.5 rounded-full bg-tinta/25" />
      <span className="size-2.5 rounded-full bg-tinta/25" />
    </span>
    <span className="mx-auto w-full max-w-md truncate rounded-md bg-papel px-3 py-1 text-center text-xs text-tinta-suave">{CAPTURAS.semilla.url.replace(/^\//, "creadordelandings.local/")}</span>
  </div>
);

/** Con `reduced-motion`: las tres semillas lado a lado, la landing completa en miniatura y sin animar. */
function TresLadoALado({ semillas, movil }: { semillas: ReturnType<typeof semillasDelHome>; movil: boolean }) {
  const capturas = movil ? CAPTURAS.semilla.movil : CAPTURAS.semilla.escritorio;
  return (
    <div className="mx-auto w-full max-w-6xl px-4">
      <Titulos className="text-center" />
      <ul className="mt-6 grid gap-6 sm:grid-cols-3">
        {semillas.map((s, i) => (
          <li key={s.semilla.numero} className="mx-auto w-full max-w-xs sm:max-w-none">
            <div className="overflow-hidden rounded-xl border border-linea bg-papel">
              {!movil && <BarraNavegador />}
              <Captura captura={capturas[i]} />
            </div>
            <p className="mt-2 text-sm text-tinta-suave">{s.etiqueta}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Capítulo 5 · La semilla: una landing real de la vitrina, capturada con los tokens de cada semilla, dentro de un marco grande
 * (navegador en escritorio, celular en móvil). Mientras bajas, la landing se desplaza y se detiene en cada sección, y las tres
 * versiones se funden una en otra: colores, tipografías y radios cambian a la vez en todas las secciones visibles.
 */
export function Semilla() {
  const { reducido } = useMovimiento();
  const movil = useMedia("(max-width: 767px)");
  const seccion = useRef<HTMLElement>(null);
  const ventana = useRef<HTMLDivElement>(null);
  const capas = useRef<(HTMLDivElement | null)[]>([]);
  const nombre = useRef<HTMLParagraphElement>(null);
  const semillas = useMemo(() => semillasDelHome(), []);
  const indiceActual = useRef(0);
  const capturas = movil ? CAPTURAS.semilla.movil : CAPTURAS.semilla.escritorio;
  // Medidas de la ventana (se actualizan al cambiar el tamaño sin volver a montar nada).
  const geometria = useRef({ ancho: 0, alto: 0 });
  const [, medido] = useState(0);

  useLayoutEffect(() => {
    const el = ventana.current;
    if (!el) return;
    const medir = () => {
      geometria.current = { ancho: el.clientWidth, alto: el.clientHeight };
      medido((n) => n + 1);
    };
    medir();
    if (typeof ResizeObserver === "undefined") return;
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    return () => observador.disconnect();
  }, [reducido, movil]);

  // Paradas de cada versión: sus secciones no miden lo mismo (otra tipografía, otros espacios).
  const paradasPorCapa = () => {
    const { ancho, alto } = geometria.current;
    return capturas.map((c) => paradas(c.secciones, escalaPara(c.ancho, ancho), alto));
  };

  useProgresoDeElemento(seccion, (p) => {
    const estado = morphEn(p, semillas);
    const { ancho } = geometria.current;
    if (ancho > 0) {
      const q = (p - INICIO_DESPLAZAMIENTO) / (FIN_DESPLAZAMIENTO - INICIO_DESPLAZAMIENTO);
      const posiciones = paradasPorCapa();
      const opacidades = opacidadesDeCapas(p);
      capas.current.forEach((capa, i) => {
        if (!capa) return;
        capa.style.opacity = String(opacidades[i]);
        capa.style.transform = `translate3d(0, ${-desplazamientoEn(q, posiciones[i])}px, 0)`;
      });
    }
    if (nombre.current && indiceActual.current !== estado.indice) {
      indiceActual.current = estado.indice;
      nombre.current.textContent = `${TEXTOS.semilla.contador} ${estado.indice + 1} de ${semillas.length} · ${semillas[estado.indice].etiqueta}`;
    }
  });

  if (reducido) {
    return (
      <Escenario id="semilla" etiqueta="La semilla" ref={seccion} className="flex flex-col items-center justify-center gap-4 px-4 pt-16">
        <TresLadoALado semillas={semillas} movil={movil} />
      </Escenario>
    );
  }

  // Escritorio: navegador de 88 % del ancho; móvil: celular 390×844 escalado. La ventana nunca pasa del alto disponible.
  return (
    <Escenario id="semilla" ref={seccion} etiqueta="La semilla" className="flex flex-col items-center justify-center gap-3 px-4 pt-20">
      <Titulos className="max-w-3xl text-center" />
      <div role="img" aria-label={TEXTOS.semilla.region} className={movil ? "relative" : "w-[88vw] max-w-[1500px]"}>
        {movil ? (
          <div className="relative mx-auto w-[clamp(180px,calc((100svh-19rem)*0.462),300px)] rounded-[2rem] border-[9px] border-tinta bg-tinta">
            <span aria-hidden="true" className="absolute left-1/2 top-0 z-10 h-3 w-1/3 -translate-x-1/2 rounded-b-xl bg-tinta" />
            <div ref={ventana} className="relative w-full overflow-hidden rounded-[1.4rem] bg-fondo" style={{ aspectRatio: "390 / 844" }}>
              <Capas capturas={capturas} capas={capas} semillas={semillas} />
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-linea bg-papel shadow-xl">
            <BarraNavegador />
            <div ref={ventana} className="relative w-full overflow-hidden bg-fondo" style={{ height: "min(calc(88vw * 0.52), calc(100svh - 16rem))", maxHeight: "780px" }}>
              <Capas capturas={capturas} capas={capas} semillas={semillas} />
            </div>
          </div>
        )}
      </div>
      <p ref={nombre} aria-live="off" className="text-sm font-medium text-tinta-suave">
        {TEXTOS.semilla.contador} 1 de {semillas.length} · {semillas[0].etiqueta}
      </p>
    </Escenario>
  );
}

/** Las tres versiones de la landing, una sobre otra; la primera siempre visible y las otras aparecen encima. */
function Capas({ capturas, capas, semillas }: { capturas: CapturaLanding[]; capas: React.RefObject<(HTMLDivElement | null)[]>; semillas: ReturnType<typeof semillasDelHome> }) {
  return (
    <>
      {capturas.map((c, i) => (
        <div key={semillas[i].semilla.numero} ref={(el) => void (capas.current[i] = el)} className="absolute inset-x-0 top-0 will-change-transform" style={{ opacity: i === 0 ? 1 : 0 }}>
          <Captura captura={c} />
        </div>
      ))}
    </>
  );
}
