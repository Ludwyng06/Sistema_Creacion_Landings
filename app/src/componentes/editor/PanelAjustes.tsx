"use client";

import { useEffect, useMemo } from "react";
import type { Seccion } from "@/lib/contratos";
import { registro } from "@/secciones/registro";
import { METAS } from "@/secciones/metas";
import { campoDeVariante, tieneVariantes } from "@/secciones/catalogo-variantes";
import { BOTON_SECUNDARIO, BOTON_PEQUENO } from "../crear/estilos";
import { ControlCampo, type ContextoSlots } from "./ControlCampo";
import { ajustesDeBloqueNuevo, erroresDeSeccion, generarFormulario, type CampoForm } from "./esquema-form";
import { conAjuste, conAjusteDeBloque, conBloqueMovido, conBloqueNuevo, sinBloque } from "./estado-editor";

interface Props {
  seccion: Seccion;
  slots: ContextoSlots;
  onCambio: (seccion: Seccion, clave: string) => void;
  /** Bloque marcado en el árbol de secciones: se resalta y se lleva a la vista. */
  bloqueSeleccionado?: string | null;
  /** Pantallas chicas: solo los campos de texto, sin cambiar la estructura. */
  soloTextos?: boolean;
}

function PuntoEditado({ activo }: { activo: boolean }) {
  if (!activo) return null;
  return (
    <span className="ml-2 inline-flex items-center gap-1 text-xs font-normal text-marca" data-editado>
      <span aria-hidden="true" className="size-2 rounded-full bg-marca" />
      Editado a mano
    </span>
  );
}

export function PanelAjustes({ seccion, slots, onCambio, bloqueSeleccionado = null, soloTextos = false }: Props) {
  const definicion = registro[seccion.tipo];
  const formulario = useMemo(
    () => (definicion ? generarFormulario(definicion.schema, METAS[seccion.tipo]) : null),
    [definicion, seccion.tipo],
  );
  const errores = useMemo(() => (definicion ? erroresDeSeccion(definicion.schema, seccion) : {}), [definicion, seccion]);

  useEffect(() => {
    if (!bloqueSeleccionado) return;
    document.querySelector(`[data-bloque-id="${bloqueSeleccionado.replace(/[^A-Za-z0-9_-]/g, "")}"]`)?.scrollIntoView({ block: "nearest" });
  }, [bloqueSeleccionado]);

  if (!definicion || !formulario) {
    return <p className="text-sm text-tinta-suave">Este tipo de sección todavía no tiene ajustes en el editor.</p>;
  }

  const editados = new Set(seccion.editadoPorHumano ?? []);
  const bloqueForm = formulario.bloques[0];

  function campo(c: CampoForm, valor: unknown, alCambiar: (v: unknown) => void, id: string, ruta: string, error?: string) {
    return (
      <div key={id} data-campo={ruta}>
        <label htmlFor={id} className="mb-1 block text-sm font-medium">
          {c.etiqueta}
          {!c.requerido && <span className="font-normal text-tinta-suave"> (opcional)</span>}
          <PuntoEditado activo={editados.has(ruta)} />
        </label>
        {c.ayuda && <p className="mb-1 text-xs text-tinta-suave">{c.ayuda}</p>}
        <ControlCampo campo={c} valor={valor} onChange={alCambiar} id={id} error={error} slots={slots} />
        {error && (
          <p id={`${id}-error`} role="alert" className="mt-1 text-sm text-error">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5" data-panel-ajustes={seccion.tipo}>
      {formulario.ajustes
        // La disposición es la variante: se elige con miniaturas en «Diseño».
        .filter((c) => !(c.clave === campoDeVariante(seccion.tipo) && tieneVariantes(seccion.tipo)))
        .filter((c) => !soloTextos || c.clase === "texto" || c.clase === "textoLargo")
        .map((c) =>
        campo(
          c,
          seccion.ajustes[c.clave],
          (v) => onCambio(conAjuste(seccion, c.clave, v), `ajustes.${c.clave}`),
          `ajuste-${c.clave}`,
          `ajustes.${c.clave}`,
          errores[`ajustes.${c.clave}`],
        ),
      )}

      {formulario.admiteBloques && bloqueForm && !soloTextos && (
        <section aria-labelledby="bloques-titulo" className="flex flex-col gap-3 border-t border-linea pt-4">
          <h4 id="bloques-titulo" className="text-sm font-medium">
            {bloqueForm.etiqueta} ({seccion.bloques.length} de {bloqueForm.min === bloqueForm.max ? bloqueForm.max : `${bloqueForm.min} a ${bloqueForm.max}`})
          </h4>
          {errores.bloques && (
            <p role="alert" className="text-sm text-error">
              {errores.bloques}
            </p>
          )}
          <ol className="flex flex-col gap-3">
            {seccion.bloques.map((b, i) => (
              <li key={b.id}>
                <fieldset className={`rounded-md border p-3 ${bloqueSeleccionado === b.id ? "border-marca ring-2 ring-marca" : "border-linea"}`} data-bloque-id={b.id}>
                  <legend className="px-1 text-sm font-medium">
                    {bloqueForm.etiqueta} {i + 1}
                  </legend>
                  <div className="flex flex-col gap-4">
                    {bloqueForm.campos.map((c) =>
                      campo(
                        c,
                        b.ajustes[c.clave],
                        (v) => onCambio(conAjusteDeBloque(seccion, i, c.clave, v), `bloques.${b.id}.${c.clave}`),
                        `bloque-${b.id}-${c.clave}`,
                        `bloques[${i}].ajustes.${c.clave}`,
                        errores[`bloques.${i}.ajustes.${c.clave}`],
                      ),
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1" role="group" aria-label={`Acciones de ${bloqueForm.etiqueta.toLowerCase()} ${i + 1}`}>
                    <button type="button" className={BOTON_PEQUENO} disabled={i === 0} aria-label={`Subir ${bloqueForm.etiqueta.toLowerCase()} ${i + 1}`} onClick={() => onCambio(conBloqueMovido(seccion, i, i - 1), "")}>
                      <span aria-hidden="true">↑</span>
                    </button>
                    <button type="button" className={BOTON_PEQUENO} disabled={i === seccion.bloques.length - 1} aria-label={`Bajar ${bloqueForm.etiqueta.toLowerCase()} ${i + 1}`} onClick={() => onCambio(conBloqueMovido(seccion, i, i + 1), "")}>
                      <span aria-hidden="true">↓</span>
                    </button>
                    <button type="button" className={BOTON_PEQUENO} disabled={seccion.bloques.length <= bloqueForm.min} aria-label={`Quitar ${bloqueForm.etiqueta.toLowerCase()} ${i + 1}`} onClick={() => onCambio(sinBloque(seccion, i, bloqueForm.min), "")}>
                      <span aria-hidden="true">✕</span>
                    </button>
                  </div>
                </fieldset>
              </li>
            ))}
          </ol>
          <button
            type="button"
            className={`${BOTON_SECUNDARIO} self-start`}
            disabled={seccion.bloques.length >= bloqueForm.max}
            onClick={() =>
              onCambio(
                conBloqueNuevo(seccion, bloqueForm.tipo, ajustesDeBloqueNuevo(bloqueForm), bloqueForm.max),
                "",
              )
            }
          >
            Agregar {bloqueForm.etiqueta.toLowerCase()}
          </button>
        </section>
      )}

    </div>
  );
}
