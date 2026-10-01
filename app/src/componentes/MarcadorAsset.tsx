"use client";

import { useEffect, useRef, useState } from "react";
import type { Asset } from "@/lib/contratos";
import { useLanding } from "./contexto-landing";

export type Relacion = Asset["relacion"];

type Props = {
  slot: string;
  relacion: Relacion;
  /** Se conserva por compatibilidad con los documentos guardados; ya no se muestra. */
  promptGrok?: string;
  tipo?: Asset["tipo"];
  /** Rellena el contenedor padre en vez de usar la relación de aspecto. */
  llenar?: boolean;
  /** Fuerza el modo compacto; además se activa solo cuando el contenedor es pequeño. */
  compacto?: boolean;
  className?: string;
};

type Tamano = "normal" | "compacto" | "minimo";

// Umbrales (px) del modo compacto automático.
const ANCHO_COMPACTO = 230;
const ALTO_COMPACTO = 200;
const ANCHO_MINIMO = 150;

function tamanoPara(ancho: number, alto: number): Tamano {
  if (ancho > 0 && ancho < ANCHO_MINIMO) return "minimo";
  if ((ancho > 0 && ancho < ANCHO_COMPACTO) || (alto > 0 && alto < ALTO_COMPACTO)) return "compacto";
  return "normal";
}

/** Placeholder de una imagen que todavía no llega. En el editor ofrece «Buscar en bancos»; en la página pública no muestra botones. */
export function MarcadorAsset({
  slot,
  relacion,
  tipo = "imagen",
  llenar = false,
  compacto = false,
  className = "",
}: Props) {
  const [medido, setMedido] = useState<Tamano>("normal");
  const raiz = useRef<HTMLDivElement>(null);
  const { onBuscarBancos } = useLanding();

  // Modo compacto automático según el tamaño real del recuadro.
  useEffect(() => {
    const elemento = raiz.current;
    if (!elemento || typeof ResizeObserver === "undefined") return;
    const observador = new ResizeObserver(([entrada]) => {
      const { width, height } = entrada.contentRect;
      setMedido(tamanoPara(width, height));
    });
    observador.observe(elemento);
    return () => observador.disconnect();
  }, []);

  const tamano: Tamano = medido === "minimo" ? "minimo" : compacto ? "compacto" : medido;
  const reducido = tamano !== "normal";
  const etiquetaBoton = tamano === "minimo" ? "Buscar" : "Buscar en bancos";

  return (
    <div
      ref={raiz}
      data-marcador-slot={slot}
      data-tamano={tamano}
      style={llenar ? undefined : { aspectRatio: relacion.replace(":", " / ") }}
      className={`flex w-full min-w-0 flex-col items-center justify-center overflow-hidden text-center text-suave ${
        reducido ? "gap-1 p-2" : "gap-2 p-4"
      } ${llenar ? "h-full rounded-none" : "rounded-tarjeta"} border-2 border-dashed border-suave bg-superficie ${className}`}
    >
      {!reducido && (
        <span className="text-xs uppercase tracking-[0.2em]">
          {tipo === "video" ? "Video pendiente" : "Imagen pendiente"}
        </span>
      )}
      <code
        title={slot}
        className={`block max-w-full truncate font-mono text-texto ${reducido ? "text-[0.7rem]" : "text-sm"}`}
      >
        {slot}
      </code>
      {!reducido && <span className="text-xs">Relación {relacion}</span>}
      {onBuscarBancos && (
        <button
          type="button"
          onClick={() => onBuscarBancos(slot)}
          aria-label="Buscar en bancos"
          className={`inline-flex min-h-11 max-w-full items-center justify-center rounded-token border-2 border-texto font-medium text-texto transition-colors hover:bg-texto hover:text-fondo ${
            reducido ? "px-2 text-xs" : "mt-1 px-4 text-sm"
          }`}
        >
          {etiquetaBoton}
        </button>
      )}
    </div>
  );
}
