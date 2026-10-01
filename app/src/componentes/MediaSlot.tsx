"use client";

import Image from "next/image";
import { useState } from "react";
import { MascaraMedia } from "@/efectos/MascaraMedia";
import { useMovimiento } from "@/efectos/movimiento";
import { useAsset, useLanding } from "./contexto-landing";
import { MarcadorAsset, type Relacion } from "./MarcadorAsset";

type Props = {
  slot?: string;
  /** Slot que se muestra en el marcador cuando la sección no eligió uno. */
  slotPorDefecto: string;
  relacion: Relacion;
  /** Tipo esperado si el slot todavía no existe en `doc.assets`. */
  tipo?: "imagen" | "video";
  /** Rellena el contenedor padre (sin relación de aspecto propia). */
  llenar?: boolean;
  /** Slot de imagen que hace de póster cuando el recurso es un video. */
  posterSlot?: string;
  /** Solo video: si es `false` no arranca solo y muestra controles. */
  autoplay?: boolean;
  /** Marcador reducido para celdas pequeñas. */
  compacto?: boolean;
  className?: string;
  /** Héroe: carga inmediata con `fetchpriority="high"`. El resto va con `loading="lazy"`. */
  prioridad?: boolean;
  /** Atributo `sizes` de la imagen (por defecto 40rem en escritorio y todo el ancho en móvil): el navegador elige del `srcset`. */
  sizes?: string;
};

/** Resuelve un slot: archivo real si `asset.ruta` existe; si no, el marcador con su prompt. */
export function MediaSlot({
  slot,
  slotPorDefecto,
  relacion,
  tipo,
  llenar = false,
  posterSlot,
  autoplay = true,
  compacto = false,
  className = "",
  prioridad = false,
  sizes = "(min-width: 1024px) 40rem, 100vw",
}: Props) {
  const nombre = slot ?? slotPorDefecto;
  const asset = useAsset(nombre);
  const foco = useLanding().focos?.[nombre];
  const poster = useAsset(posterSlot ?? `${nombre}-poster`);
  const { reducido } = useMovimiento();
  const relacionFinal = asset?.relacion ?? relacion;
  const tipoFinal = asset?.tipo ?? tipo ?? "imagen";
  const forma = llenar ? "h-full" : "";
  // Si el archivo no carga (se borró, el banco lo quitó, sin red), se ve el marcador y no el icono roto con el texto alternativo.
  // Se recuerda la ruta que falló: si la persona elige otra imagen, vuelve a intentarse.
  const [rutaRota, setRutaRota] = useState<string | null>(null);
  const fallo = () => setRutaRota(asset?.ruta ?? null);

  let contenido;
  if (asset?.ruta && rutaRota !== asset.ruta) {
    contenido = (
      <div
        className={`media-slot relative w-full overflow-hidden ${llenar ? "h-full" : "rounded-tarjeta"} ${className}`}
        style={llenar ? undefined : { aspectRatio: relacionFinal.replace(":", " / ") }}
      >
        {asset.tipo === "video" ? (
          <video
            src={asset.ruta}
            poster={poster?.ruta}
            aria-label={asset.alt}
            className="h-full w-full object-cover"
            style={foco ? { objectPosition: foco } : undefined}
            autoPlay={autoplay && !reducido}
            controls={!autoplay}
            muted
            loop
            playsInline
            onError={fallo}
          />
        ) : (
          <Image
            src={asset.ruta}
            alt={asset.alt}
            fill
            sizes={sizes}
            className="object-cover"
            style={foco ? { objectPosition: foco } : undefined}
            loading={prioridad ? "eager" : "lazy"}
            fetchPriority={prioridad ? "high" : undefined}
            onError={fallo}
          />
        )}
      </div>
    );
  } else {
    contenido = (
      <MarcadorAsset
        slot={nombre}
        relacion={relacionFinal}
        tipo={tipoFinal}
        promptGrok={asset?.promptGrok}
        llenar={llenar}
        compacto={compacto}
        className={className}
      />
    );
  }

  return (
    <MascaraMedia className={forma}>
      <div data-cursor="Ver" className={forma}>
        {contenido}
      </div>
    </MascaraMedia>
  );
}
