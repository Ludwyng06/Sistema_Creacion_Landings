"use client";

import type { z } from "zod";
import type { Seccion, Tokens } from "@/lib/contratos";
import { Dato } from "@/componentes/Dato";
import { COMPLETAR } from "@/componentes/dinero";
import { SeccionInvalida } from "@/componentes/SeccionInvalida";
import { Titular } from "@/componentes/Titular";
import { leerSeccion } from "../leer";
import { varianteDe } from "../variantes";
import type { BloqueEspecificacion, schema } from "./schema";

type Especificacion = BloqueEspecificacion["ajustes"];

/** «12 cm»; un valor sin dato queda como `[COMPLETAR]` y no arrastra la unidad. */
export function textoEspecificacion({ valor, unidad }: Especificacion): string {
  const texto = String(valor);
  return texto.includes(COMPLETAR) || !unidad ? texto : `${texto} ${unidad}`;
}

export function Componente({ seccion }: { seccion: Seccion; tokens: Tokens }) {
  const datos = leerSeccion<z.infer<typeof schema>>(seccion);
  if (!datos) return <SeccionInvalida tipo="ficha-tecnica" />;

  const { ajustes, bloques } = datos;
  const especificaciones = bloques.map((bloque) => ({ id: bloque.id, ...bloque.ajustes }));
  const variante = varianteDe("ficha-tecnica", seccion.variante);

  return (
    <section className="px-5 py-espacio" data-variante={variante}>
      <div className="mx-auto max-w-3xl">
        <Titular className="text-balance font-titulos text-h2 font-semibold tracking-tight">{ajustes.titulo}</Titular>

        {variante === "tabla" ? (
          <table className="mt-8 w-full border-collapse text-left">
            <caption className="sr-only">{ajustes.titulo}</caption>
            <tbody>
              {especificaciones.map((esp) => (
                <tr key={esp.id} className="border-b border-borde">
                  <th scope="row" className="w-1/2 py-3 pr-4 align-top font-normal text-suave">
                    {esp.nombre}
                  </th>
                  <td className="py-3 text-right font-medium md:text-left">
                    <Dato>{textoEspecificacion(esp)}</Dato>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <dl className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3">
            {especificaciones.map((esp) => (
              <div key={esp.id} className="borde-token rounded-tarjeta bg-superficie p-4">
                <dt className="text-sm text-suave">{esp.nombre}</dt>
                <dd className="mt-1 font-titulos text-xl font-semibold">
                  <Dato>{textoEspecificacion(esp)}</Dato>
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  );
}
