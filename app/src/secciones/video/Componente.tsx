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
  if (!datos) return <SeccionInvalida tipo="video" />;

  const { ajustes } = datos;

  if (seccion.variante === "lado") {
    return (
      <section className="px-5 py-espacio" data-variante="lado">
        <div className="mx-auto grid max-w-5xl items-center gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] md:gap-12">
          <Titular className="text-balance font-titulos text-h2 font-semibold tracking-tight">{ajustes.titulo}</Titular>
          <MediaSlot slot={ajustes.slot} slotPorDefecto={ajustes.slot} relacion="16:9" tipo="video" posterSlot={ajustes.poster} autoplay={ajustes.autoplay} />
        </div>
      </section>
    );
  }

  return (
    <section className="px-5 py-espacio">
      <div className="mx-auto max-w-4xl">
        <Titular className="text-balance text-center font-titulos text-h2 font-semibold tracking-tight">
          {ajustes.titulo}
        </Titular>
        <div className="mt-10">
          <MediaSlot
            slot={ajustes.slot}
            slotPorDefecto={ajustes.slot}
            relacion="16:9"
            tipo="video"
            posterSlot={ajustes.poster}
            autoplay={ajustes.autoplay}
          />
        </div>
      </div>
    </section>
  );
}
