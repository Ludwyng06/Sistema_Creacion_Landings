"use client";

import { useMemo, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { VideoScroll } from "../VideoScroll";
import type { RutasVideo } from "../video-scroll/fuente";
import { Fijado } from "./Fijado";

/** Rutas de un clip subido a la landing: los fotogramas (`npm run fotogramas`) viven junto al mp4 como `<nombre>-frames/`. */
export function rutasDeClip(src: string, poster: string | null): RutasVideo {
  return { fotogramas: src.replace(/\.[^./]+$/, "") + "-frames", video: src, poster: poster ?? "" };
}

interface Destino {
  contenedor: HTMLElement;
  rutas: RutasVideo;
  progreso: RefObject<number>;
}

/**
 * `video-scroll` en las landings (héroes `video-inmersivo` y `producto-monumental` con secuencia de rotación, y la sección
 * `video`): fija la sección y el scroll recorre el clip hacia delante y hacia atrás. Reutiliza `<VideoScroll>` del home,
 * que dibuja los fotogramas en un canvas y cae al `<video>` con `currentTime` si no existen.
 */
export function VideoScrollFijado({ children }: { children: ReactNode }) {
  const [destino, setDestino] = useState<Destino | null>(null);
  const rutas = useMemo(() => (destino ? () => destino.rutas : null), [destino]);
  return (
    <Fijado
      id="video-scroll"
      recorridoVh={2.5}
      alMontar={({ interno, desactivar, progreso }) => {
        const video = interno.querySelector("video");
        const src = video?.getAttribute("src");
        if (!video || !src || !video.parentElement) {
          desactivar(); // aún no hay clip (marcador de asset): la sección queda como estaba
          return;
        }
        video.pause();
        video.style.visibility = "hidden";
        video.parentElement.style.position ||= "relative";
        setDestino({ contenedor: video.parentElement, rutas: rutasDeClip(src, video.getAttribute("poster")), progreso });
        return () => {
          video.style.visibility = "";
          setDestino(null);
        };
      }}
    >
      {children}
      {destino && rutas && createPortal(<VideoScroll progreso={destino.progreso} rutas={rutas} />, destino.contenedor)}
    </Fijado>
  );
}
