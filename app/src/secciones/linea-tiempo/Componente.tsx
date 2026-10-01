"use client";

import type { z } from "zod";
import type { Seccion, Tokens } from "@/lib/contratos";
import { CreditoCorto } from "@/componentes/CreditoCorto";
import { Dato } from "@/componentes/Dato";
import { MediaSlot } from "@/componentes/MediaSlot";
import { SeccionInvalida } from "@/componentes/SeccionInvalida";
import { Titular } from "@/componentes/Titular";
import { leerSeccion } from "../leer";
import { varianteDe } from "../variantes";
import type { BloqueHito, schema } from "./schema";

type Hito = BloqueHito["ajustes"] & { id: string };

function Imagen({ hito }: { hito: Hito }) {
  if (!hito.imagen) return null;
  return (
    <div className="mt-3">
      <MediaSlot slot={hito.imagen} slotPorDefecto={hito.imagen} relacion="16:9" />
      <CreditoCorto slot={hito.imagen} className="mt-1" />
    </div>
  );
}

export function Componente({ seccion }: { seccion: Seccion; tokens: Tokens }) {
  const datos = leerSeccion<z.infer<typeof schema>>(seccion);
  if (!datos) return <SeccionInvalida tipo="linea-tiempo" />;
  const { ajustes, bloques } = datos;
  const variante = varianteDe("linea-tiempo", seccion.variante);
  const hitos: Hito[] = bloques.map((b) => ({ id: b.id, ...b.ajustes }));
  const encabezado = (
    <>
      <Titular className="max-w-2xl text-balance font-titulos text-h2 font-semibold tracking-tight">{ajustes.titulo}</Titular>
      {ajustes.intro && <p className="mt-3 max-w-2xl text-pretty text-lead text-suave">{ajustes.intro}</p>}
    </>
  );

  if (variante === "horizontal") {
    return (
      <section className="px-5 py-espacio" data-variante={variante}>
        <div className="mx-auto max-w-5xl">
          {encabezado}
          <ol
            role="region"
            aria-label={ajustes.titulo}
            tabIndex={0}
            className="-mx-5 mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento"
          >
            {hitos.map((h) => (
              <li key={h.id} className="borde-token w-[82%] shrink-0 snap-start rounded-tarjeta bg-superficie p-5 md:w-80">
                <p className="font-titulos text-xl font-bold text-acento">
                  <Dato>{h.cuando}</Dato>
                </p>
                <h3 className="mt-1 font-titulos text-lg font-semibold">{h.titulo}</h3>
                {h.texto && <p className="mt-2 text-suave">{h.texto}</p>}
                <Imagen hito={h} />
              </li>
            ))}
          </ol>
        </div>
      </section>
    );
  }

  return (
    <section className="px-5 py-espacio" data-variante={variante}>
      <div className="mx-auto max-w-3xl">
        {encabezado}
        <ol className="relative mt-10 ml-5 border-l-2 border-borde">
          {hitos.map((h) => (
            <li key={h.id} className="relative pb-10 pl-8 last:pb-0">
              <span aria-hidden="true" className="absolute -left-[0.6rem] top-1.5 size-4 rounded-full border-2 border-acento bg-fondo" />
              <p className="font-titulos text-xl font-bold text-acento">
                <Dato>{h.cuando}</Dato>
              </p>
              <h3 className="mt-1 font-titulos text-lg font-semibold">{h.titulo}</h3>
              {h.texto && <p className="mt-2 max-w-xl text-suave">{h.texto}</p>}
              <div className="max-w-md">
                <Imagen hito={h} />
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
