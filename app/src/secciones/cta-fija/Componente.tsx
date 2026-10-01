"use client";

import { useEffect, useState } from "react";
import type { z } from "zod";
import type { Seccion, Tokens } from "@/lib/contratos";
import { useLanding } from "@/componentes/contexto-landing";
import { Icono } from "@/componentes/Icono";
import { SeccionInvalida } from "@/componentes/SeccionInvalida";
import { useMedia } from "@/efectos/movimiento";
import { leerSeccion } from "../leer";
import { varianteDe } from "../variantes";
import type { schema } from "./schema";

/** `true` mientras algún elemento que coincida con el selector se ve en pantalla. Sin `IntersectionObserver` da `false`. */
function useEnPantalla(selector: string): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const elementos = document.querySelectorAll(selector);
    if (elementos.length === 0) return;
    const enPantalla = new Set<Element>();
    const observador = new IntersectionObserver((entradas) => {
      for (const entrada of entradas) {
        if (entrada.isIntersecting) enPantalla.add(entrada.target);
        else enPantalla.delete(entrada.target);
      }
      setVisible(enPantalla.size > 0);
    });
    elementos.forEach((el) => observador.observe(el));
    return () => observador.disconnect();
  }, [selector]);
  return visible;
}

/** Enlace de WhatsApp con el mensaje ya escrito; `null` si el número todavía es `[COMPLETAR]`. */
export function enlaceWhatsapp(numero: string | undefined, mensaje: string | undefined): string | null {
  if (!numero || !/^\d{10,15}$/.test(numero)) return null;
  return `https://wa.me/${numero}${mensaje ? `?text=${encodeURIComponent(mensaje)}` : ""}`;
}

export function Componente({ seccion }: { seccion: Seccion; tokens: Tokens }) {
  const datos = leerSeccion<z.infer<typeof schema>>(seccion);
  const { anclaFormulario, vistaPrevia } = useLanding();
  const formularioVisible = useEnPantalla(`[id="${anclaFormulario}"]`);
  const ofertaVisible = useEnPantalla("[data-tipo='oferta']");
  const heroeVisible = useEnPantalla("[data-tipo='heroe']");
  const escritorio = useMedia("(min-width: 768px)");
  if (!datos) return <SeccionInvalida tipo="cta-fija" />;

  const { ajustes } = datos;
  const variante = varianteDe("cta-fija", seccion.variante);
  // No tapa el formulario ni el héroe (que ya trae su botón); y en escritorio, solo cuando la oferta ya no se ve.
  const visible = !formularioVisible && !heroeVisible && !(escritorio && ofertaVisible);

  if (variante === "whatsapp-flotante") {
    const enlace = enlaceWhatsapp(ajustes.whatsapp, ajustes.mensajeWhatsapp) ?? `#${anclaFormulario}`;
    const externo = enlace.startsWith("https://");
    return (
      <a
        href={enlace}
        {...(externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        aria-label={ajustes.texto}
        data-cta-fija="whatsapp-flotante"
        data-visible={visible}
        inert={!visible}
        className={`${vistaPrevia ? "absolute" : "fixed"} bottom-4 right-4 z-40 grid size-14 place-items-center rounded-full bg-acento text-acento-texto shadow-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-acento motion-safe:transition-[opacity,transform] ${visible ? "" : "pointer-events-none translate-y-4 opacity-0"}`}
      >
        <Icono nombre="chat" className="size-7" />
      </a>
    );
  }

  return (
    <>
      {/* Reserva el alto de la barra al final de la página: al llegar abajo, no tapa el pie. */}
      <div aria-hidden="true" className="h-20" />
      <div
        data-cta-fija="barra-inferior-movil"
        data-visible={visible}
        inert={!visible}
        className={`${vistaPrevia ? "relative" : "fixed inset-x-0 bottom-0"} z-40 border-t border-borde bg-superficie px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] motion-safe:transition-transform ${visible ? "" : "translate-y-full"}`}
      >
        <a
          href={`#${anclaFormulario}`}
          data-cursor="Ir"
          className="mx-auto flex min-h-12 w-full max-w-md items-center justify-center gap-2 rounded-token bg-acento px-6 text-cuerpo font-medium text-acento-texto focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-acento"
        >
          {ajustes.texto}
          <Icono nombre="flecha" className="size-5" />
        </a>
      </div>
    </>
  );
}
