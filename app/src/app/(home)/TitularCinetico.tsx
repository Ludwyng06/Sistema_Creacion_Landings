"use client";

import { useEffect, useState, type ElementType } from "react";
import { useMovimiento } from "@/efectos/movimiento";

/**
 * Titular cinético: las palabras suben una a una al cargar. El texto completo está siempre en el DOM
 * (lectores de pantalla y `reduced-motion` lo ven entero y quieto). La máscara de cada palabra es más grande que su
 * línea (relleno y margen negativo iguales): así no corta descendentes (p, q, g, y), tildes ni remates, y el texto no se mueve.
 */
export function TitularCinetico({ texto, como: Etiqueta = "h1", className = "" }: { texto: string; como?: ElementType; className?: string }) {
  const { reducido } = useMovimiento();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const cuadro = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(cuadro);
  }, []);

  const palabras = texto.split(" ");
  return (
    <Etiqueta className={className} aria-label={texto} data-titular-cinetico={reducido ? "quieto" : "animado"}>
      {palabras.map((palabra, i) => (
        <span key={i} aria-hidden="true" className="-mx-[0.08em] -my-[0.22em] mr-[0.17em] inline-block overflow-hidden px-[0.08em] py-[0.22em] align-bottom last:-mr-[0.08em]">
          <span
            className="inline-block"
            style={
              reducido
                ? undefined
                : {
                    transform: visible ? "translate3d(0, 0, 0)" : "translate3d(0, 105%, 0)",
                    transition: "transform 900ms cubic-bezier(0.16, 1, 0.3, 1)",
                    transitionDelay: `${i * 90}ms`,
                  }
            }
          >
            {palabra}
          </span>
        </span>
      ))}
    </Etiqueta>
  );
}
