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
  if (!datos) return <SeccionInvalida tipo="historia" />;
  const { ajustes, bloques } = datos;
  const variante = varianteDe("historia", seccion.variante);

  const intentos = bloques.length > 0 && (
    <ul className="mt-5 flex flex-col gap-2">
      {bloques.map((b) => (
        <li key={b.id} className="flex items-start gap-3 text-suave">
          <Icono nombre="cerrar" className="mt-0.5 size-5 shrink-0" />
          <span>{b.ajustes.texto}</span>
        </li>
      ))}
    </ul>
  );

  if (variante === "carta") {
    return (
      <section className="px-5 py-espacio" data-variante={variante}>
        <article className="borde-token mx-auto max-w-2xl rounded-tarjeta bg-superficie p-6 md:p-10">
          <div className="mx-auto mb-6 w-28">
            <MediaSlot slot={ajustes.imagen} slotPorDefecto={ajustes.imagen} relacion="1:1" />
          </div>
          <Titular className="text-balance font-titulos text-h2 font-semibold tracking-tight">{ajustes.titulo}</Titular>
          <p className="mt-4 text-pretty text-lead">{ajustes.historia}</p>
          {intentos}
          {ajustes.giro && <p className="mt-5 border-l-4 border-acento pl-4 text-pretty font-medium">{ajustes.giro}</p>}
        </article>
      </section>
    );
  }

  return (
    <section className="relative isolate overflow-hidden px-5 py-espacio" data-variante={variante}>
      <div className="absolute inset-0 -z-20">
        <MediaSlot slot={ajustes.imagen} slotPorDefecto={ajustes.imagen} relacion="16:9" llenar />
      </div>
      <div aria-hidden="true" data-velo className="absolute inset-0 -z-10 bg-fondo/80" />
      <div className="mx-auto max-w-2xl">
        <Titular className="text-balance font-titulos text-h2 font-semibold tracking-tight">{ajustes.titulo}</Titular>
        <p className="mt-4 text-pretty text-lead">{ajustes.historia}</p>
        {intentos}
        {ajustes.giro && <p className="mt-5 rounded-tarjeta bg-superficie p-4 font-medium">{ajustes.giro}</p>}
      </div>
    </section>
  );
}
