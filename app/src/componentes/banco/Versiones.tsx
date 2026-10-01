"use client";

import { useState } from "react";
import { BOTON_PEQUENO, TITULO_SECCION } from "@/componentes/crear/estilos";
import { formatearFechaHora } from "@/lib/banco";
import type { ResumenVersion } from "@/lib/landings";

const fechaHora = formatearFechaHora;

/** Versiones de la landing con «Restaurar»: la actual se guarda antes como «Antes de restaurar» y la página se recarga. */
export function Versiones({ landingId, versiones }: { landingId: string; versiones: ResumenVersion[] }) {
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function restaurar(v: ResumenVersion) {
    setTrabajando(v.id);
    setError(null);
    try {
      const r = await fetch(`/api/landings/${landingId}/versiones/${v.id}/restaurar`, { method: "POST" });
      if (!r.ok) {
        const cuerpo = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(cuerpo.error ?? `No se pudo restaurar (código ${r.status}).`);
      }
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo restaurar.");
      setTrabajando(null);
    }
  }

  return (
    <section aria-labelledby="versiones-titulo" data-versiones className="flex flex-col gap-3">
      <h2 id="versiones-titulo" className={TITULO_SECCION}>
        Versiones
      </h2>
      {versiones.length === 0 ? (
        <p className="text-tinta-suave">Todavía no hay versiones guardadas.</p>
      ) : (
        <ol className="flex flex-col divide-y divide-linea rounded-md border border-linea">
          {versiones.map((v, i) => (
            <li key={v.id} data-version className="flex flex-wrap items-center justify-between gap-3 p-3">
              <span className="flex flex-col">
                <span className="font-medium">{v.nota ?? "Sin nota"}</span>
                <span className="text-sm text-tinta-suave">
                  {fechaHora(v.creadoEn)}
                  {i === 0 ? " · la más reciente" : ""}
                </span>
              </span>
              <button type="button" onClick={() => restaurar(v)} disabled={trabajando !== null} className={BOTON_PEQUENO} aria-label={`Restaurar la versión «${v.nota ?? "Sin nota"}» del ${fechaHora(v.creadoEn)}`}>
                {trabajando === v.id ? "Restaurando…" : "Restaurar"}
              </button>
            </li>
          ))}
        </ol>
      )}
      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}
    </section>
  );
}
