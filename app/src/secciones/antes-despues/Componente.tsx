"use client";

import type { Seccion, Tokens } from "@/lib/contratos";
import { Comparador } from "@/componentes/Comparador";
import { SeccionInvalida } from "@/componentes/SeccionInvalida";
import { Titular } from "@/componentes/Titular";
import { leerSeccion } from "../leer";
import type { schema } from "./schema";
import type { z } from "zod";

export function Componente({ seccion }: { seccion: Seccion; tokens: Tokens }) {
  const datos = leerSeccion<z.infer<typeof schema>>(seccion);
  if (!datos) return <SeccionInvalida tipo="antes-despues" />;

  const { ajustes } = datos;

  return (
    <section className="px-5 py-espacio">
      <div className="mx-auto max-w-3xl">
        <Titular className="text-balance text-center font-titulos text-h2 font-semibold tracking-tight">
          {ajustes.titulo}
        </Titular>
        <div className="mt-10">
          <Comparador
            slotAntes={ajustes.imagenAntes}
            slotDespues={ajustes.imagenDespues}
            etiquetaAntes={ajustes.etiquetaAntes}
            etiquetaDespues={ajustes.etiquetaDespues}
            anchoSlider="max-w-xl"
            nombre={`${ajustes.titulo}: comparar ${ajustes.etiquetaAntes} y ${ajustes.etiquetaDespues}`}
          />
        </div>
      </div>
    </section>
  );
}
