"use client";

import { BOTON_PEQUENO, ESTILO_SALUD } from "./estilos";
import { etiquetaConfianza, type CampoSugerible, type FuenteSugerencia, type MetaSugerida } from "./investigar";

export const NOMBRE_CAMPO: Record<CampoSugerible, string> = {
  categoria: "categoría",
  problema: "problema",
  publico: "público",
  beneficios: "beneficios",
  objeciones: "objeciones",
  incluye: "lo que incluye",
  nivelConciencia: "nivel de conciencia",
};

/** Chips con el nombre del sitio y enlace a la fuente. */
export function ChipsFuentes({ fuentes }: { fuentes: FuenteSugerencia[] }) {
  if (fuentes.length === 0) return <span className="text-sm text-tinta-suave">Sin enlace</span>;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Fuentes">
      {fuentes.map((f) => (
        <li key={f.url}>
          <a
            href={f.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-7 items-center rounded-full border border-linea bg-papel px-2.5 text-sm text-marca underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca"
          >
            {f.sitio}
          </a>
        </li>
      ))}
    </ul>
  );
}

const TEXTO_CONFIANZA = { alta: "Confianza alta", media: "Confianza media", baja: "Confianza baja" } as const;

export function Confianza({ valor }: { valor: number }) {
  const nivel = etiquetaConfianza(valor);
  return (
    <span className="inline-flex items-center gap-2 text-sm text-tinta-suave" data-confianza={nivel}>
      <span aria-hidden="true" className="block h-1.5 w-16 overflow-hidden rounded-full bg-linea">
        <span className="block h-full bg-marca" style={{ width: `${Math.round(valor * 100)}%` }} />
      </span>
      {TEXTO_CONFIANZA[nivel]}
    </span>
  );
}

interface Props {
  campo: CampoSugerible;
  meta: MetaSugerida | undefined;
  pendiente: boolean;
  /** Selector del control que se enfoca con «Editar». */
  selector: string;
  onAceptar: (campo: CampoSugerible) => void;
  onQuitar: (campo: CampoSugerible) => void;
}

/** Marca «Sugerido» de un campo pre-llenado, con sus fuentes, su confianza y Aceptar, Editar o Quitar. */
export function BarraSugerida({ campo, meta, pendiente, selector, onAceptar, onQuitar }: Props) {
  if (!meta) return null;
  const nombre = NOMBRE_CAMPO[campo];
  if (!pendiente) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm text-contexto" data-sugerido={campo} data-estado="aceptado">
        <span className="font-medium">Aceptado: {nombre}</span>
        <ChipsFuentes fuentes={meta.fuentes} />
      </div>
    );
  }
  return (
    <div className={`flex flex-col gap-2 rounded-md border p-3 ${ESTILO_SALUD.amarillo}`} data-sugerido={campo} data-estado="pendiente">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="rounded-full border border-current px-2.5 py-0.5 text-sm font-medium">Sugerido</span>
        <Confianza valor={meta.confianza} />
      </div>
      <div className="text-tinta">
        <ChipsFuentes fuentes={meta.fuentes} />
      </div>
      {meta.motivo && <p className="text-sm text-tinta">{meta.motivo}</p>}
      <div className="flex flex-wrap gap-2 text-tinta">
        <button type="button" className={BOTON_PEQUENO} aria-label={`Aceptar ${nombre}`} onClick={() => onAceptar(campo)}>
          Aceptar
        </button>
        <button
          type="button"
          className={BOTON_PEQUENO}
          aria-label={`Editar ${nombre}`}
          onClick={() => document.querySelector<HTMLElement>(selector)?.focus()}
        >
          Editar
        </button>
        <button type="button" className={BOTON_PEQUENO} aria-label={`Quitar ${nombre}`} onClick={() => onQuitar(campo)}>
          Quitar
        </button>
      </div>
    </div>
  );
}
