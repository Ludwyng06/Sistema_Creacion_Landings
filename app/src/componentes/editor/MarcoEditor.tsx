"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LandingDoc } from "@/lib/contratos";
import { ANCHO_DISPOSITIVO, leerMensajeDeVista, type AccionRapida, type DispositivoVista, type MensajeAVista, type MensajeDeVista } from "./mensajes";

/** Ancho con el que se pinta el escritorio antes de reducirlo para que quepa en el lienzo. */
const ANCHO_ESCRITORIO = 1280;

interface Props {
  id: string;
  doc: LandingDoc;
  seleccion: string | null;
  /** `true` si la última selección vino de la lista (entonces la vista previa se desplaza hasta la sección). */
  desplazar: boolean;
  dispositivo: DispositivoVista;
  resaltada: string | null;
  permitidas: Record<AccionRapida, boolean>;
  onMensaje: (mensaje: MensajeDeVista) => void;
}

/**
 * Lienzo del editor (§11.2): el iframe a `/editor/[id]/vista` con el ancho del dispositivo, escalado para caber. El scroll
 * ocurre dentro del iframe; el documento y la selección viajan por `postMessage` sin recargarlo.
 */
export function MarcoEditor({ id, doc, seleccion, desplazar, dispositivo, resaltada, permitidas, onMensaje }: Props) {
  const [espacio, setEspacio] = useState({ ancho: 0, alto: 0 });
  const lienzo = useRef<HTMLDivElement>(null);
  const iframe = useRef<HTMLIFrameElement>(null);
  // Cuántas veces avisó la vista que está lista (cada READY, también tras recargarse, vuelve a mandarle todo).
  const [ronda, setRonda] = useState(0);
  const lista = ronda > 0;

  const enviar = useCallback((mensaje: MensajeAVista) => {
    iframe.current?.contentWindow?.postMessage(mensaje, window.location.origin);
  }, []);

  // Cada cambio se manda al iframe sin recargarlo (el documento primero, para que la selección encuentre su sección).
  useEffect(() => {
    if (lista) enviar({ type: "LANDING_UPDATE", landing: doc });
  }, [doc, lista, ronda, enviar]);
  useEffect(() => {
    if (lista) enviar({ type: "SELECT", id: seleccion, scroll: desplazar });
  }, [seleccion, desplazar, lista, ronda, doc, enviar]);
  useEffect(() => {
    if (lista) enviar({ type: "DEVICE", device: dispositivo });
  }, [dispositivo, lista, ronda, enviar]);
  useEffect(() => {
    if (lista) enviar({ type: "HIGHLIGHT", id: resaltada });
  }, [resaltada, lista, ronda, enviar]);
  useEffect(() => {
    if (lista && seleccion) enviar({ type: "QUICK_STATE", id: seleccion, permitidas });
  }, [permitidas, seleccion, lista, ronda, enviar]);

  useEffect(() => {
    const recibir = (evento: MessageEvent) => {
      // Solo el iframe propio y del mismo origen.
      if (evento.origin !== window.location.origin || evento.source !== iframe.current?.contentWindow) return;
      const m = leerMensajeDeVista(evento.data);
      if (!m) return;
      if (m.type === "READY") setRonda((r) => r + 1);
      onMensaje(m);
    };
    window.addEventListener("message", recibir);
    return () => window.removeEventListener("message", recibir);
  }, [onMensaje]);

  useEffect(() => {
    const elemento = lienzo.current;
    if (!elemento || typeof ResizeObserver === "undefined") return;
    const observador = new ResizeObserver(([entrada]) => setEspacio({ ancho: entrada.contentRect.width, alto: entrada.contentRect.height }));
    observador.observe(elemento);
    return () => observador.disconnect();
  }, []);

  const anchoVirtual = ANCHO_DISPOSITIVO[dispositivo] ?? ANCHO_ESCRITORIO;
  const escala = espacio.ancho > 0 ? Math.min(1, espacio.ancho / anchoVirtual) : 1;
  const altoVirtual = espacio.alto > 0 ? espacio.alto / escala : 760;

  return (
    <div ref={lienzo} data-lienzo data-dispositivo={dispositivo} className="flex h-full min-h-0 justify-center overflow-hidden rounded-lg bg-papel-hondo">
      <div style={{ width: anchoVirtual * escala, height: espacio.alto || "100%" }}>
        <iframe
          ref={iframe}
          title={`Vista previa de la landing en ${dispositivo === "desktop" ? "escritorio" : dispositivo === "tablet" ? "tablet" : "móvil"}`}
          src={`/editor/${id}/vista`}
          className="origin-top-left border-0 bg-papel transition-[width] duration-200 motion-reduce:transition-none"
          style={{ width: anchoVirtual, height: altoVirtual, transform: `scale(${escala})` }}
        />
      </div>
    </div>
  );
}
