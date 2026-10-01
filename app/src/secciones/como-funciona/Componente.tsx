"use client";

import type { Seccion, Tokens } from "@/lib/contratos";
import { SeccionInvalida } from "@/componentes/SeccionInvalida";
import { Titular } from "@/componentes/Titular";
import { SeccionConImagen } from "../con-imagen";
import { leerSeccion } from "../leer";
import type { BloquePaso } from "./schema";
import type { schema } from "./schema";
import type { z } from "zod";

type Paso = BloquePaso["ajustes"];

const TITULO_PASO = "font-titulos text-[calc(1.375rem*var(--escala-t,var(--escala)))] font-semibold leading-tight";

function PasosVerticales({ pasos }: { pasos: Paso[] }) {
  return (
    <ol className="mt-10 flex flex-col gap-8">
      {pasos.map((paso, indice) => (
        <li key={paso.titulo} className="borde-token rounded-tarjeta bg-superficie p-6">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-acento">
            Paso {indice + 1}
          </p>
          <h3 className={`${TITULO_PASO} mt-2`}>{paso.titulo}</h3>
          <p className="mt-2 text-suave">{paso.texto}</p>
        </li>
      ))}
    </ol>
  );
}

function LineaTiempo({ pasos }: { pasos: Paso[] }) {
  return (
    <ol className="relative mt-10 ml-5 border-l-2 border-borde">
      {pasos.map((paso, indice) => (
        <li key={paso.titulo} className="relative pb-10 pl-8 last:pb-0">
          <span
            aria-hidden="true"
            className="absolute -left-[1.4rem] top-0 grid size-10 place-items-center rounded-full bg-acento font-titulos text-lg font-semibold text-acento-texto"
          >
            {indice + 1}
          </span>
          <h3 className={`${TITULO_PASO} pt-1.5`}>{paso.titulo}</h3>
          <p className="mt-2 max-w-xl text-suave">{paso.texto}</p>
        </li>
      ))}
    </ol>
  );
}

export function Componente({ seccion }: { seccion: Seccion; tokens: Tokens }) {
  const datos = leerSeccion<z.infer<typeof schema>>(seccion);
  if (!datos) return <SeccionInvalida tipo="como-funciona" />;

  const { ajustes, bloques } = datos;
  const pasos = bloques.map((bloque) => bloque.ajustes);

  return (
    <SeccionConImagen slot={ajustes.disposicion === "pasos-con-imagen" ? ajustes.imagen : undefined} modo="lado" lado="izquierda">
      <div className="mx-auto max-w-3xl">
        <Titular className="max-w-2xl text-balance font-titulos text-h2 font-semibold tracking-tight">
          {ajustes.titulo}
        </Titular>
        {ajustes.disposicion !== "linea-tiempo" ? (
          <PasosVerticales pasos={pasos} />
        ) : (
          <LineaTiempo pasos={pasos} />
        )}
      </div>
    </SeccionConImagen>
  );
}
