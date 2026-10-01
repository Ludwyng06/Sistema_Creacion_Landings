"use client";

import type { Seccion, Tokens } from "@/lib/contratos";
import { Dato } from "@/componentes/Dato";
import { Icono } from "@/componentes/Icono";
import { SeccionInvalida } from "@/componentes/SeccionInvalida";
import { Titular } from "@/componentes/Titular";
import { SeccionConImagen } from "../con-imagen";
import { leerSeccion } from "../leer";
import type { schema } from "./schema";
import type { z } from "zod";

export function Componente({ seccion }: { seccion: Seccion; tokens: Tokens }) {
  const datos = leerSeccion<z.infer<typeof schema>>(seccion);
  if (!datos) return <SeccionInvalida tipo="garantia" />;

  const { ajustes, bloques } = datos;
  const conImagen = seccion.variante === "con-imagen" ? ajustes.imagen : undefined;

  return (
    <SeccionConImagen slot={conImagen} modo="lado">
      <div className="borde-token mx-auto max-w-2xl rounded-tarjeta bg-superficie p-6 text-center md:p-10">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-acento text-acento-texto">
          <Icono nombre={ajustes.icono} className="size-8" />
        </span>
        <p className="mt-5 font-titulos text-[calc(clamp(2rem,8vw,3rem)*var(--escala-t,var(--escala)))] font-bold leading-none text-acento">
          <Dato>{`${ajustes.dias} días`}</Dato>
        </p>
        <Titular className="mt-4 text-balance font-titulos text-h2 font-semibold tracking-tight">
          {ajustes.titulo}
        </Titular>
        <p className="mx-auto mt-3 max-w-md text-pretty text-suave">{ajustes.texto}</p>
        <ul className="mt-8 flex flex-col gap-3 text-left">
          {bloques.map((bloque) => (
            <li key={bloque.id} className="flex items-start gap-3 border-t border-borde pt-3">
              <Icono nombre="check" className="mt-0.5 size-6 shrink-0 text-acento" />
              <span>{bloque.ajustes.texto}</span>
            </li>
          ))}
        </ul>
      </div>
    </SeccionConImagen>
  );
}
