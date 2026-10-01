"use client";

import type { z } from "zod";
import type { Seccion, Tokens } from "@/lib/contratos";
import { CreditoCorto } from "@/componentes/CreditoCorto";
import { MediaSlot } from "@/componentes/MediaSlot";
import { SeccionInvalida } from "@/componentes/SeccionInvalida";
import { Titular } from "@/componentes/Titular";
import { leerSeccion } from "../leer";
import { varianteDe } from "../variantes";
import type { schema } from "./schema";

export function Componente({ seccion }: { seccion: Seccion; tokens: Tokens }) {
  const datos = leerSeccion<z.infer<typeof schema>>(seccion);
  if (!datos) return <SeccionInvalida tipo="dato-curioso" />;

  const { ajustes } = datos;
  const variante = varianteDe("dato-curioso", seccion.variante);
  const { slotReal, slotProducto } = ajustes;

  const fuente = (
    <p className="mt-4 text-sm text-suave">
      Fuente:{" "}
      <a
        href={ajustes.fuenteUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-texto underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento"
      >
        {ajustes.fuenteNombre}
      </a>
    </p>
  );

  if (variante !== "real-vs-producto" || !slotReal || !slotProducto) {
    return (
      <section className="px-5 py-espacio" data-variante="sabias-que">
        <figure className="borde-token mx-auto max-w-2xl rounded-tarjeta bg-superficie p-6 md:p-10">
          <figcaption className="text-sm font-medium uppercase tracking-wide text-acento">{ajustes.titulo}</figcaption>
          <blockquote className="mt-3 text-pretty font-titulos text-h2 font-semibold tracking-tight">{ajustes.frase}</blockquote>
          {fuente}
        </figure>
      </section>
    );
  }

  const fotos = [
    { slot: slotReal, etiqueta: ajustes.etiquetaReal ?? "Real" },
    { slot: slotProducto, etiqueta: ajustes.etiquetaProducto ?? "Producto" },
  ];
  return (
    <section className="px-5 py-espacio" data-variante="real-vs-producto">
      <div className="mx-auto max-w-4xl">
        <Titular className="max-w-2xl text-balance font-titulos text-h2 font-semibold tracking-tight">{ajustes.titulo}</Titular>
        <p className="mt-4 max-w-2xl text-pretty text-lead text-suave">{ajustes.frase}</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {fotos.map(({ slot, etiqueta }) => (
            <figure key={slot}>
              <MediaSlot slot={slot} slotPorDefecto={slot} relacion="4:5" />
              <figcaption className="mt-2 text-sm font-medium">{etiqueta}</figcaption>
              <CreditoCorto slot={slot} />
            </figure>
          ))}
        </div>
        {fuente}
      </div>
    </section>
  );
}
