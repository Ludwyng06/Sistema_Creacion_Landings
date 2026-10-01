"use client";

import { useRef, type ReactNode } from "react";
import { useEfecto } from "./contexto-efectos";
import { useEnVista, useMovimiento } from "./movimiento";

const PERSIANAS = 6;

/**
 * `mascara-circular` y `mascara-persiana`: revelan la imagen al entrar en pantalla.
 * Solo se animan `clip-path` y `transform`. Sin efecto o con `prefers-reduced-motion`,
 * la imagen se ve completa desde el principio.
 */
export function MascaraMedia({ children, className = "" }: { children: ReactNode; className?: string }) {
  const circular = useEfecto("mascara-circular");
  const persiana = useEfecto("mascara-persiana");
  const { reducido } = useMovimiento();
  const ref = useRef<HTMLDivElement>(null);
  const visible = useEnVista(ref);

  if ((!circular && !persiana) || reducido) return <div className={className}>{children}</div>;

  if (circular) {
    return (
      <div
        ref={ref}
        data-efecto="mascara-circular"
        className={`transition-[clip-path] duration-[1400ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${className}`}
        style={{ clipPath: visible ? "circle(75% at 50% 50%)" : "circle(0% at 50% 50%)" }}
      >
        {children}
      </div>
    );
  }

  return (
    <div ref={ref} data-efecto="mascara-persiana" className={`relative ${className}`}>
      {children}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col">
        {Array.from({ length: PERSIANAS }, (_, i) => (
          <span
            key={i}
            className={`block flex-1 origin-top bg-fondo transition-transform duration-700 ease-out ${visible ? "scale-y-0" : "scale-y-100"}`}
            style={{ transitionDelay: `${i * 90}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
