"use client";

import type { Seccion, Tokens } from "@/lib/contratos";
import { Boton } from "@/componentes/Boton";
import { Dato } from "@/componentes/Dato";
import { calcularAhorro, formatearDinero, type Moneda } from "@/componentes/dinero";
import { SeccionInvalida } from "@/componentes/SeccionInvalida";
import { Titular } from "@/componentes/Titular";
import { SeccionConImagen } from "../con-imagen";
import { PrecioAnimado } from "@/efectos/PrecioAnimado";
import { leerSeccion } from "../leer";
import type { schema } from "./schema";
import type { z } from "zod";

function Precio({ valor, desde, moneda, className }: { valor: number | string; desde?: number | string; moneda: Moneda; className: string }) {
  if (typeof valor !== "number") {
    return (
      <span className={className}>
        <Dato>{valor}</Dato>
      </span>
    );
  }
  return (
    <PrecioAnimado
      hasta={valor}
      desde={typeof desde === "number" ? desde : undefined}
      moneda={moneda}
      className={className}
    />
  );
}

export function Componente({ seccion }: { seccion: Seccion; tokens: Tokens }) {
  const datos = leerSeccion<z.infer<typeof schema>>(seccion);
  if (!datos) return <SeccionInvalida tipo="oferta" />;

  const { ajustes, bloques } = datos;
  const conImagen = seccion.variante === "con-imagen" ? ajustes.imagen : undefined;
  const ahorro = calcularAhorro(ajustes.precio, ajustes.precioAnterior, ajustes.moneda);

  return (
    <SeccionConImagen slot={conImagen} modo="lado">
      <div className="borde-token mx-auto max-w-xl rounded-tarjeta bg-superficie p-6 text-center md:p-10">
        <Titular className="text-balance font-titulos text-h2 font-semibold tracking-tight">
          {ajustes.titulo}
        </Titular>

        <p className="mt-6 flex flex-wrap items-baseline justify-center gap-x-4 gap-y-1">
          <Precio
            valor={ajustes.precio}
            desde={ajustes.precioAnterior}
            moneda={ajustes.moneda}
            className="font-titulos text-[calc(clamp(2.5rem,10vw,4rem)*var(--escala-t,var(--escala)))] font-bold leading-none"
          />
          {ajustes.precioAnterior !== undefined && (
            <span className="text-lead text-suave line-through decoration-2">
              <span className="sr-only">Precio anterior: </span>
              {typeof ajustes.precioAnterior === "number" ? (
                formatearDinero(ajustes.precioAnterior, ajustes.moneda)
              ) : (
                <Dato>{ajustes.precioAnterior}</Dato>
              )}
            </span>
          )}
        </p>
        {ahorro && (
          <p data-ahorro className="mt-3 font-medium text-acento">
            {ahorro}
          </p>
        )}

        <ul className="mt-8 flex flex-col gap-3 text-left">
          {bloques.map((bloque) => {
            const { unidades, precio, etiqueta } = bloque.ajustes;
            return (
              <li
                key={bloque.id}
                className={`flex items-center justify-between gap-4 rounded-token bg-fondo px-4 py-3 ${
                  etiqueta ? "border-2 border-acento" : "borde-token"
                }`}
              >
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="whitespace-nowrap font-medium">{unidades === 1 ? "1 unidad" : `${unidades} unidades`}</span>
                  {etiqueta && (
                    <span className="whitespace-nowrap rounded-full bg-acento px-2.5 py-0.5 text-xs font-medium text-acento-texto">
                      {etiqueta}
                    </span>
                  )}
                </span>
                <span className="shrink-0 font-medium">
                  {typeof precio === "number" ? formatearDinero(precio, ajustes.moneda) : <Dato>{precio}</Dato>}
                </span>
              </li>
            );
          })}
        </ul>

        <div className="mt-8">
          <Boton texto={ajustes.textoBoton ?? "Quiero aprovecharlo"} />
        </div>
      </div>
    </SeccionConImagen>
  );
}
