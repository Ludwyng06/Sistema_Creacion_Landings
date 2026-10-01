"use client";

import { useEffect, useRef } from "react";
import { Icono } from "@/componentes/Icono";
import { BOTON_PEQUENO, BOTON_PRIMARIO, BOTON_SECUNDARIO } from "@/componentes/crear/estilos";
import type { Revision } from "@/lib/entrega/revision";
import { ListaRevision } from "./ListaRevision";

interface Props {
  revision: Revision;
  /** Acción que se confirma: guardar en el banco o publicar. */
  accion: string;
  guardando?: boolean;
  onConfirmar: () => void;
  onCerrar: () => void;
  hrefSeccion?: (seccionId: string) => string;
  alIrASeccion?: (seccionId: string) => void;
}

/**
 * Lista de revisión antes de guardar en el banco o publicar (§12.2 del v2). Bloquea solo lo crítico: [COMPLETAR] en el
 * héroe o en el precio, precio sin definir y contraste por debajo de AA. Lo demás avisa y deja seguir.
 */
export function ModalRevision({ revision, accion, guardando = false, onConfirmar, onCerrar, hrefSeccion, alIrASeccion }: Props) {
  const cerrar = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    cerrar.current?.focus();
    const alTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCerrar();
      }
    };
    document.addEventListener("keydown", alTecla, true);
    return () => {
      document.removeEventListener("keydown", alTecla, true);
      previo?.focus?.();
    };
  }, [onCerrar]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-tinta/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div role="dialog" aria-modal="true" aria-labelledby="titulo-revision" data-modal-revision className="w-full max-w-xl rounded-lg border border-linea bg-papel p-5 shadow-xl">
        <div className="flex items-center justify-between gap-3">
          <h2 id="titulo-revision" className="font-editorial text-xl font-semibold">
            Antes de {accion.toLowerCase()}
          </h2>
          <button ref={cerrar} type="button" onClick={onCerrar} className={BOTON_PEQUENO} aria-label="Cerrar">
            <Icono nombre="cerrar" className="size-5" />
          </button>
        </div>
        <p className="mt-1 text-sm text-tinta-suave" data-resumen-revision>
          {revision.bloquea
            ? `Hay ${revision.bloqueos} ${revision.bloqueos === 1 ? "punto que bloquea" : "puntos que bloquean"}: corrígelo para poder continuar.`
            : revision.avisos > 0
              ? `Nada bloquea. Hay ${revision.avisos} ${revision.avisos === 1 ? "punto" : "puntos"} para mirar, pero puedes continuar.`
              : "Todo en orden."}
        </p>
        <div className="mt-4">
          <ListaRevision revision={revision} hrefSeccion={hrefSeccion} alIrASeccion={alIrASeccion} />
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onCerrar} className={BOTON_SECUNDARIO}>
            Cancelar
          </button>
          <button type="button" onClick={onConfirmar} disabled={revision.bloquea || guardando} aria-disabled={revision.bloquea || guardando} data-confirmar-revision className={BOTON_PRIMARIO}>
            {guardando ? "Guardando…" : accion}
          </button>
        </div>
      </div>
    </div>
  );
}
