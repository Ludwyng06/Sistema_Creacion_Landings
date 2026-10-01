"use client";

import { useEffect, useRef, useState } from "react";
import type { z } from "zod";
import type { Seccion, Tokens } from "@/lib/contratos";
import { CreditoCorto } from "@/componentes/CreditoCorto";
import { MediaSlot } from "@/componentes/MediaSlot";
import { SeccionInvalida } from "@/componentes/SeccionInvalida";
import { Titular } from "@/componentes/Titular";
import { useMovimiento } from "@/efectos/movimiento";
import { leerSeccion } from "../leer";
import { varianteDe } from "../variantes";
import type { schema } from "./schema";

/** Desplazamiento suave (parallax) de la imagen de fondo con el scroll; con `prefers-reduced-motion` no se mueve. */
function useParallax(activo: boolean) {
  const caja = useRef<HTMLElement>(null);
  const [desplazamiento, setDesplazamiento] = useState(0);
  useEffect(() => {
    if (!activo) return;
    let cuadro = 0;
    const medir = () => {
      cancelAnimationFrame(cuadro);
      cuadro = requestAnimationFrame(() => {
        const r = caja.current?.getBoundingClientRect();
        if (!r) return;
        const centro = r.top + r.height / 2 - window.innerHeight / 2;
        setDesplazamiento(Math.max(-40, Math.min(40, -centro * 0.12)));
      });
    };
    medir();
    window.addEventListener("scroll", medir, { passive: true });
    return () => {
      cancelAnimationFrame(cuadro);
      window.removeEventListener("scroll", medir);
    };
  }, [activo]);
  return { caja, desplazamiento: activo ? desplazamiento : 0 };
}

export function Componente({ seccion }: { seccion: Seccion; tokens: Tokens }) {
  const datos = leerSeccion<z.infer<typeof schema>>(seccion);
  const { reducido } = useMovimiento();
  const variante = varianteDe("escena-uso", seccion.variante);
  const { caja, desplazamiento } = useParallax(variante === "banda-a-sangre" && !reducido);
  if (!datos) return <SeccionInvalida tipo="escena-uso" />;
  const { ajustes, bloques } = datos;
  const fotos = bloques.map((b) => b.ajustes);

  if (variante === "banda-a-sangre") {
    const foto = fotos[0];
    return (
      <section ref={caja} className="relative isolate flex min-h-[70svh] items-end overflow-hidden px-5 py-espacio" data-variante={variante}>
        <div className="absolute -inset-y-12 inset-x-0 -z-20" data-parallax style={{ transform: `translateY(${desplazamiento}px)` }}>
          <MediaSlot slot={foto.slot} slotPorDefecto={foto.slot} relacion="16:9" llenar />
        </div>
        <div aria-hidden="true" data-velo className="absolute inset-0 -z-10 bg-gradient-to-t from-fondo via-fondo/60 to-transparent" />
        <div className="mx-auto w-full max-w-3xl">
          <Titular className="text-balance font-titulos text-h2 font-semibold tracking-tight">{ajustes.titulo}</Titular>
          {ajustes.texto && <p className="mt-3 max-w-xl text-pretty text-lead">{ajustes.texto}</p>}
          <CreditoCorto slot={foto.slot} className="mt-2" />
        </div>
      </section>
    );
  }

  return (
    <section className="px-5 py-espacio" data-variante={variante}>
      <div className="mx-auto max-w-5xl">
        <Titular className="max-w-2xl text-balance font-titulos text-h2 font-semibold tracking-tight">{ajustes.titulo}</Titular>
        {ajustes.texto && <p className="mt-3 max-w-2xl text-pretty text-lead text-suave">{ajustes.texto}</p>}
        <ul className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
          {fotos.map((f, i) => (
            <li key={`${f.slot}-${i}`} className={i === 0 && fotos.length === 3 ? "col-span-2 md:col-span-1" : ""}>
              <figure>
                <MediaSlot slot={f.slot} slotPorDefecto={f.slot} relacion="4:5" />
                {f.pie && <figcaption className="mt-2 text-sm text-suave">{f.pie}</figcaption>}
                <CreditoCorto slot={f.slot} className="mt-1" />
              </figure>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
