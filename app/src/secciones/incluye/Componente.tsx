"use client";

import type { Seccion, Tokens } from "@/lib/contratos";
import { Icono } from "@/componentes/Icono";
import { MediaSlot } from "@/componentes/MediaSlot";
import { SeccionInvalida } from "@/componentes/SeccionInvalida";
import { Titular } from "@/componentes/Titular";
import { SeccionConImagen } from "../con-imagen";
import { leerSeccion } from "../leer";
import type { schema } from "./schema";
import type { z } from "zod";

export function Componente({ seccion }: { seccion: Seccion; tokens: Tokens }) {
  const datos = leerSeccion<z.infer<typeof schema>>(seccion);
  if (!datos) return <SeccionInvalida tipo="incluye" />;

  const { ajustes, bloques } = datos;
  const enFondo = seccion.variante === "fondo-banco";

  return (
    <SeccionConImagen slot={enFondo ? ajustes.imagen : undefined} modo="fondo">
      <div className="mx-auto max-w-2xl">
        <Titular className="text-balance font-titulos text-h2 font-semibold tracking-tight">
          {ajustes.titulo}
        </Titular>
        <p className="mt-4 text-pretty text-lead text-suave">{ajustes.texto}</p>
      </div>
      {!enFondo && (
        <div className="mx-auto mt-10 max-w-md">
          <MediaSlot slot={ajustes.imagen} slotPorDefecto={ajustes.imagen} relacion="1:1" />
        </div>
      )}
      <ul className="mx-auto mt-10 flex max-w-2xl flex-col gap-3">
        {bloques.map((bloque) => (
          <li key={bloque.id} className="flex items-start gap-3 border-b border-borde pb-3">
            <Icono nombre="check" className="mt-0.5 size-6 shrink-0 text-acento" />
            <span>{bloque.ajustes.texto}</span>
          </li>
        ))}
      </ul>
    </SeccionConImagen>
  );
}
