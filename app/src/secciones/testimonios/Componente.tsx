"use client";

import type { Seccion, Tokens } from "@/lib/contratos";
import { Dato } from "@/componentes/Dato";
import { Icono } from "@/componentes/Icono";
import { MediaSlot } from "@/componentes/MediaSlot";
import { SeccionInvalida } from "@/componentes/SeccionInvalida";
import { Titular } from "@/componentes/Titular";
import { leerSeccion } from "../leer";
import type { BloqueTestimonio } from "./schema";
import type { schema } from "./schema";
import type { z } from "zod";

type Testimonio = BloqueTestimonio["ajustes"];

function Estrellas({ valor }: { valor: Testimonio["estrellas"] }) {
  if (typeof valor !== "number") {
    return (
      <p className="text-sm">
        <Dato>{valor}</Dato>
      </p>
    );
  }
  return (
    <p role="img" aria-label={`${valor} de 5 estrellas`} className="flex gap-0.5 text-acento">
      {Array.from({ length: 5 }, (_, i) => (
        <Icono key={i} nombre="estrella" className={`size-4 ${i < valor ? "fill-current" : "opacity-30"}`} />
      ))}
    </p>
  );
}

function Tarjeta({ t, grande = false }: { t: Testimonio; grande?: boolean }) {
  return (
    <figure className="borde-token rounded-tarjeta bg-superficie p-6">
      <Estrellas valor={t.estrellas} />
      <blockquote
        className={`mt-4 text-pretty ${grande ? "font-titulos text-[calc(1.5rem*var(--escala-t,var(--escala)))] leading-snug" : "text-cuerpo"}`}
      >
        <Dato>{t.texto}</Dato>
      </blockquote>
      <figcaption className="mt-5 flex items-center gap-3 text-sm text-suave">
        {t.foto && (
          <span className="block w-12 shrink-0 overflow-hidden rounded-full">
            <MediaSlot slot={t.foto} slotPorDefecto={t.foto} relacion="1:1" compacto />
          </span>
        )}
        <span>
          <cite className="font-medium not-italic text-texto">
            <Dato>{t.nombre}</Dato>
          </cite>
          <span aria-hidden="true"> · </span>
          <Dato>{t.ciudad}</Dato>
        </span>
      </figcaption>
    </figure>
  );
}

export function Componente({ seccion }: { seccion: Seccion; tokens: Tokens }) {
  const datos = leerSeccion<z.infer<typeof schema>>(seccion);
  if (!datos) return <SeccionInvalida tipo="testimonios" />;

  const { ajustes, bloques } = datos;
  const items = bloques.map((bloque) => ({ id: bloque.id, t: bloque.ajustes }));

  return (
    <section className="px-5 py-espacio">
      <div className="mx-auto max-w-5xl">
        <Titular className="max-w-2xl text-balance font-titulos text-h2 font-semibold tracking-tight">
          {ajustes.titulo}
        </Titular>

        {ajustes.disposicion === "muro" && (
          <ul className="mt-10 gap-4 md:columns-2">
            {items.map(({ id, t }) => (
              <li key={id} className="mb-4 break-inside-avoid">
                <Tarjeta t={t} />
              </li>
            ))}
          </ul>
        )}

        {ajustes.disposicion === "carrusel" && (
          <ul
            role="region"
            aria-label={ajustes.titulo}
            tabIndex={0}
            className="-mx-5 mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento"
          >
            {items.map(({ id, t }) => (
              <li key={id} className="w-[86%] shrink-0 snap-start md:w-96">
                <Tarjeta t={t} />
              </li>
            ))}
          </ul>
        )}

        {ajustes.disposicion === "destacado" && (
          <div className="mt-10 flex flex-col gap-4">
            <Tarjeta t={items[0].t} grande />
            <ul className="grid gap-4 md:grid-cols-2">
              {items.slice(1).map(({ id, t }) => (
                <li key={id}>
                  <Tarjeta t={t} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
