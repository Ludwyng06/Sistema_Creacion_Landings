"use client";

import type { z } from "zod";
import type { Seccion, Tokens } from "@/lib/contratos";
import { Dato } from "@/componentes/Dato";
import { MediaSlot } from "@/componentes/MediaSlot";
import { SeccionInvalida } from "@/componentes/SeccionInvalida";
import { Titular } from "@/componentes/Titular";
import { leerSeccion } from "../leer";
import { varianteDe } from "../variantes";
import type { schema } from "./schema";

export function Componente({ seccion }: { seccion: Seccion; tokens: Tokens }) {
  const datos = leerSeccion<z.infer<typeof schema>>(seccion);
  if (!datos) return <SeccionInvalida tipo="agenda" />;
  const { ajustes, bloques } = datos;
  const variante = varianteDe("agenda", seccion.variante);
  const momentos = bloques.map((b) => ({ id: b.id, ...b.ajustes }));

  if (variante === "por-dias") {
    return (
      <section className="px-5 py-espacio" data-variante={variante}>
        <div className="mx-auto max-w-5xl">
          {ajustes.imagen && (
            <div className="mb-8 overflow-hidden rounded-tarjeta">
              <MediaSlot slot={ajustes.imagen} slotPorDefecto={ajustes.imagen} relacion="16:9" />
            </div>
          )}
          <Titular className="text-balance font-titulos text-h2 font-semibold tracking-tight">{ajustes.titulo}</Titular>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {momentos.map((m) => (
              <li key={m.id} className="borde-token rounded-tarjeta bg-superficie p-5">
                <p className="text-sm font-medium uppercase tracking-wide text-acento">
                  <Dato>{m.cuando}</Dato>
                </p>
                <h3 className="mt-2 font-titulos text-xl font-semibold">{m.titulo}</h3>
                {m.texto && <p className="mt-2 text-suave">{m.texto}</p>}
              </li>
            ))}
          </ol>
        </div>
      </section>
    );
  }

  return (
    <section className="px-5 py-espacio" data-variante={variante}>
      <div className="mx-auto flex max-w-5xl flex-col gap-8 md:grid md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] md:items-start">
        <div>
          <Titular className="text-balance font-titulos text-h2 font-semibold tracking-tight">{ajustes.titulo}</Titular>
          <ol className="mt-8 flex flex-col">
            {momentos.map((m) => (
              <li key={m.id} className="grid grid-cols-[6.5rem_1fr] gap-x-4 border-t border-borde py-4 first:border-t-0">
                <span className="font-titulos font-semibold text-acento">
                  <Dato>{m.cuando}</Dato>
                </span>
                <span>
                  <strong className="font-medium">{m.titulo}</strong>
                  {m.texto && <span className="block text-suave">{m.texto}</span>}
                </span>
              </li>
            ))}
          </ol>
        </div>
        {ajustes.imagen && <MediaSlot slot={ajustes.imagen} slotPorDefecto={ajustes.imagen} relacion="4:5" />}
      </div>
    </section>
  );
}
