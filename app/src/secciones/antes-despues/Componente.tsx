"use client";

import type { Seccion, Tokens } from "@/lib/contratos";
import { Comparador } from "@/componentes/Comparador";
import { MediaSlot } from "@/componentes/MediaSlot";
import { SeccionInvalida } from "@/componentes/SeccionInvalida";
import { Titular } from "@/componentes/Titular";
import { leerSeccion } from "../leer";
import type { schema } from "./schema";
import type { z } from "zod";

export function Componente({ seccion }: { seccion: Seccion; tokens: Tokens }) {
  const datos = leerSeccion<z.infer<typeof schema>>(seccion);
  if (!datos) return <SeccionInvalida tipo="antes-despues" />;

  const { ajustes } = datos;

  if (seccion.variante === "lado-a-lado") {
    return (
      <section className="px-5 py-espacio" data-variante="lado-a-lado">
        <div className="mx-auto max-w-5xl">
          <Titular className="text-balance font-titulos text-h2 font-semibold tracking-tight">{ajustes.titulo}</Titular>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {(
              [
                [ajustes.imagenAntes, ajustes.etiquetaAntes, "bg-superficie text-texto"],
                [ajustes.imagenDespues, ajustes.etiquetaDespues, "bg-acento text-acento-texto"],
              ] as const
            ).map(([slot, etiqueta, clase]) => (
              <figure key={etiqueta} className="flex flex-col gap-3">
                <MediaSlot slot={slot} slotPorDefecto={slot} relacion="4:5" />
                <figcaption className={`self-start rounded-token px-4 py-1.5 text-sm font-medium uppercase tracking-widest ${clase}`}>{etiqueta}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="px-5 py-espacio">
      <div className="mx-auto max-w-3xl">
        <Titular className="text-balance text-center font-titulos text-h2 font-semibold tracking-tight">
          {ajustes.titulo}
        </Titular>
        <div className="mt-10">
          <Comparador
            slotAntes={ajustes.imagenAntes}
            slotDespues={ajustes.imagenDespues}
            etiquetaAntes={ajustes.etiquetaAntes}
            etiquetaDespues={ajustes.etiquetaDespues}
            anchoSlider="max-w-xl"
            nombre={`${ajustes.titulo}: comparar ${ajustes.etiquetaAntes} y ${ajustes.etiquetaDespues}`}
          />
        </div>
      </div>
    </section>
  );
}
