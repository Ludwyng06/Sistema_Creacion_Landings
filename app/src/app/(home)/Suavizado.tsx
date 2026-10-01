"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useMovimiento } from "@/efectos/movimiento";
import { registrarGsap } from "./gsap";

/** Scroll suave con Lenis, sincronizado con el reloj de GSAP para que `ScrollTrigger` lea la misma posición. */
export function Suavizado() {
  const { reducido } = useMovimiento();

  useEffect(() => {
    if (reducido) return;
    const gsap = registrarGsap();
    const lenis = new Lenis({ autoRaf: false, lerp: 0.12 });
    const alScroll = () => ScrollTrigger.update();
    lenis.on("scroll", alScroll);
    const tic = (tiempo: number) => lenis.raf(tiempo * 1000);
    gsap.ticker.add(tic);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(tic);
      lenis.off("scroll", alScroll);
      lenis.destroy();
    };
  }, [reducido]);

  return null;
}
