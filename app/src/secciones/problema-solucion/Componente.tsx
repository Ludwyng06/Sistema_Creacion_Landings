"use client";

import type { Seccion, Tokens } from "@/lib/contratos";
import { MediaSlot } from "@/componentes/MediaSlot";
import { SeccionInvalida } from "@/componentes/SeccionInvalida";
import { Titular } from "@/componentes/Titular";
import { leerSeccion } from "../leer";
import type { schema } from "./schema";
import type { z } from "zod";

export function Componente({ seccion }: { seccion: Seccion; tokens: Tokens }) {
  const datos = leerSeccion<z.infer<typeof schema>>(seccion);
  if (!datos) return <SeccionInvalida tipo="problema-solucion" />;

  const { ajustes } = datos;
  const parrafos = ajustes.historia.split(/\n{2,}/).filter(Boolean);

  if (seccion.variante === "dividida") {
    return (
      <section className="px-5 py-espacio" data-variante="dividida">
        <div className="mx-auto grid max-w-5xl gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] md:gap-14">
          <div className="flex flex-col gap-6">
            <Titular className="text-balance font-titulos text-h2 font-semibold tracking-tight">{ajustes.titulo}</Titular>
            <p className="rounded-tarjeta bg-acento p-6 text-pretty font-titulos text-[calc(1.5rem*var(--escala-t,var(--escala)))] font-medium leading-snug text-acento-texto">
              {ajustes.giro}
            </p>
          </div>
          <div className="flex flex-col gap-4 text-lead text-suave">
            {parrafos.map((parrafo) => (
              <p key={parrafo} className="text-pretty">
                {parrafo}
              </p>
            ))}
          </div>
        </div>
        {ajustes.imagen && (
          <div className="mx-auto mt-10 max-w-5xl">
            <MediaSlot slot={ajustes.imagen} slotPorDefecto={ajustes.imagen} relacion="16:9" />
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="px-5 py-espacio">
      <div className="mx-auto max-w-2xl">
        <Titular className="text-balance font-titulos text-h2 font-semibold tracking-tight">
          {ajustes.titulo}
        </Titular>
        <div className="mt-6 flex flex-col gap-4 text-lead text-suave">
          {parrafos.map((parrafo) => (
            <p key={parrafo} className="text-pretty">
              {parrafo}
            </p>
          ))}
        </div>
        <p className="mt-8 border-l-4 border-acento pl-5 text-pretty font-titulos text-[calc(1.5rem*var(--escala-t,var(--escala)))] font-medium leading-snug">
          {ajustes.giro}
        </p>
      </div>
      {ajustes.imagen && (
        <div className="mx-auto mt-10 max-w-3xl">
          <MediaSlot slot={ajustes.imagen} slotPorDefecto={ajustes.imagen} relacion="16:9" />
        </div>
      )}
    </section>
  );
}
