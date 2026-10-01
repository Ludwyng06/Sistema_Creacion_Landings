"use client";

import { Magnetico } from "@/efectos/Magnetico";
import { useLanding } from "./contexto-landing";

/** Botón principal: lleva al formulario de la landing y admite `boton-magnetico`. */
export function Boton({ texto }: { texto: string }) {
  const { anclaFormulario } = useLanding();
  return (
    <Magnetico>
      <a
        href={`#${anclaFormulario}`}
        data-cursor="Ir"
        className="inline-flex min-h-12 items-center justify-center rounded-token bg-acento px-8 text-cuerpo font-medium text-acento-texto transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-acento"
      >
        {texto}
      </a>
    </Magnetico>
  );
}
