"use client";

import type { Seccion, Tokens } from "@/lib/contratos";
import { SeccionInvalida } from "@/componentes/SeccionInvalida";
import { leerSeccion } from "../leer";
import type { schema } from "./schema";
import type { z } from "zod";
import {
  AntesDespuesHeroe,
  MosaicoEditorial,
  OrbitaBeneficios,
  PosterASangre,
  ProblemaPrimero,
  ProductoMonumental,
  TitularTipografico,
  VideoInmersivo,
} from "./variantes";

export function Componente({ seccion }: { seccion: Seccion; tokens: Tokens }) {
  const datos = leerSeccion<z.infer<typeof schema>>(seccion);
  if (!datos) return <SeccionInvalida tipo="heroe" />;

  switch (seccion.variante) {
    case "poster-a-sangre":
      return <PosterASangre {...datos} />;
    case "titular-tipografico":
      return <TitularTipografico {...datos} />;
    case "problema-primero":
      return <ProblemaPrimero {...datos} />;
    case "antes-despues-heroe":
      return <AntesDespuesHeroe {...datos} />;
    case "video-inmersivo":
      return <VideoInmersivo {...datos} />;
    case "orbita-beneficios":
      return <OrbitaBeneficios {...datos} />;
    case "mosaico-editorial":
      return <MosaicoEditorial {...datos} />;
    default:
      return <ProductoMonumental {...datos} />;
  }
}
