"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, type PointerEvent } from "react";
import { useMovimiento } from "@/efectos/movimiento";

const FUERZA = 0.35;
const MAXIMO_PX = 18;
const limitar = (v: number) => Math.max(-MAXIMO_PX, Math.min(MAXIMO_PX, v));

/** Botón que se acerca al puntero (`boton-magnetico`). Sin puntero fino o con `reduced-motion` es un enlace normal. */
export function BotonMagnetico({ href, children, grande = false, sobreOscuro = false }: { href: string; children: string; grande?: boolean; sobreOscuro?: boolean }) {
  const { reducido, punteroFino } = useMovimiento();
  const router = useRouter();
  const ref = useRef<HTMLSpanElement>(null);
  const activo = punteroFino && !reducido;

  function alMover(e: PointerEvent<HTMLSpanElement>) {
    const caja = ref.current?.getBoundingClientRect();
    if (!caja || !ref.current) return;
    const dx = e.clientX - (caja.left + caja.width / 2);
    const dy = e.clientY - (caja.top + caja.height / 2);
    ref.current.style.transform = `translate3d(${limitar(dx * FUERZA)}px, ${limitar(dy * FUERZA)}px, 0)`;
  }

  function alSalir() {
    if (ref.current) ref.current.style.transform = "translate3d(0, 0, 0)";
  }

  return (
    <span
      ref={ref}
      data-boton-magnetico={activo ? "" : undefined}
      className={`inline-block ${activo ? "transition-transform duration-200 ease-out" : ""}`}
      onPointerMove={activo ? alMover : undefined}
      onPointerLeave={activo ? alSalir : undefined}
    >
      <Link
        href={href}
        prefetch
        onPointerEnter={() => router.prefetch(href)}
        onFocus={() => router.prefetch(href)}
        onTouchStart={() => router.prefetch(href)}
        className={`inline-flex items-center justify-center rounded-full font-medium transition-opacity ${sobreOscuro ? "bg-papel text-tinta" : "bg-marca text-marca-texto"} hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-marca ${
          grande ? "min-h-16 px-10 text-xl md:min-h-20 md:px-14 md:text-2xl" : "min-h-12 px-8 text-lg"
        }`}
      >
        {children}
      </Link>
    </span>
  );
}
