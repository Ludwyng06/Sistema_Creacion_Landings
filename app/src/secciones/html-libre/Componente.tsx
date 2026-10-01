"use client";

import type { Seccion, Tokens } from "@/lib/contratos";
import { SeccionInvalida } from "@/componentes/SeccionInvalida";
import { leerSeccion } from "../leer";
import { sanitizarHtml } from "./sanitizar";
import type { schema } from "./schema";
import type { z } from "zod";

export function Componente({ seccion }: { seccion: Seccion; tokens: Tokens }) {
  const datos = leerSeccion<z.infer<typeof schema>>(seccion);
  if (!datos) return <SeccionInvalida tipo="html-libre" />;

  return (
    <section className="px-5 py-espacio">
      <div
        data-html-libre
        className="mx-auto max-w-2xl text-pretty [&_a]:text-acento [&_a]:underline [&_h1]:font-titulos [&_h1]:text-h1 [&_h2]:font-titulos [&_h2]:text-h2 [&_h2]:font-semibold [&_h3]:font-titulos [&_h3]:text-lead [&_h3]:font-semibold [&_img]:h-auto [&_img]:max-w-full [&_li]:ml-5 [&_li]:list-disc [&_p+p]:mt-4 [&_ul]:mt-4"
        // El HTML pasa por DOMPurify (sanitizarHtml) antes de llegar aquí.
        dangerouslySetInnerHTML={{ __html: sanitizarHtml(datos.ajustes.html) }}
      />
    </section>
  );
}
