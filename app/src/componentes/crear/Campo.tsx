"use client";

import type { ReactNode } from "react";

export interface PropsControl {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
  "aria-required"?: true;
}

interface Props {
  id: string;
  etiqueta: string;
  obligatorio?: boolean;
  ayuda?: string;
  error?: string;
  children: (control: PropsControl) => ReactNode;
}

/** Etiqueta, ayuda y error asociados al control con `aria-describedby`. */
export function Campo({ id, etiqueta, obligatorio, ayuda, error, children }: Props) {
  const descripciones = [ayuda ? `${id}-ayuda` : null, error ? `${id}-error` : null].filter(Boolean).join(" ");
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {etiqueta}
        {obligatorio ? (
          <span aria-hidden="true" className="text-error">
            {" "}
            *
          </span>
        ) : (
          <span className="font-normal text-tinta-suave"> (opcional)</span>
        )}
      </label>
      {ayuda && (
        <p id={`${id}-ayuda`} className="mb-2 text-sm text-tinta-suave">
          {ayuda}
        </p>
      )}
      {children({
        id,
        "aria-describedby": descripciones || undefined,
        "aria-invalid": error ? true : undefined,
        "aria-required": obligatorio ? true : undefined,
      })}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-sm text-error">
          {error}
        </p>
      )}
    </div>
  );
}
