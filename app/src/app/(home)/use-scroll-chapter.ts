"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { CAPITULOS, capituloEn, progresoLocal, type Capitulo } from "./capitulos";

export interface EstadoScroll {
  /** Capítulo bajo el centro de la pantalla. */
  capitulo: Capitulo;
  /** Progreso global 0–1 del recorrido. */
  progreso: number;
  /** Progreso local 0–1 dentro del capítulo. */
  local: number;
}

/** Progreso global: el centro de la pantalla sobre el alto total de la página. */
export function progresoDePagina(): number {
  const alto = document.documentElement.scrollHeight;
  if (alto <= 0) return 0;
  return Math.min(1, Math.max(0, (window.scrollY + window.innerHeight / 2) / alto));
}

export interface CajaCapitulo {
  numero: number;
  top: number;
  bottom: number;
}

/**
 * Capítulo cuya sección cruza el centro de la pantalla, medido sobre el diseño real. Los capítulos con contenido
 * fijo miden lo que su recorrido, pero los bloques estáticos miden lo que su texto: el reparto por porcentajes
 * se desfasa, así que el DOM manda y la tabla solo es el respaldo. `null` si ninguno cruza el centro.
 */
export function capituloEnPantalla(cajas: readonly CajaCapitulo[], altoVentana: number): number | null {
  const centro = altoVentana / 2;
  return cajas.find((c) => c.top <= centro && c.bottom > centro)?.numero ?? null;
}

function capituloMedido(progreso: number): Capitulo {
  const cajas = [...document.querySelectorAll<HTMLElement>("[data-capitulo]")].map((el) => {
    const r = el.getBoundingClientRect();
    return { numero: Number(el.dataset.capitulo), top: r.top, bottom: r.bottom };
  });
  const numero = capituloEnPantalla(cajas, window.innerHeight);
  return CAPITULOS.find((c) => c.numero === numero) ?? capituloEn(progreso);
}

const estadoDe = (progreso: number): EstadoScroll => {
  const capitulo = capituloEn(progreso);
  return { capitulo, progreso, local: progresoLocal(progreso, capitulo) };
};

/**
 * `useScrollChapter()`: en qué capítulo del recorrido está la persona.
 * Solo vuelve a renderizar cuando cambia de capítulo; el progreso fino va por `progresoRef`.
 */
export function useScrollChapter(): EstadoScroll & { progresoRef: RefObject<number> } {
  const [estado, setEstado] = useState<EstadoScroll>(() => estadoDe(0));
  const progresoRef = useRef(0);

  useEffect(() => {
    let pendiente = 0;
    const leer = () => {
      pendiente = 0;
      const progreso = progresoDePagina();
      progresoRef.current = progreso;
      setEstado((previo) => {
        const capitulo = capituloMedido(progreso);
        return capitulo.numero === previo.capitulo.numero ? previo : { capitulo, progreso, local: progresoLocal(progreso, capitulo) };
      });
    };
    const alScroll = () => {
      if (!pendiente) pendiente = requestAnimationFrame(leer);
    };
    leer();
    window.addEventListener("scroll", alScroll, { passive: true });
    window.addEventListener("resize", alScroll);
    return () => {
      if (pendiente) cancelAnimationFrame(pendiente);
      window.removeEventListener("scroll", alScroll);
      window.removeEventListener("resize", alScroll);
    };
  }, []);

  return { ...estado, progresoRef };
}

/**
 * Progreso (0–1) de un elemento alto con contenido fijo (`sticky`): 0 cuando su borde superior toca el
 * borde superior de la pantalla y 1 cuando su borde inferior toca el inferior. Escribe en una ref y avisa
 * a `alProgreso` sin pasar por React, para mantener los 60 fps.
 */
export function useProgresoDeElemento(
  elemento: RefObject<HTMLElement | null>,
  alProgreso?: (progreso: number) => void,
): RefObject<number> {
  const progresoRef = useRef(0);
  const aviso = useRef(alProgreso);
  useEffect(() => {
    aviso.current = alProgreso;
  });

  useEffect(() => {
    const el = elemento.current;
    if (!el) return;
    let pendiente = 0;
    const leer = () => {
      pendiente = 0;
      const caja = el.getBoundingClientRect();
      const recorrido = Math.max(1, caja.height - window.innerHeight);
      const p = Math.min(1, Math.max(0, -caja.top / recorrido));
      if (p !== progresoRef.current) {
        progresoRef.current = p;
        aviso.current?.(p);
      }
    };
    const alScroll = () => {
      if (!pendiente) pendiente = requestAnimationFrame(leer);
    };
    leer();
    window.addEventListener("scroll", alScroll, { passive: true });
    window.addEventListener("resize", alScroll);
    return () => {
      if (pendiente) cancelAnimationFrame(pendiente);
      window.removeEventListener("scroll", alScroll);
      window.removeEventListener("resize", alScroll);
    };
  }, [elemento]);

  return progresoRef;
}

export { CAPITULOS };
