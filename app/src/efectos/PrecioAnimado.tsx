"use client";

import { useEffect, useRef, useState } from "react";
import { formatearDinero, type Moneda } from "@/componentes/dinero";
import { useEfecto } from "./contexto-efectos";
import { useEnVista, useMovimiento } from "./movimiento";

const DURACION_MS = 1300;

type Props = { hasta: number; desde?: number; moneda: Moneda; className?: string };

/**
 * `precio-cae`: al entrar en pantalla el precio cae desde `precioAnterior` hasta `precio`.
 * Sin el efecto o con `prefers-reduced-motion` muestra el precio final, sin animación.
 */
export function PrecioAnimado({ hasta, desde, moneda, className }: Props) {
  const activo = useEfecto("precio-cae");
  const { reducido } = useMovimiento();
  const ref = useRef<HTMLSpanElement>(null);
  const visible = useEnVista(ref);
  const [valor, setValor] = useState(hasta);
  const animar = activo && !reducido && typeof desde === "number" && desde > hasta;

  useEffect(() => {
    if (!animar || !visible || desde === undefined) return;
    let cuadro = 0;
    let inicio: number | null = null;
    const paso = (ahora: number) => {
      inicio ??= ahora;
      const t = Math.min((ahora - inicio) / DURACION_MS, 1);
      const suave = 1 - Math.pow(1 - t, 3);
      setValor(desde + (hasta - desde) * suave);
      if (t < 1) cuadro = requestAnimationFrame(paso);
    };
    cuadro = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(cuadro);
  }, [animar, visible, desde, hasta]);

  return (
    <span ref={ref} data-efecto={animar ? "precio-cae" : undefined} className={className}>
      {formatearDinero(animar ? valor : hasta, moneda)}
    </span>
  );
}
