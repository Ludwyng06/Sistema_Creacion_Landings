"use client";

import type { Seccion, Tokens } from "@/lib/contratos";
import { Icono } from "@/componentes/Icono";
import { Dato } from "@/componentes/Dato";
import { SeccionInvalida } from "@/componentes/SeccionInvalida";
import { Titular } from "@/componentes/Titular";
import { SeccionConImagen } from "../con-imagen";
import { leerSeccion } from "../leer";
import type { schema } from "./schema";
import type { z } from "zod";

/** Acordeón con `<details>`: teclado y lector de pantalla funcionan sin ARIA extra. */
export function Componente({ seccion }: { seccion: Seccion; tokens: Tokens }) {
  const datos = leerSeccion<z.infer<typeof schema>>(seccion);
  if (!datos) return <SeccionInvalida tipo="faq" />;

  const { ajustes, bloques } = datos;
  const conImagen = seccion.variante === "con-imagen" ? ajustes.imagen : undefined;

  return (
    <SeccionConImagen slot={conImagen} modo="lado">
      <div className="mx-auto max-w-3xl">
        <Titular className="text-balance font-titulos text-h2 font-semibold tracking-tight">{ajustes.titulo}</Titular>
        <div className="mt-10 divide-y divide-borde border-y border-borde">
          {bloques.map((bloque) => (
            <details key={bloque.id} className="group" data-objecion={bloque.ajustes.objecion}>
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-5 text-left font-titulos text-[calc(1.1875rem*var(--escala-t,var(--escala)))] font-medium marker:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento [&::-webkit-details-marker]:hidden">
                <span className="text-pretty">{bloque.ajustes.pregunta}</span>
                <Icono
                  nombre="mas"
                  className="size-5 shrink-0 text-acento transition-transform group-open:rotate-45"
                />
              </summary>
              <p className="max-w-2xl pb-6 text-suave"><Dato>{bloque.ajustes.respuesta}</Dato></p>
            </details>
          ))}
        </div>
      </div>
    </SeccionConImagen>
  );
}
