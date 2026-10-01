"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";

/**
 * Arma su contenido cuando queda cerca de la pantalla o, como tarde, pasado un rato de inactividad. Los paneles del editor
 * que empiezan fuera de la vista (tema, efectos, salud) no compiten con el primer pintado ni con la lista de secciones.
 * Con el teclado (Tab) arma al instante y antes de mover el foco, para que el orden de tabulación sea el de la pantalla.
 * Sin `IntersectionObserver` (pruebas) arma de inmediato.
 */
export function Diferido({ children, alto, espera = 3500 }: { children: ReactNode; alto: number; espera?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      const cuadro = requestAnimationFrame(() => setListo(true));
      return () => cancelAnimationFrame(cuadro);
    }
    const observador = new IntersectionObserver((entradas) => entradas.some((e) => e.isIntersecting) && setListo(true), { rootMargin: "300px" });
    if (ref.current) observador.observe(ref.current);
    const reloj = setTimeout(() => setListo(true), espera);
    const alTabular = (e: KeyboardEvent) => {
      if (e.key === "Tab") flushSync(() => setListo(true));
    };
    window.addEventListener("keydown", alTabular, true);
    return () => {
      observador.disconnect();
      clearTimeout(reloj);
      window.removeEventListener("keydown", alTabular, true);
    };
  }, [espera]);

  if (listo) return <>{children}</>;
  return <div ref={ref} aria-hidden="true" style={{ minHeight: alto }} />;
}
