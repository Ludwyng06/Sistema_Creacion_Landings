"use client";

import type { z } from "zod";
import type { Seccion, Tokens } from "@/lib/contratos";
import { CreditoCorto } from "@/componentes/CreditoCorto";
import { Dato } from "@/componentes/Dato";
import { MediaSlot } from "@/componentes/MediaSlot";
import { SeccionInvalida } from "@/componentes/SeccionInvalida";
import { Titular } from "@/componentes/Titular";
import { leerSeccion } from "../leer";
import { varianteDe } from "../variantes";
import type { BloquePersona, schema } from "./schema";

type Persona = BloquePersona["ajustes"];

function Foto({ persona, relacion }: { persona: Persona; relacion: "1:1" | "4:5" }) {
  if (!persona.imagen) return null;
  return (
    <div>
      <MediaSlot slot={persona.imagen} slotPorDefecto={persona.imagen} relacion={relacion} />
      <CreditoCorto slot={persona.imagen} className="mt-1" />
    </div>
  );
}

export function Componente({ seccion }: { seccion: Seccion; tokens: Tokens }) {
  const datos = leerSeccion<z.infer<typeof schema>>(seccion);
  if (!datos) return <SeccionInvalida tipo="ponentes" />;
  const { ajustes, bloques } = datos;
  const variante = varianteDe("ponentes", seccion.variante);
  const personas = bloques.map((b) => ({ id: b.id, ...b.ajustes }));

  if (variante === "destacado") {
    const p = personas[0];
    return (
      <section className="px-5 py-espacio" data-variante={variante}>
        <div className="mx-auto flex max-w-4xl flex-col gap-8 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] md:items-center">
          <Foto persona={p} relacion="4:5" />
          <div>
            <Titular className="text-balance font-titulos text-h2 font-semibold tracking-tight">{ajustes.titulo}</Titular>
            <p className="mt-5 font-titulos text-2xl font-semibold">
              <Dato>{p.nombre}</Dato>
            </p>
            <p className="text-acento">{p.rol}</p>
            {p.texto && <p className="mt-3 text-pretty text-lead text-suave">{p.texto}</p>}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="px-5 py-espacio" data-variante={variante}>
      <div className="mx-auto max-w-5xl">
        <Titular className="text-balance font-titulos text-h2 font-semibold tracking-tight">{ajustes.titulo}</Titular>
        <ul className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3">
          {personas.map((p) => (
            <li key={p.id} className="borde-token rounded-tarjeta bg-superficie p-4">
              <Foto persona={p} relacion="1:1" />
              <p className="mt-3 font-titulos text-lg font-semibold">
                <Dato>{p.nombre}</Dato>
              </p>
              <p className="text-sm text-acento">{p.rol}</p>
              {p.texto && <p className="mt-2 text-sm text-suave">{p.texto}</p>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
