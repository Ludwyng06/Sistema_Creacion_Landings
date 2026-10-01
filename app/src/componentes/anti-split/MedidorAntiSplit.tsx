"use client";

import { useEffect, useRef } from "react";
import { MSG_ANTI_SPLIT, type ResultadoAntiSplit } from "@/lib/validadores/anti-split-render";

interface Props {
  /** Ruta de la vista previa que pinta la landing (`/editor/<id>/vista` o `/crear/vista-previa`). */
  src: string;
  /** Manda el documento al iframe con el protocolo de mensajes de esa vista previa. */
  enviar: (ventana: Window) => void;
  /** Mensaje con el que la vista avisa de que ya puede recibir el documento. */
  mensajeLista: string;
  /** Cambia cuando cambia el documento: reenvía. */
  clave: unknown;
  onResultado: (r: ResultadoAntiSplit) => void;
}

/**
 * Vista previa invisible a 1280 px que solo sirve para medir. Así el banner y el bloqueo del banco funcionan
 * aunque la persona esté mirando la vista de 390 px, donde el validador no aplica.
 */
export function MedidorAntiSplit({ src, enviar, mensajeLista, clave, onResultado }: Props) {
  const iframe = useRef<HTMLIFrameElement>(null);
  const envio = useRef(enviar);
  const aviso = useRef(onResultado);
  useEffect(() => {
    envio.current = enviar;
    aviso.current = onResultado;
  });

  useEffect(() => {
    const ventana = iframe.current?.contentWindow;
    if (ventana) envio.current(ventana);
  }, [clave]);

  useEffect(() => {
    const recibir = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== iframe.current?.contentWindow) return;
      const dato = e.data as { tipo?: string; type?: string; resultado?: ResultadoAntiSplit } | null;
      if ((dato?.tipo ?? dato?.type) === mensajeLista && iframe.current?.contentWindow) envio.current(iframe.current.contentWindow);
      if (dato?.tipo === MSG_ANTI_SPLIT && dato.resultado) aviso.current(dato.resultado);
    };
    window.addEventListener("message", recibir);
    return () => window.removeEventListener("message", recibir);
  }, [mensajeLista]);

  return (
    <iframe
      ref={iframe}
      src={src}
      title="Medición del héroe a 1280 píxeles"
      aria-hidden="true"
      tabIndex={-1}
      data-medidor-anti-split
      onLoad={() => iframe.current?.contentWindow && envio.current(iframe.current.contentWindow)}
      style={{ position: "fixed", left: -10000, top: 0, width: 1280, height: 760, border: 0, visibility: "hidden", pointerEvents: "none" }}
    />
  );
}
