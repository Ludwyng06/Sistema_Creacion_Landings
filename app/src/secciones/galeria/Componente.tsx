"use client";

import type { Seccion, Tokens } from "@/lib/contratos";
import { CreditoCorto } from "@/componentes/CreditoCorto";
import type { Relacion } from "@/componentes/MarcadorAsset";
import { MediaSlot } from "@/componentes/MediaSlot";
import { SeccionInvalida } from "@/componentes/SeccionInvalida";
import { Titular } from "@/componentes/Titular";
import { leerSeccion } from "../leer";
import { CarruselDeslizante } from "./CarruselDeslizante";
import type { BloqueImagen } from "./schema";
import type { schema } from "./schema";
import type { z } from "zod";

type Imagen = BloqueImagen["ajustes"];

function Foto({ imagen, relacion }: { imagen: Imagen; relacion: Relacion }) {
  return (
    <figure>
      <MediaSlot slot={imagen.slot} slotPorDefecto={imagen.slot} relacion={relacion} />
      {imagen.pie && <figcaption className="mt-2 text-sm text-suave">{imagen.pie}</figcaption>}
      <CreditoCorto slot={imagen.slot} className="mt-1" />
    </figure>
  );
}

const PISTA =
  "-mx-5 mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento";

export function Componente({ seccion }: { seccion: Seccion; tokens: Tokens }) {
  const datos = leerSeccion<z.infer<typeof schema>>(seccion);
  if (!datos) return <SeccionInvalida tipo="galeria" />;

  const { ajustes, bloques } = datos;
  const imagenes = bloques.map((bloque) => bloque.ajustes);

  return (
    <section className="px-5 py-espacio">
      <div className="mx-auto max-w-5xl">
        <Titular className="max-w-2xl text-balance font-titulos text-h2 font-semibold tracking-tight">
          {ajustes.titulo}
        </Titular>

        {ajustes.disposicion === "mosaico" && (
          <ul className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
            {imagenes.map((imagen) => (
              <li key={imagen.slot}>
                <Foto imagen={imagen} relacion="4:5" />
              </li>
            ))}
          </ul>
        )}

        {ajustes.disposicion === "carrusel" && (
          <ul role="region" aria-label={ajustes.titulo} tabIndex={0} className={PISTA}>
            {imagenes.map((imagen) => (
              <li key={imagen.slot} className="w-[78%] shrink-0 snap-start md:w-80">
                <Foto imagen={imagen} relacion="4:5" />
              </li>
            ))}
          </ul>
        )}

        {ajustes.disposicion === "carrusel-deslizante" && <CarruselDeslizante titulo={ajustes.titulo} imagenes={imagenes} />}

        {ajustes.disposicion === "historias" && (
          <ul role="region" aria-label={ajustes.titulo} tabIndex={0} className={PISTA}>
            {imagenes.map((imagen) => (
              <li key={imagen.slot} className="w-[46%] shrink-0 snap-start md:w-56">
                <Foto imagen={imagen} relacion="9:16" />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
