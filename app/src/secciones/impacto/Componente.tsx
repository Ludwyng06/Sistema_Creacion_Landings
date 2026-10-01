"use client";

import type { z } from "zod";
import type { Seccion, Tokens } from "@/lib/contratos";
import { CreditoCorto } from "@/componentes/CreditoCorto";
import { Dato } from "@/componentes/Dato";
import { COMPLETAR } from "@/componentes/dinero";
import { MediaSlot } from "@/componentes/MediaSlot";
import { SeccionInvalida } from "@/componentes/SeccionInvalida";
import { Titular } from "@/componentes/Titular";
import { leerSeccion } from "../leer";
import { varianteDe } from "../variantes";
import type { schema } from "./schema";

const formato = (n: number) => new Intl.NumberFormat("es-CO").format(n);

export function Componente({ seccion }: { seccion: Seccion; tokens: Tokens }) {
  const datos = leerSeccion<z.infer<typeof schema>>(seccion);
  if (!datos) return <SeccionInvalida tipo="impacto" />;
  const { ajustes, bloques } = datos;
  const variante = varianteDe("impacto", seccion.variante);
  const { logrado, meta } = ajustes;
  // El avance solo se dibuja con dos cifras reales; con `[COMPLETAR]` queda el texto.
  const avance = typeof logrado === "number" && typeof meta === "number" && meta > 0 ? Math.min(100, Math.round((logrado / meta) * 100)) : null;

  const imagen = (
    <figure>
      <MediaSlot slot={ajustes.imagen} slotPorDefecto={ajustes.imagen} relacion="16:9" />
      <CreditoCorto slot={ajustes.imagen} className="mt-1" />
    </figure>
  );

  if (variante === "meta") {
    return (
      <section className="relative isolate overflow-hidden px-5 py-espacio" data-variante={variante}>
        <div className="absolute inset-0 -z-20">
          <MediaSlot slot={ajustes.imagen} slotPorDefecto={ajustes.imagen} relacion="16:9" llenar />
        </div>
        <div aria-hidden="true" data-velo className="absolute inset-0 -z-10 bg-fondo/85" />
        <div className="mx-auto max-w-2xl">
          <Titular className="text-balance font-titulos text-h2 font-semibold tracking-tight">{ajustes.titulo}</Titular>
          {ajustes.texto && <p className="mt-3 text-pretty text-lead">{ajustes.texto}</p>}
          <div className="borde-token mt-8 rounded-tarjeta bg-superficie p-6">
            <p className="font-titulos text-3xl font-bold">
              {typeof logrado === "number" ? formato(logrado) : <Dato>{logrado ?? COMPLETAR}</Dato>}
              <span className="text-lead font-normal text-suave">
                {" "}de {typeof meta === "number" ? formato(meta) : <Dato>{meta ?? COMPLETAR}</Dato>} {ajustes.unidadMeta}
              </span>
            </p>
            {avance !== null && (
              <div role="progressbar" aria-label="Avance hacia la meta" aria-valuemin={0} aria-valuemax={100} aria-valuenow={avance} className="mt-4 h-3 overflow-hidden rounded-full bg-borde">
                <div className="h-full bg-acento" style={{ width: `${avance}%` }} />
              </div>
            )}
            <ul className="mt-6 grid grid-cols-2 gap-4">
              {bloques.map((b) => (
                <li key={b.id}>
                  <p className="font-titulos text-2xl font-bold text-acento">
                    {typeof b.ajustes.valor === "number" ? formato(b.ajustes.valor) : <Dato>{b.ajustes.valor}</Dato>}
                    {b.ajustes.unidad ? ` ${b.ajustes.unidad}` : ""}
                  </p>
                  <p className="text-sm text-suave">{b.ajustes.etiqueta}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="px-5 py-espacio" data-variante={variante}>
      <div className="mx-auto max-w-4xl">
        <Titular className="max-w-2xl text-balance font-titulos text-h2 font-semibold tracking-tight">{ajustes.titulo}</Titular>
        {ajustes.texto && <p className="mt-3 max-w-2xl text-pretty text-lead text-suave">{ajustes.texto}</p>}
        <div className="mt-8">{imagen}</div>
        <ul className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          {bloques.map((b) => (
            <li key={b.id} className="borde-token rounded-tarjeta bg-superficie p-5">
              <p className="font-titulos text-3xl font-bold text-acento">
                {typeof b.ajustes.valor === "number" ? formato(b.ajustes.valor) : <Dato>{b.ajustes.valor}</Dato>}
                {b.ajustes.unidad ? ` ${b.ajustes.unidad}` : ""}
              </p>
              <p className="mt-1 text-suave">{b.ajustes.etiqueta}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
