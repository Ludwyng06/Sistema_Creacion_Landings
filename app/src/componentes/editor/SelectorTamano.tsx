"use client";

import { TAMANOS } from "@/secciones/presentacion";

interface Props<T extends string> {
  etiqueta: string;
  valor: T;
  onCambio: (valor: T) => void;
  /** Agrega la opción «Heredado» al inicio (tamaños por sección). */
  conHeredado?: boolean;
  clave: string;
}

/** Cinco pasos de tamaño de letra (XS, S, M, L y XL), con «Heredado» opcional; accesible como grupo de botones. */
export function SelectorTamano<T extends string>({ etiqueta, valor, onCambio, conHeredado = false, clave }: Props<T>) {
  const opciones = (conHeredado ? ["heredado", ...TAMANOS] : [...TAMANOS]) as string[];
  return (
    <div role="group" aria-label={etiqueta} data-tamano={clave} className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{etiqueta}</span>
      <div className="grid auto-cols-fr grid-flow-col gap-1">
        {opciones.map((o) => (
          <button
            key={o}
            type="button"
            aria-pressed={valor === o}
            data-paso={o}
            onClick={() => onCambio(o as T)}
            className="min-h-11 rounded-md border border-linea px-1 text-xs aria-pressed:border-marca aria-pressed:bg-marca aria-pressed:text-marca-texto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca"
          >
            {o === "heredado" ? "Heredado" : o}
          </button>
        ))}
      </div>
    </div>
  );
}
