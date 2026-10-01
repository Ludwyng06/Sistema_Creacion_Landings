"use client";

import type { Seccion, Tokens } from "@/lib/contratos";
import { SeccionInvalida } from "@/componentes/SeccionInvalida";
import { Marquee } from "@/efectos/Marquee";
import { leerSeccion } from "../leer";
import type { schema } from "./schema";
import type { z } from "zod";

export function Componente({ seccion }: { seccion: Seccion; tokens: Tokens }) {
  const datos = leerSeccion<z.infer<typeof schema>>(seccion);
  if (!datos) return <SeccionInvalida tipo="cinta-anuncio" />;

  const { ajustes } = datos;
  const estilo =
    ajustes.estilo === "solido"
      ? "bg-acento text-acento-texto"
      : "border-y-2 border-texto bg-fondo text-texto";

  return (
    <section aria-label="Anuncios" className={`py-3 text-sm font-medium uppercase tracking-[0.14em] ${estilo}`}>
      <Marquee textos={ajustes.textos} velocidad={ajustes.velocidad} />
    </section>
  );
}
