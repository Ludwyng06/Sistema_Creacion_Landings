"use client";

import type { z } from "zod";
import type { Seccion, Tokens } from "@/lib/contratos";
import { CreditoCorto } from "@/componentes/CreditoCorto";
import { MediaSlot } from "@/componentes/MediaSlot";
import { SeccionInvalida } from "@/componentes/SeccionInvalida";
import { Titular } from "@/componentes/Titular";
import { leerSeccion } from "../leer";
import { varianteDe } from "../variantes";
import type { BloqueNota, schema } from "./schema";

type Nota = BloqueNota["ajustes"];

function Tarjetas({ notas }: { notas: Nota[] }) {
  return (
    <ol className="flex w-full flex-col gap-4">
      {notas.map((n, i) => (
        <li key={i} className="borde-token rounded-tarjeta bg-superficie p-4">
          <strong className="font-medium">{n.titulo}</strong>
          {n.texto && <span className="block text-sm text-suave">{n.texto}</span>}
        </li>
      ))}
    </ol>
  );
}

export function Componente({ seccion }: { seccion: Seccion; tokens: Tokens }) {
  const datos = leerSeccion<z.infer<typeof schema>>(seccion);
  if (!datos) return <SeccionInvalida tipo="mecanismo" />;
  const { ajustes, bloques } = datos;
  const variante = varianteDe("mecanismo", seccion.variante);
  const notas = bloques.map((b) => b.ajustes);
  const encabezado = <Titular className="text-balance font-titulos text-h2 font-semibold tracking-tight">{ajustes.titulo}</Titular>;

  if (variante === "antes-despues-creencia") {
    return (
      <section className="px-5 py-espacio" data-variante={variante}>
        <div className="mx-auto max-w-4xl">
          {encabezado}
          <div className="mt-8 flex flex-col gap-4 md:grid md:grid-cols-2 md:gap-6">
            <p className="borde-token rounded-tarjeta p-5 text-suave" data-creencia>
              <span className="mb-1 block text-sm font-medium uppercase tracking-wide">Pensabas que…</span>
              <span className="text-lead line-through decoration-1">{ajustes.creencia}</span>
            </p>
            <p className="rounded-tarjeta bg-acento p-5 text-acento-texto" data-realidad>
              <span className="mb-1 block text-sm font-medium uppercase tracking-wide">Pero en realidad…</span>
              <span className="text-lead">{ajustes.realidad}</span>
            </p>
          </div>
          <div className="mx-auto mt-8 max-w-md">
            <MediaSlot slot={ajustes.imagen} slotPorDefecto={ajustes.imagen} relacion="4:5" />
            <CreditoCorto slot={ajustes.imagen} className="mt-1" />
          </div>
        </div>
      </section>
    );
  }

  if (variante === "zoom-detalle") {
    return (
      <section className="px-5 py-espacio" data-variante={variante}>
        <div className="mx-auto max-w-3xl">
          {encabezado}
          <p className="mt-3 text-pretty text-lead text-suave">{ajustes.realidad}</p>
          <div className="relative mx-auto mt-8 max-w-lg">
            <MediaSlot slot={ajustes.imagen} slotPorDefecto={ajustes.imagen} relacion="4:5" />
            {notas.map((n, i) =>
              n.x === undefined || n.y === undefined ? null : (
                <span
                  key={i}
                  aria-hidden="true"
                  data-punto={i + 1}
                  style={{ left: `${n.x}%`, top: `${n.y}%` }}
                  className="absolute grid size-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-acento text-sm font-semibold text-acento-texto shadow-lg"
                >
                  {i + 1}
                </span>
              ),
            )}
          </div>
          <ol className="mx-auto mt-6 flex max-w-lg flex-col gap-3">
            {notas.map((n, i) => (
              <li key={i} className="flex items-start gap-3">
                <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full bg-acento text-sm font-semibold text-acento-texto">
                  {i + 1}
                </span>
                <span>
                  <strong className="font-medium">{n.titulo}</strong>
                  {n.texto && <span className="block text-suave">{n.texto}</span>}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>
    );
  }

  return (
    <section className="px-5 py-espacio" data-variante={variante}>
      <div className="mx-auto max-w-4xl">
        {encabezado}
        <p className="mt-3 max-w-2xl text-pretty text-lead text-suave">{ajustes.realidad}</p>
        <div className="mt-8 flex flex-col items-center gap-6 md:grid md:grid-cols-3 md:items-center">
          <Tarjetas notas={notas.filter((_, i) => i % 2 === 0)} />
          <div className="w-full max-w-xs">
            <MediaSlot slot={ajustes.imagen} slotPorDefecto={ajustes.imagen} relacion="4:5" />
          </div>
          <Tarjetas notas={notas.filter((_, i) => i % 2 === 1)} />
        </div>
      </div>
    </section>
  );
}
