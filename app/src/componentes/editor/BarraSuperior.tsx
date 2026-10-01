"use client";

import Link from "next/link";
import { useState } from "react";
import { Icono } from "@/componentes/Icono";
import { BOTON_PEQUENO, BOTON_PRIMARIO, CLASE_CONTROL } from "../crear/estilos";
import type { EstadoGuardado } from "./autoguardado";
import type { MotivoBanco } from "./api-editor";
import type { DispositivoVista } from "./mensajes";

interface Props {
  id: string;
  nombre: string;
  onRenombrar: (nombre: string) => Promise<void>;
  puedeDeshacer: boolean;
  puedeRehacer: boolean;
  onDeshacer: () => void;
  onRehacer: () => void;
  guardado: EstadoGuardado;
  detalleGuardado?: string;
  slug: string;
  estadoBanco: string;
  onVersiones: () => void;
  onBanco: () => void;
  onAtajos: () => void;
  dispositivo: DispositivoVista;
  onDispositivo: (d: DispositivoVista) => void;
  guardandoBanco: boolean;
  motivosBanco: MotivoBanco[] | null;
  mensajeBanco: string | null;
  errorBanco: string | null;
  errorNombre: string | null;
  /** Motivo por el que «Guardar en banco» está bloqueado (validador anti-split de render); `null` si se puede. */
  bloqueoBanco?: string | null;
}

const TEXTO_GUARDADO: Record<EstadoGuardado, string> = {
  guardado: "Guardado",
  pendiente: "Cambios sin guardar…",
  guardando: "Guardando…",
  error: "No se pudo guardar",
};

const DISPOSITIVOS: { id: DispositivoVista; nombre: string; icono: string }[] = [
  { id: "desktop", nombre: "Escritorio", icono: "escritorio" },
  { id: "tablet", nombre: "Tablet", icono: "tablet" },
  { id: "mobile", nombre: "Móvil", icono: "movil" },
];

/** Barra superior de 56 px (§11.1): volver al banco, nombre, dispositivos, historial, estado, Ver completa y Guardar en banco. */
export function BarraSuperior(p: Props) {
  // `null`: el campo muestra el nombre guardado; al escribir, muestra lo que se está editando.
  const [borrador, setBorrador] = useState<string | null>(null);
  const nombre = borrador ?? p.nombre;

  const confirmarNombre = () => {
    const limpio = nombre.trim();
    if (limpio && limpio !== p.nombre) void p.onRenombrar(limpio);
    setBorrador(null);
  };

  const avisos = Boolean(p.bloqueoBanco || p.errorNombre || p.errorBanco || p.mensajeBanco || p.motivosBanco);

  return (
    <>
      <header className="flex min-h-14 shrink-0 flex-wrap items-center gap-2 border-b border-linea bg-papel px-3 py-2 sm:h-14 sm:flex-nowrap sm:py-0" data-barra-editor>
        <Link href="/banco" className={`${BOTON_PEQUENO} shrink-0 gap-1.5`} aria-label="Volver al banco">
          <Icono nombre="flecha-izquierda" className="size-4" />
          <span className="max-xl:sr-only">Banco</span>
        </Link>
        <label htmlFor="nombre-landing" className="sr-only">
          Nombre de la landing
        </label>
        <input
          id="nombre-landing"
          className={`${CLASE_CONTROL} min-h-9 min-w-0 max-w-64 flex-1 basis-32 py-1 font-editorial text-base font-semibold`}
          value={nombre}
          maxLength={120}
          onChange={(e) => setBorrador(e.target.value)}
          onBlur={confirmarNombre}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
        <div role="group" aria-label="Dispositivo de la vista previa" className="flex shrink-0 gap-1 max-sm:hidden">
          {DISPOSITIVOS.map((d) => (
            <button
              key={d.id}
              type="button"
              aria-pressed={p.dispositivo === d.id}
              aria-label={d.nombre}
              title={d.nombre}
              data-dispositivo-boton={d.id}
              onClick={() => p.onDispositivo(d.id)}
              className={`${BOTON_PEQUENO} aria-pressed:border-marca aria-pressed:bg-marca aria-pressed:text-marca-texto`}
            >
              <Icono nombre={d.icono} className="size-4" />
            </button>
          ))}
        </div>
        <div className="flex shrink-0 gap-1" role="group" aria-label="Historial">
          <button type="button" className={BOTON_PEQUENO} disabled={!p.puedeDeshacer} onClick={p.onDeshacer} aria-label="Deshacer (Ctrl+Z)" title="Deshacer (Ctrl+Z)">
            <Icono nombre="deshacer" className="size-4" />
          </button>
          <button type="button" className={BOTON_PEQUENO} disabled={!p.puedeRehacer} onClick={p.onRehacer} aria-label="Rehacer (Ctrl+Mayús+Z)" title="Rehacer (Ctrl+Mayús+Z)">
            <Icono nombre="rehacer" className="size-4" />
          </button>
        </div>
        <p role="status" aria-live="polite" data-guardado={p.guardado} title={p.detalleGuardado} className={`shrink-0 text-sm max-lg:sr-only ${p.guardado === "error" ? "text-error" : "text-tinta-suave"}`}>
          <span aria-hidden="true" className={`mr-1.5 inline-block size-2 rounded-full ${p.guardado === "guardado" ? "bg-contexto" : p.guardado === "error" ? "bg-error" : "bg-tarea"}`} />
          {TEXTO_GUARDADO[p.guardado]}
        </p>
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <button type="button" className={BOTON_PEQUENO} onClick={p.onAtajos} aria-label="Atajos de teclado (?)" title="Atajos de teclado (?)">
            <span aria-hidden="true" className="font-semibold">
              ?
            </span>
          </button>
          <button type="button" className={`${BOTON_PEQUENO} max-lg:hidden`} onClick={p.onVersiones}>
            Versiones
          </button>
          <Link href={`/ver/${p.id}`} className={`${BOTON_PEQUENO} gap-1.5`} data-ver-completa title="Ver completa (P)">
            <Icono nombre="pantalla-completa" className="size-4" />
            <span className="max-xl:sr-only">Ver completa</span>
          </Link>
          <button
            type="button"
            className={`${BOTON_PRIMARIO} min-h-11 px-3 text-sm`}
            disabled={p.guardandoBanco || Boolean(p.bloqueoBanco)}
            title={p.bloqueoBanco ?? undefined}
            aria-describedby={p.bloqueoBanco ? "motivo-bloqueo-banco" : undefined}
            onClick={p.onBanco}
          >
            {p.guardandoBanco ? (
              "Guardando…"
            ) : (
              <>
                <span className="max-sm:hidden">{p.estadoBanco === "en-banco" ? "Actualizar en el banco" : "Guardar en banco"}</span>
                <span className="sm:hidden" aria-hidden="true">
                  {p.estadoBanco === "en-banco" ? "Actualizar" : "Al banco"}
                </span>
                <span className="sr-only sm:hidden">{p.estadoBanco === "en-banco" ? "Actualizar en el banco" : "Guardar en banco"}</span>
              </>
            )}
          </button>
        </div>
      </header>

      {avisos && (
        <div className="flex shrink-0 flex-col gap-1 border-b border-linea bg-papel px-4 py-2 text-sm">
          {p.bloqueoBanco && (
            <p id="motivo-bloqueo-banco" data-banco-bloqueado className="text-error">
              {p.bloqueoBanco}
            </p>
          )}
          {p.errorNombre && (
            <p role="alert" className="text-error">
              {p.errorNombre}
            </p>
          )}
          {p.errorBanco && (
            <p role="alert" className="text-error">
              {p.errorBanco}
            </p>
          )}
          {p.mensajeBanco && (
            <p role="status" className="text-contexto">
              {p.mensajeBanco}
            </p>
          )}
          {p.motivosBanco && (
            <div role="alert" className="rounded-md border border-error p-3 text-error" data-motivos-banco>
              <p className="font-medium">No se puede guardar en el banco todavía:</p>
              <ul className="mt-1 list-disc pl-5">
                {p.motivosBanco.map((m, i) => (
                  <li key={i}>
                    <strong>{m.validador}</strong> · {m.ruta}: {m.mensaje}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </>
  );
}
