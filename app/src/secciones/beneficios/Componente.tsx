"use client";

import type { Seccion, Tokens } from "@/lib/contratos";
import { Icono } from "@/componentes/Icono";
import { MediaSlot } from "@/componentes/MediaSlot";
import { SeccionInvalida } from "@/componentes/SeccionInvalida";
import { Titular } from "@/componentes/Titular";
import { leerSeccion } from "../leer";
import type { BloqueBeneficio } from "./schema";
import type { schema } from "./schema";
import type { z } from "zod";

type Item = BloqueBeneficio["ajustes"];

function Imagen({ item }: { item: Item }) {
  if (!item.imagen) return null;
  return (
    <div className="mt-4 w-full max-w-64">
      <MediaSlot slot={item.imagen} slotPorDefecto={item.imagen} relacion="4:5" />
    </div>
  );
}

function Medallon({ nombre }: { nombre: string }) {
  return (
    <span className="grid size-12 shrink-0 place-items-center rounded-token bg-acento text-acento-texto">
      <Icono nombre={nombre} />
    </span>
  );
}

const titulo = "font-titulos text-[calc(1.375rem*var(--escala-t,var(--escala)))] font-semibold leading-tight";

function ListaGrande({ items }: { items: Item[] }) {
  return (
    <ul className="mt-10 divide-y divide-borde border-y border-borde">
      {items.map((item) => (
        <li
          key={item.titulo}
          className="grid grid-cols-[auto_1fr] items-start gap-x-5 gap-y-2 py-7 md:grid-cols-[auto_minmax(0,1fr)_minmax(0,1.2fr)] md:items-center md:gap-x-8"
        >
          <Medallon nombre={item.icono} />
          <h3 className={titulo}>{item.titulo}</h3>
          <div className="col-start-2 md:col-start-3">
            <p className="text-suave">{item.texto}</p>
            <Imagen item={item} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function TarjetasApiladas({ items }: { items: Item[] }) {
  return (
    <ul className="mx-auto mt-10 flex max-w-2xl flex-col gap-4">
      {items.map((item) => (
        <li key={item.titulo} className="borde-token rounded-tarjeta bg-superficie p-6">
          <div className="flex items-center gap-4">
            <Medallon nombre={item.icono} />
            <h3 className={titulo}>{item.titulo}</h3>
          </div>
          <p className="mt-4 text-suave">{item.texto}</p>
          <Imagen item={item} />
        </li>
      ))}
    </ul>
  );
}

function Numerada({ items }: { items: Item[] }) {
  return (
    <ol className="mt-10 flex flex-col gap-10">
      {items.map((item, indice) => (
        <li key={item.titulo} className="grid grid-cols-[auto_1fr] gap-x-6 md:gap-x-10">
          <span
            aria-hidden="true"
            className="font-titulos text-[calc(clamp(3rem,10vw,5rem)*var(--escala-t,var(--escala)))] font-bold leading-none text-acento"
          >
            {String(indice + 1).padStart(2, "0")}
          </span>
          <div className="border-t border-borde pt-4">
            <h3 className={titulo}>{item.titulo}</h3>
            <p className="mt-2 max-w-xl text-suave">{item.texto}</p>
            <Imagen item={item} />
          </div>
        </li>
      ))}
    </ol>
  );
}

function Carrusel({ items, etiqueta }: { items: Item[]; etiqueta: string }) {
  return (
    <ul
      role="region"
      aria-label={etiqueta}
      tabIndex={0}
      className="-mx-5 mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento"
    >
      {items.map((item) => (
        <li
          key={item.titulo}
          className="borde-token w-[82%] shrink-0 snap-start rounded-tarjeta bg-superficie p-6 md:w-88"
        >
          <Medallon nombre={item.icono} />
          <h3 className={`${titulo} mt-5`}>{item.titulo}</h3>
          <p className="mt-2 text-suave">{item.texto}</p>
          <Imagen item={item} />
        </li>
      ))}
    </ul>
  );
}

/** Una fila por beneficio con su foto, alternando el lado en escritorio; en móvil la foto va arriba. */
function ImagenAlterna({ items }: { items: Item[] }) {
  return (
    <ul className="mt-10 flex flex-col gap-10">
      {items.map((item, i) => (
        <li key={item.titulo} className="flex flex-col gap-5 md:grid md:grid-cols-2 md:items-center md:gap-10" data-fila-imagen>
          <div className={i % 2 === 1 ? "md:order-2" : ""}>
            {item.imagen ? <MediaSlot slot={item.imagen} slotPorDefecto={item.imagen} relacion="4:5" /> : null}
          </div>
          <div>
            <Medallon nombre={item.icono} />
            <h3 className={`${titulo} mt-4`}>{item.titulo}</h3>
            <p className="mt-2 text-suave">{item.texto}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Componente({ seccion }: { seccion: Seccion; tokens: Tokens }) {
  const datos = leerSeccion<z.infer<typeof schema>>(seccion);
  if (!datos) return <SeccionInvalida tipo="beneficios" />;

  const { ajustes, bloques } = datos;
  const items = bloques.map((bloque) => bloque.ajustes);

  return (
    <section className="px-5 py-espacio">
      <div className="mx-auto max-w-4xl">
        <Titular className="max-w-2xl text-balance font-titulos text-h2 font-semibold tracking-tight">{ajustes.titulo}</Titular>
        {ajustes.disposicion === "lista-grande" && <ListaGrande items={items} />}
        {ajustes.disposicion === "tarjetas-apiladas" && <TarjetasApiladas items={items} />}
        {ajustes.disposicion === "numerada" && <Numerada items={items} />}
        {ajustes.disposicion === "imagen-alterna" && <ImagenAlterna items={items} />}
        {ajustes.disposicion === "carrusel" && <Carrusel items={items} etiqueta={ajustes.titulo} />}
      </div>
    </section>
  );
}
