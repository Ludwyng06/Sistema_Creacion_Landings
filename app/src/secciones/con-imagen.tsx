"use client";

import type { ReactNode } from "react";
import { CreditoCorto } from "@/componentes/CreditoCorto";
import { MediaSlot } from "@/componentes/MediaSlot";

interface Props {
  /** Slot de la imagen. Sin él, se dibuja la sección de siempre. */
  slot?: string;
  /** `lado`: imagen junto al contenido (apilada en móvil, con el contenido primero). `fondo`: imagen de banco a sangre con velo. */
  modo: "lado" | "fondo";
  /** Lado en escritorio donde va la imagen. */
  lado?: "izquierda" | "derecha";
  children: ReactNode;
}

/**
 * Contenedor de las variantes con imagen de garantía, oferta, FAQ, incluye y cómo funciona. Es la etiqueta `<section>`
 * de la sección: sin imagen pinta lo mismo que antes. Nunca es un héroe partido: el contenido va debajo en móvil y el
 * lado solo aplica desde 768 px en secciones de cuerpo.
 */
export function SeccionConImagen({ slot, modo, lado = "derecha", children }: Props) {
  if (!slot) return <section className="px-5 py-espacio">{children}</section>;

  if (modo === "fondo") {
    return (
      <section className="relative isolate overflow-hidden px-5 py-espacio" data-con-imagen="fondo">
        <div className="absolute inset-0 -z-20">
          <MediaSlot slot={slot} slotPorDefecto={slot} relacion="16:9" llenar />
        </div>
        <div aria-hidden="true" data-velo className="absolute inset-0 -z-10 bg-fondo/85" />
        {children}
      </section>
    );
  }

  return (
    <section className="px-5 py-espacio" data-con-imagen="lado">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 md:grid md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] md:items-center">
        <div className={`min-w-0 ${lado === "izquierda" ? "md:order-2" : ""}`}>{children}</div>
        <figure className={`mx-auto w-full max-w-sm ${lado === "izquierda" ? "md:order-1" : ""}`}>
          <MediaSlot slot={slot} slotPorDefecto={slot} relacion="4:5" />
          <CreditoCorto slot={slot} className="mt-1" />
        </figure>
      </div>
    </section>
  );
}
