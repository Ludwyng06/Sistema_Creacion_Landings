"use client";

import { useEffect, useRef } from "react";
import { Icono } from "@/componentes/Icono";
import { BOTON_PEQUENO } from "../crear/estilos";
import { LISTA_ATAJOS } from "./atajos";

/** Ayuda con todos los atajos (se abre con `?`). Esc la cierra y el foco vuelve a donde estaba. */
export function AyudaAtajos({ onCerrar }: { onCerrar: () => void }) {
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
    <div className="fixed inset-0 z-50 grid place-items-center bg-tinta/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div role="dialog" aria-modal="true" aria-labelledby="titulo-atajos" data-ayuda-atajos className="w-full max-w-lg rounded-lg border border-linea bg-papel p-5 shadow-xl">
        <div className="flex items-center justify-between gap-3">
          <h2 id="titulo-atajos" className="font-editorial text-xl font-semibold">
            Atajos de teclado
          </h2>
          <button ref={cerrar} type="button" onClick={onCerrar} className={BOTON_PEQUENO} aria-label="Cerrar">
            <Icono nombre="cerrar" className="size-5" />
          </button>
        </div>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          {LISTA_ATAJOS.map((a) => (
            <div key={a.teclas} className="contents">
              <dt>
                <kbd className="rounded-md border border-linea bg-papel-hondo px-2 py-0.5 font-mono text-xs">{a.teclas}</kbd>
              </dt>
              <dd className="text-tinta-suave">{a.descripcion}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
