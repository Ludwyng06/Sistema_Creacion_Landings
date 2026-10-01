"use client";

import type { z } from "zod";
import type { Seccion, Tokens } from "@/lib/contratos";
import { Icono } from "@/componentes/Icono";
import { MediaSlot } from "@/componentes/MediaSlot";
import { SeccionInvalida } from "@/componentes/SeccionInvalida";
import { Titular } from "@/componentes/Titular";
import { leerSeccion } from "../leer";
import { varianteDe } from "../variantes";
import type { schema } from "./schema";

export function Componente({ seccion }: { seccion: Seccion; tokens: Tokens }) {
  const datos = leerSeccion<z.infer<typeof schema>>(seccion);
  if (!datos) return <SeccionInvalida tipo="resumen" />;
  const { ajustes, bloques } = datos;
  const variante = varianteDe("resumen", seccion.variante);

  const items = (
    <ul className="flex flex-col gap-3">
      {bloques.map((b) => (
        <li key={b.id} className="flex items-start gap-3 border-b border-borde pb-3">
          <Icono nombre="check" className="mt-0.5 size-6 shrink-0 text-acento" />
          <span>{b.ajustes.texto}</span>
        </li>
      ))}
    </ul>
  );

  if (variante === "tarjeta-final") {
    return (
      <section className="px-5 py-espacio" data-variante={variante}>
        <div className="borde-token mx-auto max-w-lg overflow-hidden rounded-tarjeta bg-superficie">
          {ajustes.imagen && <MediaSlot slot={ajustes.imagen} slotPorDefecto={ajustes.imagen} relacion="16:9" />}
          <div className="p-6">
            <Titular className="text-balance font-titulos text-h2 font-semibold tracking-tight">{ajustes.titulo}</Titular>
            <div className="mt-5">{items}</div>
            {ajustes.cierre && <p className="mt-5 font-medium">{ajustes.cierre}</p>}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="px-5 py-espacio" data-variante={variante}>
      <div className="mx-auto flex max-w-3xl flex-col gap-8 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,16rem)] md:items-start">
        <div>
          <Titular className="text-balance font-titulos text-h2 font-semibold tracking-tight">{ajustes.titulo}</Titular>
          <div className="mt-6">{items}</div>
          {ajustes.cierre && <p className="mt-5 font-medium">{ajustes.cierre}</p>}
        </div>
        {ajustes.imagen && <MediaSlot slot={ajustes.imagen} slotPorDefecto={ajustes.imagen} relacion="1:1" />}
      </div>
    </section>
  );
}
