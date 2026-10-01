"use client";

import Link from "next/link";
import { useState } from "react";
import { BOTON_PEQUENO, BOTON_PRIMARIO, BOTON_SECUNDARIO } from "@/componentes/crear/estilos";
import { ErrorApi } from "@/componentes/crear/api";
import { buscarFotos, reintentarCritico } from "@/componentes/editor/api-editor";
import { textoAviso, type SenalGeneracion } from "@/lib/entrega/generacion";

interface Props {
  landingId: string;
  senal: SenalGeneracion;
  /** Se llama cuando el crítico terminó bien (el visor se recarga; `/crear` abre el visor). */
  alReintentar?: () => void;
  /** Enlaces extra (por ejemplo «Abrir la landing» en `/crear`). */
  children?: React.ReactNode;
  /** `compacto` para la franja del visor. */
  compacto?: boolean;
}

/** Aviso amable cuando la generación terminó con el crítico pendiente o con secciones por completar, con «Reintentar el crítico». */
export function AvisoGeneracion({ landingId, senal, alReintentar, children, compacto = false }: Props) {
  const [reintentando, setReintentando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const { titulo, detalle } = textoAviso(senal);

  async function reintentar() {
    setReintentando(true);
    setError(null);
    try {
      await reintentarCritico(landingId);
      setHecho(true);
      alReintentar?.();
    } catch (e) {
      setError(e instanceof ErrorApi && e.estado === 503 ? "Todavía no hay cupo en los proveedores de IA. Prueba de nuevo en unos minutos." : e instanceof Error ? e.message : "No pudimos reintentar el crítico.");
    } finally {
      setReintentando(false);
    }
  }

  async function fotos() {
    setBuscando(true);
    setError(null);
    try {
      await buscarFotos(landingId);
      setHecho(true);
      alReintentar?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos buscar las fotos.");
    } finally {
      setBuscando(false);
    }
  }

  return (
    <section
      aria-labelledby={`aviso-generacion-${landingId}`}
      data-aviso-generacion
      className={`flex gap-3 border-marca bg-papel-hondo ${compacto ? "flex-wrap items-center border-t px-3 py-1.5 sm:px-4" : "flex-col rounded-md border p-4 md:p-5"}`}
    >
      <div className={compacto ? "min-w-0 flex-1 basis-60" : undefined}>
        <h2 id={`aviso-generacion-${landingId}`} className={`font-editorial font-semibold ${compacto ? "text-sm" : "text-lg"}`}>
          {titulo}
        </h2>
        <p className={`text-sm text-tinta-suave ${compacto ? "max-sm:sr-only" : "mt-1"}`}>{detalle}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {senal.criticoPendiente && (
          <button type="button" className={compacto ? BOTON_PEQUENO : BOTON_PRIMARIO} onClick={() => void reintentar()} disabled={reintentando} aria-busy={reintentando} data-reintentar-critico>
            {reintentando ? "Revisando…" : "Reintentar el crítico"}
          </button>
        )}
        {(senal.fotosPendientes ?? 0) > 0 && (
          <button type="button" className={compacto ? BOTON_PEQUENO : BOTON_SECUNDARIO} onClick={() => void fotos()} disabled={buscando} aria-busy={buscando} data-buscar-fotos>
            {buscando ? "Buscando fotos…" : "Buscar fotos"}
          </button>
        )}
        {senal.seccionesPendientes > 0 && (
          <Link href={`/editor/${landingId}`} className={compacto ? BOTON_PEQUENO : BOTON_SECUNDARIO}>
            Completar en el editor
          </Link>
        )}
        {children}
      </div>
      <p role={error ? "alert" : "status"} aria-live="polite" className={`text-sm ${error ? "text-error" : "text-tinta-suave"} ${compacto ? "basis-full empty:hidden" : ""}`}>
        {error ?? (hecho ? "Listo: tu landing se actualizó." : "")}
      </p>
    </section>
  );
}
