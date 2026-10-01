"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { EfectoId } from "@/lib/contratos";
import { useMovimiento } from "../movimiento";
import { ProveedorFijado, type ApiFijado } from "./contexto-fijado";
import { cabeEnPantalla, progresoAlPasar, progresoFijado } from "./progreso";

export interface ControlEfecto {
  /** Contenedor de la sección (dentro del elemento fijado). */
  interno: HTMLElement;
  /** Scroll extra (px) que el efecto necesita mientras la sección queda fija. */
  fijarRecorrido: (px: number) => void;
  /** El efecto no puede aplicarse a este contenido (por ejemplo, no hay un video): la sección queda como estaba. */
  desactivar: () => void;
  progreso: ApiFijado["progreso"];
  suscribir: ApiFijado["suscribir"];
  /** `true` si la sección cabe en la pantalla y se fija; si no, se recorre con el scroll normal. */
  fijado: boolean;
}

interface Props {
  id: EfectoId;
  children: ReactNode;
  /** Scroll extra por defecto, en múltiplos del alto de la ventana. */
  recorridoVh?: number;
  /** Cuántas veces el alto de la pantalla puede medir la sección y aun así fijarse (alineada por abajo). */
  toleranciaAlto?: number;
  /** Prepara los elementos de la sección (busca bloques, imágenes…). Devuelve cómo deshacerlo. */
  alMontar?: (control: ControlEfecto) => void | (() => void);
}

/**
 * Base de los efectos de nivel 3 que atan una sección al scroll: la fija (`sticky`) durante un recorrido extra,
 * calcula el progreso 0–1, lo publica en la variable CSS `--p` de la caja y avisa a los suscriptores.
 * Si la sección es más alta que la pantalla no se fija y el progreso sale del paso normal por la pantalla.
 * Con `prefers-reduced-motion` no hace nada: la sección se ve tal cual, estática y legible.
 */
export function Fijado({ id, children, recorridoVh = 1, toleranciaAlto, alMontar }: Props) {
  const { reducido } = useMovimiento();
  if (reducido) return <div data-efecto-estatico={id}>{children}</div>;
  return (
    <FijadoActivo id={id} recorridoVh={recorridoVh} toleranciaAlto={toleranciaAlto} alMontar={alMontar}>
      {children}
    </FijadoActivo>
  );
}

function FijadoActivo({ id, children, recorridoVh = 1, toleranciaAlto, alMontar }: Props) {
  const externo = useRef<HTMLDivElement>(null);
  const contenido = useRef<HTMLDivElement>(null);
  const progreso = useRef(0);
  const suscriptores = useRef(new Set<(p: number) => void>());
  const [extra, setExtra] = useState<number | null>(null);
  const [activo, setActivo] = useState(true);
  const [fijado, setFijado] = useState(true);
  const [altoContenido, setAltoContenido] = useState(0);
  const montar = useRef(alMontar);
  useEffect(() => {
    montar.current = alMontar;
  });

  const api = useMemo<ApiFijado>(
    () => ({
      progreso,
      suscribir: (cb) => {
        suscriptores.current.add(cb);
        return () => void suscriptores.current.delete(cb);
      },
    }),
    [],
  );

  const publicar = useCallback(() => {
    const caja = externo.current;
    if (!caja) return;
    const r = caja.getBoundingClientRect();
    const p = fijado ? progresoFijado(r.top, r.height, window.innerHeight, altoContenido) : progresoAlPasar(r.top, r.height, window.innerHeight);
    if (p === progreso.current && caja.style.getPropertyValue("--p")) return;
    progreso.current = p;
    caja.style.setProperty("--p", p.toFixed(4));
    suscriptores.current.forEach((cb) => cb(p));
  }, [fijado, altoContenido]);

  // Prepara la sección y decide si cabe para fijarla.
  useLayoutEffect(() => {
    const cont = contenido.current;
    if (!cont) return;
    const alto = cont.getBoundingClientRect().height;
    const cabe = cabeEnPantalla(alto, window.innerHeight, toleranciaAlto);
    setFijado(cabe);
    setAltoContenido(alto);
    const limpiar = montar.current?.({
      interno: cont,
      fijarRecorrido: (px) => setExtra(Math.max(0, Math.round(px))),
      desactivar: () => setActivo(false),
      progreso,
      suscribir: api.suscribir,
      fijado: cabe,
    });
    return () => limpiar?.();
  }, [api, toleranciaAlto]);

  useEffect(() => {
    if (!activo) return;
    let pendiente = 0;
    const alScroll = () => {
      if (!pendiente) {
        pendiente = requestAnimationFrame(() => {
          pendiente = 0;
          publicar();
        });
      }
    };
    publicar();
    window.addEventListener("scroll", alScroll, { passive: true });
    window.addEventListener("resize", alScroll);
    return () => {
      if (pendiente) cancelAnimationFrame(pendiente);
      window.removeEventListener("scroll", alScroll);
      window.removeEventListener("resize", alScroll);
    };
  }, [activo, publicar, extra]);

  if (!activo) {
    return (
      <div data-efecto-inactivo={id} ref={contenido}>
        {children}
      </div>
    );
  }

  // Alto del contenido fijado: una pantalla o, si la sección es más alta, lo que mide.
  const interno = `max(100svh, ${Math.round(altoContenido)}px)`;
  const alto = fijado ? `calc(${interno} + ${extra ?? Math.round(recorridoVh * 100) + 0}${extra === null ? "svh" : "px"})` : undefined;
  const arriba = `min(0px, calc(100svh - ${Math.round(altoContenido)}px))`;
  return (
    <ProveedorFijado value={api}>
      <div ref={externo} data-fijado={id} data-fijado-activo={fijado ? "fijo" : "libre"} style={{ height: alto, position: "relative" }}>
        <div style={fijado ? { position: "sticky", top: arriba, minHeight: "100svh", display: "flex", flexDirection: "column", justifyContent: "center", overflow: "hidden" } : undefined}>
          <div ref={contenido}>{children}</div>
        </div>
      </div>
    </ProveedorFijado>
  );
}
