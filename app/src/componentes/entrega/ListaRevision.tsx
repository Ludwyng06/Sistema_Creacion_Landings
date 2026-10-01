"use client";

import Link from "next/link";
import { Icono } from "@/componentes/Icono";
import type { EstadoRevision, Revision } from "@/lib/entrega/revision";

// La lista de revisión previa a guardar o publicar (§12.2): qué está bien, qué conviene mirar y qué bloquea.

const MARCA: Record<EstadoRevision, { icono: string; clase: string; texto: string }> = {
  ok: { icono: "check", clase: "border-contexto bg-contexto-suave text-contexto", texto: "Listo" },
  aviso: { icono: "info", clase: "border-tarea bg-tarea-suave text-tarea", texto: "Revisa" },
  bloquea: { icono: "candado", clase: "border-error bg-papel text-error", texto: "Bloquea" },
};

interface Props {
  revision: Revision;
  /** Dirección del editor con la sección seleccionada (en el visor). */
  hrefSeccion?: (seccionId: string) => string;
  /** Qué hacer al pulsar «Corregir» cuando ya se está en el editor. */
  alIrASeccion?: (seccionId: string) => void;
}

export function ListaRevision({ revision, hrefSeccion, alIrASeccion }: Props) {
  return (
    <ul className="flex flex-col gap-2" data-lista-revision>
      {revision.items.map((it) => {
        const m = MARCA[it.estado];
        const corregir = it.estado !== "ok" && it.seccionId;
        return (
          <li key={it.id} data-revision={it.id} data-estado={it.estado} className="flex items-start gap-3 rounded-md border border-linea bg-papel p-3 text-sm">
            <span className={`mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${m.clase}`}>
              <Icono nombre={m.icono} className="size-3.5" />
              {m.texto}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{it.titulo}</p>
              <p className="text-tinta-suave">{it.detalle}</p>
            </div>
            {corregir &&
              (hrefSeccion ? (
                <Link href={hrefSeccion(it.seccionId!)} className="shrink-0 self-center text-marca underline" data-corregir={it.id}>
                  Corregir
                </Link>
              ) : alIrASeccion ? (
                <button type="button" onClick={() => alIrASeccion(it.seccionId!)} className="shrink-0 self-center text-marca underline" data-corregir={it.id}>
                  Corregir
                </button>
              ) : null)}
          </li>
        );
      })}
    </ul>
  );
}
