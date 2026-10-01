"use client";

import type { Seccion, Tokens } from "@/lib/contratos";
import { Dato } from "@/componentes/Dato";
import { Icono } from "@/componentes/Icono";
import { SeccionInvalida } from "@/componentes/SeccionInvalida";
import { Titular } from "@/componentes/Titular";
import { leerSeccion } from "../leer";
import type { schema } from "./schema";
import type { z } from "zod";

function Celda({ valor }: { valor: boolean | string }) {
  if (typeof valor === "string") return <Dato>{valor}</Dato>;
  return valor ? (
    <>
      <Icono nombre="check" className="mx-auto size-6 text-acento" />
      <span className="sr-only">Sí</span>
    </>
  ) : (
    <>
      <Icono nombre="cerrar" className="mx-auto size-5 text-suave" />
      <span className="sr-only">No</span>
    </>
  );
}

export function Componente({ seccion }: { seccion: Seccion; tokens: Tokens }) {
  const datos = leerSeccion<z.infer<typeof schema>>(seccion);
  if (!datos) return <SeccionInvalida tipo="comparativa" />;

  const { ajustes, bloques } = datos;
  const resaltado = ajustes.estilo === "resaltado";

  return (
    <section className="px-5 py-espacio">
      <div className="mx-auto max-w-3xl">
        <Titular className="text-balance font-titulos text-h2 font-semibold tracking-tight">
          {ajustes.titulo}
        </Titular>
        <div className="borde-token mt-10 overflow-x-auto rounded-tarjeta px-3 md:px-5">
        <table className="w-full border-collapse text-left text-sm md:text-cuerpo">
          <caption className="sr-only">{ajustes.titulo}</caption>
          <thead>
            <tr className="border-b-2 border-texto">
              <th scope="col" className="w-[44%] py-3 pr-2 font-medium text-suave">
                Característica
              </th>
              <th
                scope="col"
                className={`px-2 py-3 text-center font-titulos font-semibold ${resaltado ? "bg-acento text-acento-texto" : ""}`}
              >
                {ajustes.nombreNuestro}
              </th>
              <th scope="col" className="px-2 py-3 text-center font-medium text-suave">
                {ajustes.nombreOtros}
              </th>
            </tr>
          </thead>
          <tbody>
            {bloques.map((bloque) => (
              <tr key={bloque.id} className="border-b border-borde">
                <th scope="row" className="py-4 pr-2 font-normal">
                  {bloque.ajustes.caracteristica}
                </th>
                <td className={`px-2 py-4 text-center font-medium ${resaltado ? "bg-superficie" : ""}`}>
                  <Celda valor={bloque.ajustes.nuestro} />
                </td>
                <td className="px-2 py-4 text-center text-suave">
                  <Celda valor={bloque.ajustes.otros} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </section>
  );
}
