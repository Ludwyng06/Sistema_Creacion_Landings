"use client";

import { useState } from "react";
import type { Asset } from "@/lib/contratos";
import { BOTON_PEQUENO, CLASE_CONTROL } from "../crear/estilos";
import { ListaEditable } from "../crear/ListaEditable";
import type { MedioBusqueda, buscarMedios } from "./bancos";
import { ControlImagen } from "./ControlImagen";
import type { CampoForm } from "./esquema-form";

export interface ContextoSlots {
  assets: Asset[];
  landingId: string;
  subiendo: string | null;
  errorSubida: { slot: string; mensaje: string } | null;
  onSubir: (slot: string, archivo: File) => void;
  /** Foco (`object-position`) de cada imagen por slot, y cómo cambiarlo (`null` = centrado). */
  /** Slot cuyo buscador de bancos debe abrirse al mostrarse (desde el marcador de imagen pendiente). */
  abrirBancos?: string | null;
  focos?: Record<string, string>;
  onFoco?: (slot: string, foco: string | null) => void;
  /** Una imagen elegida en los bancos de medios. */
  onMedio?: (slot: string, medio: MedioBusqueda) => void;
  /** Búsqueda en los bancos (se puede reemplazar en las pruebas). */
  buscarMedios?: typeof buscarMedios;
}

interface Props {
  campo: CampoForm;
  valor: unknown;
  onChange: (valor: unknown) => void;
  id: string;
  error?: string;
  slots: ContextoSlots;
}

const SlotEditor = ControlImagen;

const textoDeUnion = (v: unknown): string => (typeof v === "boolean" ? "" : v === undefined || v === null ? "" : String(v));

/** Un control por tipo de campo, elegido por el generador a partir del schema. */
export function ControlCampo({ campo, valor, onChange, id, error, slots }: Props) {
  const [json, setJson] = useState(() => JSON.stringify(valor ?? null));
  const [jsonMalo, setJsonMalo] = useState(false);
  const comunes = {
    id,
    "aria-invalid": error ? (true as const) : undefined,
    "aria-describedby": error ? `${id}-error` : undefined,
  };

  switch (campo.clase) {
    case "texto":
      return <input {...comunes} className={CLASE_CONTROL} maxLength={campo.max} value={typeof valor === "string" ? valor : ""} onChange={(e) => onChange(campo.requerido ? e.target.value : e.target.value || undefined)} />;
    case "textoLargo":
      return <textarea {...comunes} rows={3} className={CLASE_CONTROL} maxLength={campo.max} value={typeof valor === "string" ? valor : ""} onChange={(e) => onChange(campo.requerido ? e.target.value : e.target.value || undefined)} />;
    case "select":
      return (
        <select {...comunes} className={CLASE_CONTROL} value={String(valor ?? "")} onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}>
          {!campo.requerido && <option value="">Sin elegir</option>}
          {campo.opciones?.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.etiqueta}
            </option>
          ))}
        </select>
      );
    case "booleano":
      return (
        <button {...comunes} type="button" role="switch" aria-checked={valor === true} onClick={() => onChange(valor !== true)} className="inline-flex min-h-11 items-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca">
          <span aria-hidden="true" className={`relative h-6 w-11 rounded-full transition-colors ${valor === true ? "bg-marca" : "bg-linea"}`}>
            <span className={`absolute top-0.5 size-5 rounded-full bg-papel transition-all ${valor === true ? "left-[1.375rem]" : "left-0.5"}`} />
          </span>
          <span className="text-sm">{valor === true ? "Sí" : "No"}</span>
        </button>
      );
    case "numero":
      return (
        <input
          {...comunes}
          type="number"
          className={CLASE_CONTROL}
          min={campo.min}
          max={campo.max}
          step={campo.entero ? 1 : "any"}
          value={typeof valor === "number" ? valor : ""}
          onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        />
      );
    case "numero-o-marca":
      return (
        <input
          {...comunes}
          className={CLASE_CONTROL}
          inputMode="decimal"
          placeholder="Número o [COMPLETAR]"
          value={valor === undefined ? "" : String(valor)}
          onChange={(e) => {
            const t = e.target.value.trim();
            onChange(t === "" ? undefined : /^\d+([.,]\d+)?$/.test(t) ? Number(t.replace(",", ".")) : e.target.value);
          }}
        />
      );
    case "si-no-texto": {
      const modo = valor === true ? "si" : valor === false ? "no" : "texto";
      return (
        <div className="flex flex-wrap gap-2">
          <select {...comunes} className={`${CLASE_CONTROL} w-auto`} value={modo} onChange={(e) => onChange(e.target.value === "si" ? true : e.target.value === "no" ? false : "[COMPLETAR]")}>
            <option value="si">Sí</option>
            <option value="no">No</option>
            <option value="texto">Texto</option>
          </select>
          {modo === "texto" && <input aria-label={`${campo.etiqueta} (texto)`} className={`${CLASE_CONTROL} min-w-0 flex-1`} value={textoDeUnion(valor)} onChange={(e) => onChange(e.target.value)} />}
        </div>
      );
    }
    case "multiselect": {
      const elegidos = Array.isArray(valor) ? (valor as string[]) : [];
      return (
        <div role="group" aria-label={campo.etiqueta} className="flex flex-wrap gap-2">
          {campo.opciones?.map((o) => {
            const activo = elegidos.includes(o.valor);
            return (
              <label key={o.valor} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-linea px-3 has-[:checked]:border-marca has-[:checked]:bg-papel-hondo has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-marca">
                <input type="checkbox" className="size-4 accent-marca" checked={activo} onChange={() => onChange(activo ? elegidos.filter((x) => x !== o.valor) : [...elegidos, o.valor])} />
                <span className="text-sm">{o.etiqueta}</span>
              </label>
            );
          })}
        </div>
      );
    }
    case "lista-texto":
      return <ListaEditable id={id} etiquetaElemento={campo.etiqueta} valores={Array.isArray(valor) ? (valor as string[]) : []} min={campo.min ?? 0} max={campo.max ?? 20} onChange={onChange} />;
    case "slot":
      return <SlotEditor id={id} nombre={typeof valor === "string" ? valor : ""} onNombre={(n) => onChange(n || (campo.requerido ? "" : undefined))} slots={slots} />;
    case "lista-slot": {
      const lista = Array.isArray(valor) ? (valor as string[]) : [];
      return (
        <div className="flex flex-col gap-3">
          {lista.map((nombre, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <SlotEditor id={`${id}-${i}`} nombre={nombre} onNombre={(n) => onChange(lista.map((x, j) => (j === i ? n : x)))} slots={slots} />
              </div>
              <button type="button" className={BOTON_PEQUENO} aria-label={`Quitar ${campo.etiqueta.toLowerCase()} ${i + 1}`} disabled={lista.length <= (campo.min ?? 0)} onClick={() => onChange(lista.filter((_, j) => j !== i))}>
                <span aria-hidden="true">✕</span>
              </button>
            </div>
          ))}
          <button type="button" className={`${BOTON_PEQUENO} self-start`} disabled={lista.length >= (campo.max ?? 20)} onClick={() => onChange([...lista, ""])}>
            Agregar slot
          </button>
        </div>
      );
    }
    case "json":
      return (
        <textarea
          {...comunes}
          rows={3}
          className={`${CLASE_CONTROL} font-mono text-xs`}
          value={json}
          aria-invalid={error || jsonMalo ? true : undefined}
          onChange={(e) => {
            setJson(e.target.value);
            try {
              onChange(JSON.parse(e.target.value));
              setJsonMalo(false);
            } catch {
              setJsonMalo(true);
            }
          }}
        />
      );
  }
}
