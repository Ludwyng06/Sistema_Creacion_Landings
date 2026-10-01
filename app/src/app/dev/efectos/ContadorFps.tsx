"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Contador de cuadros por segundo en pantalla: mide con `requestAnimationFrame` mientras `activo` sea verdadero y
 * publica el promedio de cada medio segundo. También deja `data-fps` y `data-fps-min` para las pruebas de Playwright.
 */
export function ContadorFps({ activo }: { activo: boolean }) {
  const [fps, setFps] = useState<number | null>(null);
  const [minimo, setMinimo] = useState<number | null>(null);
  const minimoRef = useRef(Infinity);

  useEffect(() => {
    if (!activo) return;
    let cuadro = 0;
    let anterior = performance.now();
    let acumulado = 0;
    let cuadros = 0;
    const paso = (t: number) => {
      cuadro = requestAnimationFrame(paso);
      acumulado += t - anterior;
      anterior = t;
      cuadros += 1;
      if (acumulado >= 500) {
        const valor = Math.round((cuadros * 1000) / acumulado);
        minimoRef.current = Math.min(minimoRef.current, valor);
        setFps(valor);
        setMinimo(minimoRef.current);
        acumulado = 0;
        cuadros = 0;
      }
    };
    cuadro = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(cuadro);
  }, [activo]);

  return (
    <p
      role="status"
      data-contador-fps
      data-fps={fps ?? ""}
      data-fps-min={minimo ?? ""}
      className="rounded-full bg-tinta px-3 py-1 text-xs font-medium text-papel"
    >
      {fps === null ? "fps: midiendo…" : `${fps} fps · mín. ${minimo}`}
    </p>
  );
}
