"use client";

import { useRef } from "react";
import { useEfecto } from "./contexto-efectos";
import { useMovimiento, useRevelado } from "./movimiento";

/**
 * `titular-cinetico`: el titular se arma letra a letra. Sin el efecto (o con
 * `prefers-reduced-motion`) es el texto plano, completo y legible. Lo que está a la vista al cargar anima con CSS
 * (`letra-sube`) sin esperar a la hidratación; lo que queda más abajo se arma al entrar en pantalla.
 */
const retraso = (i: number) => {
  const ms = `${Math.min(i, 24) * 18}ms`; // tope de ~0,4 s: el LCP cuenta hasta que aparece la última letra
  return { transitionDelay: ms, animationDelay: ms };
};

export function TextoCinetico({ texto }: { texto: string }) {
  const activo = useEfecto("titular-cinetico");
  const { reducido } = useMovimiento();
  const ref = useRef<HTMLSpanElement>(null);
  const estado = useRevelado(ref);
  const alCargar = estado === "inicial" || estado === "arriba";

  if (!activo || reducido) return <>{texto}</>;

  let indice = 0;
  return (
    <span ref={ref} data-efecto="titular-cinetico">
      <span className="sr-only">{texto}</span>
      <span aria-hidden="true">
        {texto.split(" ").map((palabra, posicion) => (
          <span key={`${palabra}-${posicion}`}>
            {posicion > 0 && " "}
            <span className="inline-block whitespace-nowrap">
              {[...palabra].map((letra, i) => (
                <span
                  key={i}
                  className={`inline-block transition-[opacity,transform] duration-500 ease-out ${alCargar ? "letra-sube" : ""} ${estado === "oculto" ? "translate-y-[40%] opacity-0" : "translate-y-0 opacity-100"}`}
                  style={retraso(indice++)}
                >
                  {letra}
                </span>
              ))}
            </span>
          </span>
        ))}
      </span>
    </span>
  );
}
