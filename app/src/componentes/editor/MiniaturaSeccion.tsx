"use client";

import { useRef } from "react";
import type { Asset, LandingDoc, Seccion } from "@/lib/contratos";
import { LandingRender } from "@/componentes/LandingRender";
import { useEnVista } from "@/efectos/movimiento";

/** Ancho de página con el que se pinta la sección antes de reducirla: parecido a una ventana chica de escritorio. */
const ANCHO_VIRTUAL = 1000;

interface Props {
  /** Documento del que se toman los tokens y el meta (la miniatura se ve con el tema de la landing). */
  doc: LandingDoc;
  seccion: Seccion;
  /** Assets del ejemplo (los marcadores de imagen); se suman a los del documento. */
  assets?: Asset[];
  ancho: number;
  alto: number;
  etiqueta: string;
}

/**
 * Miniatura de una variante: la sección de `ejemplo.ts` renderizada con el mismo `LandingRender` de producción y
 * reducida con `transform: scale`. Se pinta al entrar en pantalla (un modal con 40 variantes no puede montarlas todas)
 * y sin efectos, sin red y sin interacción.
 */
export function MiniaturaSeccion({ doc, seccion, assets = [], ancho, alto, etiqueta }: Props) {
  const caja = useRef<HTMLDivElement>(null);
  const visible = useEnVista(caja);
  const escala = ancho / ANCHO_VIRTUAL;
  const docMini: LandingDoc = {
    ...doc,
    secciones: [{ ...seccion, visible: true, efectos: [], animacion: undefined }],
    assets: [...assets, ...doc.assets.filter((a) => !assets.some((x) => x.slot === a.slot))],
  };

  return (
    <div ref={caja} role="img" aria-label={etiqueta} data-miniatura style={{ width: ancho, height: alto }} className="relative shrink-0 overflow-hidden rounded-md border border-linea bg-papel-hondo">
      {visible && (
        <div inert aria-hidden="true" style={{ width: ANCHO_VIRTUAL, transform: `scale(${escala})`, transformOrigin: "top left", pointerEvents: "none" }}>
          <LandingRender doc={docMini} vistaPrevia reducirMovimiento />
        </div>
      )}
    </div>
  );
}
