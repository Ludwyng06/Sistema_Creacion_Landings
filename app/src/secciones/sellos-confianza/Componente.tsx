"use client";

import type { z } from "zod";
import type { Seccion, Tokens } from "@/lib/contratos";
import { Icono } from "@/componentes/Icono";
import { SeccionInvalida } from "@/componentes/SeccionInvalida";
import { leerSeccion } from "../leer";
import { varianteDe } from "../variantes";
import type { schema } from "./schema";

export function Componente({ seccion }: { seccion: Seccion; tokens: Tokens }) {
  const datos = leerSeccion<z.infer<typeof schema>>(seccion);
  if (!datos) return <SeccionInvalida tipo="sellos-confianza" />;

  const { ajustes, bloques } = datos;
  const sellos = bloques.map((bloque) => ({ id: bloque.id, ...bloque.ajustes }));
  const variante = varianteDe("sellos-confianza", seccion.variante);
  const etiqueta = ajustes.titulo ?? "Compra con tranquilidad";

  if (variante === "franja-texto") {
    return (
      <section aria-label={etiqueta} className="border-y border-borde bg-superficie px-5 py-4" data-variante="franja-texto">
        <ul className="mx-auto flex max-w-5xl flex-wrap justify-center gap-x-6 gap-y-2 text-sm font-medium">
          {sellos.map((sello) => (
            <li key={sello.id} className="flex items-center gap-2">
              <Icono nombre="check" className="size-4 shrink-0 text-acento" />
              {sello.titulo}
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <section aria-label={etiqueta} className="px-5 py-10 md:py-14" data-variante="iconos-fila">
      <ul className="mx-auto grid max-w-5xl grid-cols-2 gap-x-4 gap-y-8 md:flex md:justify-between md:gap-6">
        {sellos.map((sello) => (
          <li key={sello.id} className="flex flex-col items-center text-center md:flex-1">
            <span className="grid size-12 place-items-center rounded-full bg-acento text-acento-texto">
              <Icono nombre={sello.icono} className="size-6" />
            </span>
            <p className="mt-3 font-medium">{sello.titulo}</p>
            {sello.texto && <p className="mt-1 text-pretty text-sm text-suave">{sello.texto}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
