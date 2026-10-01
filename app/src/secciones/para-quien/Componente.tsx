"use client";

import type { z } from "zod";
import type { Seccion, Tokens } from "@/lib/contratos";
import { Icono } from "@/componentes/Icono";
import { MediaSlot } from "@/componentes/MediaSlot";
import { SeccionInvalida } from "@/componentes/SeccionInvalida";
import { Titular } from "@/componentes/Titular";
import { leerSeccion } from "../leer";
import { varianteDe } from "../variantes";
import type { BloquePunto, schema } from "./schema";

function Lista({ items, icono, clase }: { items: BloquePunto[]; icono: string; clase: string }) {
  return (
    <ul className="flex flex-col gap-3">
      {items.map((b) => (
        <li key={b.id} className="flex items-start gap-3">
          <Icono nombre={icono} className={`mt-0.5 size-6 shrink-0 ${clase}`} />
          <span>{b.ajustes.texto}</span>
        </li>
      ))}
    </ul>
  );
}

export function Componente({ seccion }: { seccion: Seccion; tokens: Tokens }) {
  const datos = leerSeccion<z.infer<typeof schema>>(seccion);
  if (!datos) return <SeccionInvalida tipo="para-quien" />;
  const { ajustes, bloques } = datos;
  const variante = varianteDe("para-quien", seccion.variante);
  const si = bloques.filter((b) => b.ajustes.aplica);
  const no = bloques.filter((b) => !b.ajustes.aplica);

  return (
    <section className="px-5 py-espacio" data-variante={variante}>
      <div className="mx-auto max-w-4xl">
        <Titular className="text-balance font-titulos text-h2 font-semibold tracking-tight">{ajustes.titulo}</Titular>
        {variante === "lista-check" ? (
          <div className="mt-8 flex flex-col gap-8 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] md:items-center">
            <div className="flex flex-col gap-6">
              <Lista items={si} icono="check" clase="text-acento" />
              {no.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-medium text-suave">No es para ti si…</p>
                  <Lista items={no} icono="cerrar" clase="text-suave" />
                </div>
              )}
            </div>
            {ajustes.imagen && <MediaSlot slot={ajustes.imagen} slotPorDefecto={ajustes.imagen} relacion="4:5" />}
          </div>
        ) : (
          <div className="mt-8 flex flex-col gap-6">
            {ajustes.imagen && (
              <div className="mx-auto w-full max-w-md">
                <MediaSlot slot={ajustes.imagen} slotPorDefecto={ajustes.imagen} relacion="16:9" />
              </div>
            )}
            <div className="flex flex-col gap-4 md:grid md:grid-cols-2 md:gap-6">
              <div className="borde-token rounded-tarjeta bg-superficie p-5" data-perfil="si">
                <h3 className="mb-3 font-titulos text-lg font-semibold">Es para ti</h3>
                <Lista items={si} icono="check" clase="text-acento" />
              </div>
              <div className="borde-token rounded-tarjeta p-5" data-perfil="no">
                <h3 className="mb-3 font-titulos text-lg font-semibold">No es para ti</h3>
                {no.length > 0 ? <Lista items={no} icono="cerrar" clase="text-suave" /> : <p className="text-suave">Si llegaste hasta aquí, es para ti.</p>}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
