"use client";

import { BOTON_PEQUENO, BOTON_SECUNDARIO, CLASE_CONTROL } from "./estilos";

interface Props {
  /** Prefijo de los ids de cada elemento. */
  id: string;
  etiquetaElemento: string;
  valores: string[];
  onChange: (valores: string[]) => void;
  min?: number;
  max?: number;
  placeholder?: string;
  textoAgregar?: string;
  errores?: Record<string, string>;
  /** Prefijo de las claves de error: `beneficios` da `beneficios.0`, `beneficios.1`… */
  claveError?: string;
}

function mover<T>(lista: T[], desde: number, hacia: number): T[] {
  const copia = [...lista];
  const [x] = copia.splice(desde, 1);
  copia.splice(hacia, 0, x);
  return copia;
}

/** Lista de textos editable: agregar, quitar y reordenar con botones (funciona solo con teclado). */
export function ListaEditable({
  id,
  etiquetaElemento,
  valores,
  onChange,
  min = 0,
  max = 20,
  placeholder,
  textoAgregar = "Agregar",
  errores = {},
  claveError,
}: Props) {
  return (
    <div>
      <ul className="flex flex-col gap-2">
        {valores.map((valor, i) => {
          const error = claveError ? errores[`${claveError}.${i}`] : undefined;
          const nombre = `${etiquetaElemento} ${i + 1}`;
          return (
            <li key={i}>
              <div className="flex flex-wrap items-start gap-2">
                <input
                  id={`${id}-${i}`}
                  aria-label={nombre}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? `${id}-${i}-error` : undefined}
                  className={`${CLASE_CONTROL} min-w-0 flex-1 basis-56`}
                  value={valor}
                  placeholder={placeholder}
                  onChange={(e) => onChange(valores.map((v, j) => (j === i ? e.target.value : v)))}
                />
                <div className="flex gap-1" role="group" aria-label={`Acciones de ${nombre.toLowerCase()}`}>
                  <button
                    type="button"
                    className={BOTON_PEQUENO}
                    disabled={i === 0}
                    aria-label={`Subir ${nombre.toLowerCase()}`}
                    onClick={() => onChange(mover(valores, i, i - 1))}
                  >
                    <span aria-hidden="true">↑</span>
                  </button>
                  <button
                    type="button"
                    className={BOTON_PEQUENO}
                    disabled={i === valores.length - 1}
                    aria-label={`Bajar ${nombre.toLowerCase()}`}
                    onClick={() => onChange(mover(valores, i, i + 1))}
                  >
                    <span aria-hidden="true">↓</span>
                  </button>
                  <button
                    type="button"
                    className={BOTON_PEQUENO}
                    disabled={valores.length <= min}
                    aria-label={`Quitar ${nombre.toLowerCase()}`}
                    onClick={() => onChange(valores.filter((_, j) => j !== i))}
                  >
                    <span aria-hidden="true">✕</span>
                  </button>
                </div>
              </div>
              {error && (
                <p id={`${id}-${i}-error`} role="alert" className="mt-1 text-sm text-error">
                  {error}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        className={`${BOTON_SECUNDARIO} mt-3`}
        disabled={valores.length >= max}
        onClick={() => onChange([...valores, ""])}
      >
        {textoAgregar}
      </button>
    </div>
  );
}
