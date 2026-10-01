"use client";

import type { z } from "zod";
import type { Seccion, Tokens } from "@/lib/contratos";
import { useLanding } from "@/componentes/contexto-landing";
import { SeccionInvalida } from "@/componentes/SeccionInvalida";
import { leerSeccion } from "../leer";
import { varianteDe } from "../variantes";
import { lineasDeCredito, usaImagenesNasa } from "./armar";
import type { schema } from "./schema";

const ENLACE = "underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento";

export function Componente({ seccion }: { seccion: Seccion; tokens: Tokens }) {
  const datos = leerSeccion<z.infer<typeof schema>>(seccion);
  const { assets } = useLanding();
  if (!datos) return <SeccionInvalida tipo="creditos" />;

  // Sin imágenes con crédito y licencia no hay nada que mostrar.
  const lineas = lineasDeCredito(assets);
  if (lineas.length === 0) return null;

  const variante = varianteDe("creditos", seccion.variante);
  const aviso = usaImagenesNasa(assets) ? "Las imágenes de la NASA son de dominio público. Este producto no está afiliado a la NASA ni cuenta con su respaldo." : null;

  return (
    <section aria-label={datos.ajustes.titulo} className="border-t border-borde px-5 py-8 text-sm text-suave" data-variante={variante}>
      <div className="mx-auto max-w-3xl">
        <h2 className="font-medium text-texto">{datos.ajustes.titulo}</h2>
        {variante === "compacta" ? (
          <p className="mt-2">
            {lineas.map((linea, i) => (
              <span key={`${linea.credito}|${linea.licencia}`}>
                {i > 0 && " · "}
                {linea.urlOrigen ? (
                  <a href={linea.urlOrigen} target="_blank" rel="noopener noreferrer" className={ENLACE}>
                    {linea.credito}
                  </a>
                ) : (
                  linea.credito
                )}{" "}
                ({linea.licencia})
              </span>
            ))}
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {lineas.map((linea) => (
              <li key={`${linea.credito}|${linea.licencia}`}>
                {linea.urlOrigen ? (
                  <a href={linea.urlOrigen} target="_blank" rel="noopener noreferrer" className={ENLACE}>
                    {linea.credito}
                  </a>
                ) : (
                  linea.credito
                )}
                <span> · {linea.licencia}</span>
                {linea.slots.length > 1 && <span> · {linea.slots.length} imágenes</span>}
              </li>
            ))}
          </ul>
        )}
        {aviso && <p className="mt-3">{aviso}</p>}
      </div>
    </section>
  );
}
