"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useMedia, useMovimiento } from "@/efectos/movimiento";
import { Escenario } from "../Escenario";
import { CAPTURAS, desplazamientoEn, escalaPara, paradas, seccionVisible } from "../capturas";
import { registrarGsap, useCoreografia } from "../gsap";
import { TEXTOS } from "../textos";

const SECCIONES = CAPTURAS.ensamblaje.secciones;
const ANCHO_MOVIL = 390;
const ALTO_MOVIL = 844;
/** Separación entre secciones en la vista explotada (px reales). */
const SEPARACION = 34;

/**
 * Capítulo 4 · El ensamblaje: las secciones de una landing real de la vitrina, cada una entera y a su ancho de móvil (390 px),
 * se separan en la vista explotada y bajan hasta formar la página dentro de un marco de celular (390×844), donde la landing se
 * desplaza. Las imágenes son capturas reales (`npm run capturas:home`), escaladas al ancho del marco.
 */
export function Ensamblaje() {
  const seccion = useRef<HTMLElement>(null);
  const marco = useRef<HTMLDivElement>(null);
  const rotulo = useRef<HTMLParagraphElement>(null);
  const [ancho, setAncho] = useState(260);
  const alCostado = useMedia("(min-width: 1024px)");
  const { reducido } = useMovimiento();

  // Ancho real del marco, medido antes de pintar: toda la geometría sale de él.
  useLayoutEffect(() => {
    const el = marco.current;
    if (!el) return;
    setAncho(el.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return;
    const observador = new ResizeObserver(([entrada]) => setAncho(entrada.contentRect.width));
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  const escala = escalaPara(ANCHO_MOVIL, ancho);
  const altoMarco = ancho * (ALTO_MOVIL / ANCHO_MOVIL);
  const altos = SECCIONES.map((s) => s.alto * escala);
  const tops = altos.map((_, i) => altos.slice(0, i).reduce((suma, a) => suma + a, 0));
  const alturaPila = altos.reduce((suma, a) => suma + a, 0);
  // Con movimiento reducido la landing entera se ve quieta: si no cabe a escala completa, se achica hasta caber en el marco.
  const ajuste = reducido ? Math.min(1, altoMarco / alturaPila) : 1;

  useCoreografia(seccion, (tl, raiz) => {
    const g = registrarGsap();
    const tarjetas = [...raiz.querySelectorAll<HTMLElement>("[data-tarjeta-seccion]")];
    const pila = raiz.querySelector<HTMLElement>("[data-pila]");
    const inclinacion = raiz.querySelector<HTMLElement>("[data-inclinacion]");
    const ventana = raiz.querySelector<HTMLElement>("[data-ventana]");
    const bisel = raiz.querySelector<HTMLElement>("[data-marco-movil]");
    const etiquetas = raiz.querySelectorAll<HTMLElement>("[data-etiqueta-seccion]");
    if (!pila || !inclinacion || !ventana || tarjetas.length === 0) return;
    const n = tarjetas.length;
    // Geometría real en este momento (el marco se mide en el navegador), no la del primer pintado.
    const anchoReal = ventana.getBoundingClientRect().width;
    const escala = escalaPara(ANCHO_MOVIL, anchoReal);
    const altoMarco = anchoReal * (ALTO_MOVIL / ANCHO_MOVIL);
    const alturaPila = SECCIONES.reduce((suma, s) => suma + s.alto * escala, 0);
    const separacion = SEPARACION * Math.max(0.7, escala * 1.4);
    const alturaExplotada = alturaPila + (n - 1) * separacion;
    const recorrido = Math.max(0, alturaExplotada - altoMarco);

    // Vista explotada: las secciones separadas en altura y un poco en profundidad, con la pila ladeada.
    // (el giro es de la ventana entera, con el centro del marco como eje; la pila solo se desplaza dentro)
    tl.set(inclinacion, { rotationX: 14, rotationZ: -3, transformOrigin: "50% 50%" }, 0);
    tarjetas.forEach((t, i) => {
      tl.set(t, { y: i * separacion, z: -i * 24 }, 0);
      tl.fromTo(t, { opacity: 0 }, { opacity: 1, duration: 0.05 }, i * 0.012);
    });
    // La cámara recorre la pila explotada de arriba abajo: cada sección pasa entera.
    // (mientras está explotada, la pila solo se ve dentro de la franja del marco: así no tapa el texto)
    tl.to(pila, { y: -recorrido, duration: 0.42, ease: "none" }, 0.05);
    // Las secciones bajan y se juntan, la pila se endereza y vuelve arriba; las etiquetas se van.
    tl.to(etiquetas, { opacity: 0, duration: 0.08 }, 0.5);
    tarjetas.forEach((t) => tl.to(t, { y: 0, z: 0, duration: 0.22, ease: "power2.inOut" }, 0.5));
    tl.to(inclinacion, { rotationX: 0, rotationZ: 0, duration: 0.22, ease: "power2.inOut" }, 0.5);
    tl.to(pila, { y: 0, duration: 0.22, ease: "power2.inOut" }, 0.5);
    // El celular aparece alrededor y recorta lo que sobra.
    tl.fromTo(ventana, { clipPath: "inset(-14px -2000px -14px -2000px round 0px)" }, { clipPath: "inset(0px 0px 0px 0px round 26px)", duration: 0.1, ease: "power1.inOut" }, 0.64);
    if (bisel) tl.fromTo(bisel, { opacity: 0 }, { opacity: 1, duration: 0.1 }, 0.68);

    // Ya dentro del celular, la landing se desplaza y se detiene en cada sección.
    const posiciones = paradas(SECCIONES, escala, altoMarco);
    const proxy = { p: 0 };
    tl.to(proxy, {
      p: 1,
      duration: 0.22,
      ease: "none",
      onUpdate: () => {
        const y = desplazamientoEn(proxy.p, posiciones);
        g.set(pila, { y: -y });
        if (rotulo.current) {
          const i = seccionVisible(SECCIONES, escala, y, altoMarco);
          rotulo.current.textContent = proxy.p <= 0.001 ? TEXTOS.ensamblaje.rotulo : `${SECCIONES[i].etiqueta} · ${i + 1} de ${SECCIONES.length}`;
        }
      },
    }, 0.78);
  }, `${Math.round(ancho / 6)}-${alCostado}`);

  return (
    <Escenario id="ensamblaje" ref={seccion} etiqueta="El ensamblaje" className="flex flex-col items-center justify-center gap-3 px-4 pt-16 lg:flex-row lg:gap-20">
      <div className="max-w-2xl text-center lg:max-w-md lg:text-left">
        <h2 className="text-balance font-editorial text-[clamp(1.75rem,6vw,3.5rem)] font-semibold leading-none tracking-tight">{TEXTOS.ensamblaje.titular}</h2>
        <p className="mt-2 text-pretty text-sm text-tinta-suave md:text-lg">{TEXTOS.ensamblaje.apoyo}</p>
      </div>
      <div className="flex flex-col items-center lg:pr-36">
        <div role="img" aria-label={TEXTOS.ensamblaje.marco} className="relative">
          <div
            ref={marco}
            className="relative w-[clamp(170px,calc((100svh-21rem)*0.462),260px)] lg:w-[clamp(240px,calc((100svh-11rem)*0.462),340px)]"
            style={{ aspectRatio: `${ANCHO_MOVIL} / ${ALTO_MOVIL}` }}
          >
            <div data-ventana className={`absolute inset-0 ${reducido ? "overflow-hidden rounded-[1.6rem]" : ""}`} style={{ perspective: "1400px", clipPath: reducido ? undefined : "inset(-14px -2000px -14px -2000px round 0px)" }}>
              <div data-inclinacion className="absolute inset-0 will-change-transform" style={{ transformStyle: "preserve-3d" }}>
              <div
                data-pila
                className="absolute left-0 top-0 will-change-transform"
                style={{ transformStyle: "preserve-3d", width: ancho * ajuste, height: alturaPila * ajuste, left: reducido ? (ancho - ancho * ajuste) / 2 : 0 }}
              >
                {SECCIONES.map((s, i) => (
                  <div
                    key={s.tipo}
                    data-tarjeta-seccion={s.tipo}
                    className="absolute left-0 will-change-transform"
                    style={{ top: tops[i] * ajuste, width: "100%", height: altos[i] * ajuste }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- captura local con medidas propias */}
                    <img src={s.archivo} alt="" width={s.ancho} height={s.alto} decoding="async" draggable={false} className="block size-full select-none" />
                    {/* La etiqueta va pegada al borde superior de su sección: al costado en escritorio, sobre la esquina en móvil. */}
                    {!reducido && (
                      <span
                        data-etiqueta-seccion
                        className={`absolute flex items-center gap-1 whitespace-nowrap text-[0.7rem] font-medium leading-none ${alCostado ? "left-full top-0" : "left-1 top-1"}`}
                      >
                        {alCostado && <span aria-hidden="true" className="h-px w-6 bg-tinta" />}
                        <span className="rounded bg-tinta px-2 py-1 text-papel">{s.etiqueta}</span>
                      </span>
                    )}
                  </div>
                ))}
              </div>
              </div>
            </div>
            {/* Celular: bordes redondeados y notch, alrededor de la ventana. */}
            <div data-marco-movil aria-hidden="true" className="pointer-events-none absolute -inset-2.5 rounded-[2.1rem] border-[10px] border-tinta" style={reducido ? undefined : { opacity: 0 }}>
              <span className="absolute left-1/2 top-0 h-3.5 w-1/3 -translate-x-1/2 -translate-y-[6px] rounded-b-xl bg-tinta" />
            </div>
          </div>
        </div>
        <p ref={rotulo} aria-live="off" className="mt-5 text-center text-sm font-medium text-tinta-suave lg:mt-6">
          {reducido ? TEXTOS.ensamblaje.rotuloQuieto : TEXTOS.ensamblaje.rotulo}
        </p>
      </div>
    </Escenario>
  );
}
