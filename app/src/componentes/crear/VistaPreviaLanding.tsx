"use client";

import "@/secciones/esquemas";
import { useEffect, useRef, useState } from "react";
import { useAntiSplitRender } from "@/componentes/anti-split/useAntiSplitRender";
import { BannerAntiSplit } from "@/componentes/anti-split/BannerAntiSplit";
import { MedidorAntiSplit } from "@/componentes/anti-split/MedidorAntiSplit";
import { LandingRender } from "@/componentes/LandingRender";
import { urlFuentes } from "@/lib/fuentes/url";
import type { ResultadoAntiSplit } from "@/lib/validadores/anti-split-render";
import type { LandingDoc } from "@/lib/contratos";

export const MENSAJE_DOC = "landing-doc";
export const MENSAJE_LISTA = "vista-previa-lista";

/**
 * Contenido de `/crear/vista-previa`: pinta con `<LandingRender>` el documento que le manda
 * el asistente por `postMessage`. Vive en un iframe para que los puntos de corte respondan
 * al ancho real del marco (390 o 1280 px) y no al de la ventana.
 */
export function VistaPreviaLanding() {
  const [doc, setDoc] = useState<LandingDoc | null>(null);
  useAntiSplitRender(doc);

  useEffect(() => {
    const recibir = (evento: MessageEvent) => {
      if (evento.origin !== window.location.origin) return;
      const dato = evento.data as { tipo?: string; doc?: LandingDoc } | null;
      if (dato?.tipo === MENSAJE_DOC && dato.doc) setDoc(dato.doc);
    };
    window.addEventListener("message", recibir);
    // Avisa al asistente de que ya puede mandar el documento.
    window.parent?.postMessage({ tipo: MENSAJE_LISTA }, window.location.origin);
    return () => window.removeEventListener("message", recibir);
  }, []);

  if (!doc) return <p className="p-6 text-center text-sm text-tinta-suave">Cargando la vista previa…</p>;
  return <LandingRender doc={doc} urlFuentes={urlFuentes(doc.tokens)} />;
}

interface MarcoProps {
  doc: LandingDoc;
  /** Sin conmutador: solo el marco de 390 px (las tarjetas del duelo). */
  soloMovil?: boolean;
  /** Mide el héroe a 1280 px y muestra el banner «Héroe split detectado» (validador anti-split de render). */
  medirAntiSplit?: boolean;
}

const ANCHOS = [390, 1280] as const;
const ALTO_MARCO = 760;

/** Marco conmutable de 390 y 1280 px con la landing dentro de un iframe. */
export function MarcoVistaPrevia({ doc, soloMovil = false, medirAntiSplit = false }: MarcoProps) {
  const [antiSplit, setAntiSplit] = useState<ResultadoAntiSplit | null>(null);
  const [ancho, setAncho] = useState<(typeof ANCHOS)[number]>(390);
  const [disponible, setDisponible] = useState(0);
  const contenedor = useRef<HTMLDivElement>(null);
  const iframe = useRef<HTMLIFrameElement>(null);

  const enviar = () => {
    iframe.current?.contentWindow?.postMessage({ tipo: MENSAJE_DOC, doc }, window.location.origin);
  };

  // Reenvía el documento cuando cambia, y responde al aviso de «lista» del iframe.
  useEffect(() => {
    enviar();
    const recibir = (evento: MessageEvent) => {
      if (evento.origin === window.location.origin && (evento.data as { tipo?: string } | null)?.tipo === MENSAJE_LISTA) enviar();
    };
    window.addEventListener("message", recibir);
    return () => window.removeEventListener("message", recibir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc]);

  useEffect(() => {
    const elemento = contenedor.current;
    if (!elemento || typeof ResizeObserver === "undefined") return;
    const observador = new ResizeObserver(([entrada]) => setDisponible(entrada.contentRect.width));
    observador.observe(elemento);
    return () => observador.disconnect();
  }, []);

  const escala = disponible > 0 ? Math.min(1, disponible / ancho) : 1;

  return (
    <div>
      {medirAntiSplit && antiSplit?.split && (
        <div className="mb-3">
          <BannerAntiSplit
            accion={
              <a href="/dev/secciones" className="text-sm font-medium underline underline-offset-4">
                Ver las variantes de héroe aprobadas
              </a>
            }
          />
        </div>
      )}
      {!soloMovil && (
      <div role="group" aria-label="Ancho de la vista previa" className="mb-3 flex gap-2">
        {ANCHOS.map((a) => (
          <button
            key={a}
            type="button"
            aria-pressed={ancho === a}
            onClick={() => setAncho(a)}
            className="inline-flex min-h-11 items-center rounded-md border border-linea px-4 text-sm aria-pressed:border-marca aria-pressed:bg-marca aria-pressed:text-marca-texto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca"
          >
            {a === 390 ? "Móvil · 390 px" : "Escritorio · 1280 px"}
          </button>
        ))}
      </div>
      )}
      <div ref={contenedor} className="flex w-full justify-center overflow-hidden rounded-md border border-linea bg-papel-hondo">
        <div style={{ width: ancho * escala, height: ALTO_MARCO * escala }}>
          <iframe
            ref={iframe}
            title={`Vista previa de la landing a ${ancho} píxeles`}
            src="/crear/vista-previa"
            onLoad={enviar}
            className="origin-top-left border-0 bg-papel"
            style={{ width: ancho, height: ALTO_MARCO, transform: `scale(${escala})` }}
          />
        </div>
      </div>
      {medirAntiSplit && (
        <MedidorAntiSplit
          src="/crear/vista-previa"
          mensajeLista={MENSAJE_LISTA}
          clave={doc}
          enviar={(ventana) => ventana.postMessage({ tipo: MENSAJE_DOC, doc }, window.location.origin)}
          onResultado={setAntiSplit}
        />
      )}
    </div>
  );
}
