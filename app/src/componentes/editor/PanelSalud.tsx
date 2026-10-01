"use client";

import { useEffect, useState } from "react";
import type { Brief, LandingDoc, ResultadoValidador } from "@/lib/contratos";
import { validarTodo } from "@/lib/validadores";
import { NOMBRE_SALUD, NOMBRE_VALIDADOR } from "../crear/construccion";
import { BOTON_SECUNDARIO, ESTILO_SALUD, MARCA_SALUD } from "../crear/estilos";

export const ESPERA_SALUD_MS = 500;

interface Props {
  doc: LandingDoc;
  brief: Brief;
  onCorregir: () => void;
  corrigiendo: boolean;
  mensajeCorreccion: string | null;
  errorCorreccion: string | null;
}

/** Los 8 validadores con debounce: se recalculan 500 ms después del último cambio. */
export function PanelSalud({ doc, brief, onCorregir, corrigiendo, mensajeCorreccion, errorCorreccion }: Props) {
  const [salud, setSalud] = useState<ResultadoValidador[]>(() => validarTodo(doc, brief).salud);

  useEffect(() => {
    const espera = setTimeout(() => setSalud(validarTodo(doc, brief).salud), ESPERA_SALUD_MS);
    return () => clearTimeout(espera);
  }, [doc, brief]);

  const listaNegraRoja = salud.find((v) => v.id === "lista-negra")?.estado === "rojo";
  const conProblemas = salud.filter((v) => v.problemas.length > 0);

  return (
    <section aria-labelledby="titulo-salud" className="flex flex-col gap-3" data-panel-salud>
      <h2 id="titulo-salud" className="font-editorial text-lg font-semibold">
        Salud de la landing
      </h2>
      <ul className="flex flex-wrap gap-2" aria-label="Validadores">
        {salud.map((v) => (
          <li key={v.id} data-validador={v.id} data-estado={v.estado} title={v.problemas.map((p) => p.mensaje).join("\n") || undefined} className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${ESTILO_SALUD[v.estado]}`}>
            <span aria-hidden="true">{MARCA_SALUD[v.estado]}</span>
            {NOMBRE_VALIDADOR[v.id]}
            <span className="sr-only">: {NOMBRE_SALUD[v.estado]}</span>
          </li>
        ))}
      </ul>

      {conProblemas.length > 0 && (
        <details className="rounded-md border border-linea p-3">
          <summary className="min-h-9 cursor-pointer text-sm font-medium">Ver problemas ({conProblemas.reduce((n, v) => n + v.problemas.length, 0)})</summary>
          <ul className="mt-2 flex flex-col gap-2 text-sm">
            {conProblemas.flatMap((v) =>
              v.problemas.map((p, i) => (
                <li key={`${v.id}-${i}`}>
                  <strong>{NOMBRE_VALIDADOR[v.id]}</strong> · <code className="text-xs">{p.ruta}</code>: {p.mensaje}
                </li>
              )),
            )}
          </ul>
        </details>
      )}

      {listaNegraRoja && (
        <div>
          <button type="button" className={BOTON_SECUNDARIO} disabled={corrigiendo} onClick={onCorregir}>
            {corrigiendo ? "Corrigiendo…" : "Corregir infracciones"}
          </button>
        </div>
      )}
      <p role="status" aria-live="polite" className="text-sm text-tinta-suave">
        {mensajeCorreccion}
      </p>
      {errorCorreccion && (
        <p role="alert" className="text-sm text-error">
          {errorCorreccion}
        </p>
      )}
    </section>
  );
}
