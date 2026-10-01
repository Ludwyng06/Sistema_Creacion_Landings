"use client";

import type { Seccion, Tokens } from "@/lib/contratos";
import { Dato } from "@/componentes/Dato";
import { SeccionInvalida } from "@/componentes/SeccionInvalida";
import { Titular } from "@/componentes/Titular";
import { leerSeccion } from "../leer";
import type { schema } from "./schema";
import type { z } from "zod";

export function Componente({ seccion }: { seccion: Seccion; tokens: Tokens }) {
  const datos = leerSeccion<z.infer<typeof schema>>(seccion);
  if (!datos) return <SeccionInvalida tipo="cifras" />;

  const { ajustes, bloques } = datos;

  return (
    <section className="px-5 py-espacio">
      <div className="mx-auto max-w-4xl">
        <Titular className="text-balance text-center font-titulos text-h2 font-semibold tracking-tight">
          {ajustes.titulo}
        </Titular>
        <dl className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-[repeat(auto-fit,minmax(10rem,1fr))]">
          {bloques.map((bloque) => (
            <div key={bloque.id} className="border-t-2 border-texto pt-4 text-center">
              <dd className="font-titulos text-[calc(clamp(2.25rem,9vw,4.5rem)*var(--escala-t,var(--escala)))] font-bold leading-none text-acento">
                <Dato>{bloque.ajustes.valor}</Dato>
              </dd>
              <dt className="mt-3 text-pretty text-sm text-suave">{bloque.ajustes.etiqueta}</dt>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
