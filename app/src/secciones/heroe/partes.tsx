"use client";

import type { ReactNode } from "react";
import { Icono } from "@/componentes/Icono";
import type { Ajustes, Bloques } from "./schema";

export type Datos = { ajustes: Ajustes; bloques: Bloques };

export const SLOT_PRODUCTO = "heroe-producto";

export function Sello({ texto }: { texto?: string }) {
  if (!texto) return null;
  return (
    <p className="inline-flex items-center gap-2 text-sm text-suave">
      <Icono nombre="estrella" className="size-4 text-acento" />
      {texto}
    </p>
  );
}

export function BeneficiosCortos({ bloques }: { bloques: Bloques }) {
  if (bloques.length === 0) return null;
  return (
    <ul className="flex flex-wrap justify-center gap-2">
      {bloques.map((bloque) => (
        <li
          key={bloque.id}
          className="borde-token rounded-full bg-superficie px-4 py-1.5 text-sm text-texto"
        >
          {bloque.ajustes.texto}
        </li>
      ))}
    </ul>
  );
}

export function Subtitular({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <p className="max-w-xl text-pretty text-lead text-suave">{children}</p>;
}
