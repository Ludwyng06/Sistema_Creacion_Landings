"use client";

import { useMemo, useState } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { LandingDoc, Seccion } from "@/lib/contratos";
import { Icono } from "@/componentes/Icono";
import { METAS } from "@/secciones/metas";
import { registro } from "@/secciones/registro";
import { BOTON_PEQUENO } from "../crear/estilos";
import { ajustesDeBloqueNuevo, generarFormulario } from "./esquema-form";
import { conBloqueNuevo, motivoNoDuplicar, motivoNoEliminar, MAX_SECCIONES, type AccionEditor } from "./estado-editor";
import { GRUPOS, NOMBRE_GRUPO, destinoEnGrupo, seccionesDelGrupo, type Grupo } from "./grupos";

interface Props {
  doc: LandingDoc;
  seleccion: string | null;
  bloqueSeleccionado: string | null;
  onAccion: (accion: AccionEditor) => void;
  onSeleccionarBloque: (seccionId: string, bloqueId: string) => void;
  onCambioSeccion: (seccion: Seccion, clave: string) => void;
  onAgregarSeccion: () => void;
  onTema: () => void;
  temaActivo: boolean;
  /** Ids de las secciones con el puntero encima en la vista previa. */
  resaltada: string | null;
  onResaltar: (id: string | null) => void;
}

/** Botón con motivo: si no se puede, queda `aria-disabled` y el motivo va en el tooltip y en el lector de pantalla. */
function BotonAccion({ etiqueta, motivo, onClick, children, presionado }: { etiqueta: string; motivo: string | null; onClick: () => void; children: React.ReactNode; presionado?: boolean }) {
  return (
    <button
      type="button"
      className={`${BOTON_PEQUENO} ${motivo ? "cursor-not-allowed opacity-40" : ""}`}
      aria-label={motivo ? `${etiqueta}: no disponible. ${motivo}` : etiqueta}
      aria-disabled={motivo ? true : undefined}
      aria-pressed={presionado}
      title={motivo ?? etiqueta}
      onClick={() => {
        if (!motivo) onClick();
      }}
    >
      {children}
    </button>
  );
}

/** Texto corto que identifica a un bloque: su primer texto (título, pregunta, paso…) o «Etiqueta N». */
export function nombreDeBloque(tipoSeccion: Seccion["tipo"], bloque: Seccion["bloques"][number], indice: number): string {
  const etiqueta = METAS[tipoSeccion]?.bloques[bloque.tipo]?.etiqueta ?? bloque.tipo;
  const texto = Object.values(bloque.ajustes).find((v): v is string => typeof v === "string" && v.trim().length > 0 && !v.startsWith("/") && v.length > 1);
  const corto = texto ? (texto.length > 28 ? `${texto.slice(0, 27).trimEnd()}…` : texto) : "";
  return corto ? `${etiqueta} ${indice + 1}: ${corto}` : `${etiqueta} ${indice + 1}`;
}

function Fila({
  seccion,
  doc,
  seleccionada,
  bloqueSeleccionado,
  resaltada,
  onAccion,
  onSeleccionarBloque,
  onCambioSeccion,
  onResaltar,
}: {
  seccion: Seccion;
  doc: LandingDoc;
  seleccionada: boolean;
  bloqueSeleccionado: string | null;
  resaltada: boolean;
  onAccion: (a: AccionEditor) => void;
  onSeleccionarBloque: Props["onSeleccionarBloque"];
  onCambioSeccion: Props["onCambioSeccion"];
  onResaltar: Props["onResaltar"];
}) {
  const fijo = seccion.tipo === "heroe";
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: seccion.id, disabled: fijo });
  const [abierta, setAbierta] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const motivoEliminar = motivoNoEliminar(doc, seccion);
  const motivoDuplicar = motivoNoDuplicar(doc, seccion);
  const etiqueta = registro[seccion.tipo]?.etiqueta ?? seccion.tipo;
  const editada = (seccion.editadoPorHumano?.length ?? 0) > 0;
  const formulario = useMemo(() => (registro[seccion.tipo] ? generarFormulario(registro[seccion.tipo]!.schema, METAS[seccion.tipo]) : null), [seccion.tipo]);
  const bloqueForm = formulario?.bloques[0];
  const hayBloques = Boolean(bloqueForm) && (seccion.bloques.length > 0 || (bloqueForm?.max ?? 0) > 0);
  const subir = destinoEnGrupo(doc, seccion.id, -1);
  const bajar = destinoEnGrupo(doc, seccion.id, 1);
  const desplegada = abierta || seleccionada;

  return (
    <li
      ref={setNodeRef}
      data-fila-seccion={seccion.id}
      onMouseEnter={() => onResaltar(seccion.id)}
      onMouseLeave={() => onResaltar(null)}
      style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined, transition }}
      className={`rounded-md border bg-papel ${seleccionada ? "border-marca bg-papel-hondo" : resaltada ? "border-tinta-suave" : "border-linea"} ${isDragging ? "z-10 shadow-lg" : ""} ${seccion.visible ? "" : "border-dashed"}`}
    >
      <div className="flex items-center gap-0.5 p-0.5">
        <button
          type="button"
          {...attributes}
          {...listeners}
          disabled={fijo}
          aria-label={fijo ? `${etiqueta}: fijo arriba de la plantilla` : `Arrastrar ${etiqueta}. Con teclado: espacio para tomarla, flechas para moverla`}
          title={fijo ? "El héroe queda fijo arriba de la plantilla." : "Arrastrar para reordenar"}
          className={`${BOTON_PEQUENO} min-w-9 cursor-grab touch-none border-transparent px-1.5`}
        >
          <Icono nombre={fijo ? "candado" : "arrastre"} className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => onAccion({ tipo: "seleccionar", id: seccion.id })}
          aria-current={seleccionada ? "true" : undefined}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-md px-1 text-left text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca"
        >
          <Icono nombre={registro[seccion.tipo]?.icono ?? "check"} className="size-4 shrink-0 text-tinta-suave" />
          <span className="truncate">{etiqueta}</span>
          {!seccion.visible && <span className="shrink-0 rounded-full border border-tinta-suave px-1.5 text-xs font-normal text-tinta-suave">Oculta</span>}
          {editada && <span aria-label="Editado a mano" title="Editado a mano" className="size-2 shrink-0 rounded-full bg-marca" />}
        </button>
        {hayBloques && (
          <button
            type="button"
            className={`${BOTON_PEQUENO} min-w-9 border-transparent px-1.5`}
            aria-expanded={desplegada}
            aria-label={`${desplegada ? "Plegar" : "Desplegar"} los bloques de ${etiqueta}`}
            onClick={() => setAbierta((v) => !v)}
          >
            <Icono nombre={desplegada ? "flecha-arriba" : "flecha-abajo"} className="size-4" />
          </button>
        )}
      </div>

      {desplegada && hayBloques && bloqueForm && (
        <ul className="flex flex-col gap-0.5 border-t border-linea px-2 py-1" data-bloques-de={seccion.id}>
          {seccion.bloques.map((b, i) => (
            <li key={b.id}>
              <button
                type="button"
                data-bloque-fila={b.id}
                aria-current={bloqueSeleccionado === b.id ? "true" : undefined}
                onClick={() => onSeleccionarBloque(seccion.id, b.id)}
                className="flex min-h-9 w-full items-center gap-2 rounded-md pl-3 pr-1 text-left text-sm aria-[current=true]:bg-marca aria-[current=true]:text-marca-texto hover:bg-papel-hondo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca"
              >
                <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-tinta-suave" />
                <span className="truncate">{nombreDeBloque(seccion.tipo, b, i)}</span>
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              data-anadir-bloque={seccion.id}
              disabled={seccion.bloques.length >= bloqueForm.max}
              title={seccion.bloques.length >= bloqueForm.max ? `Máximo ${bloqueForm.max} ${bloqueForm.etiqueta.toLowerCase()}` : undefined}
              onClick={() => onCambioSeccion(conBloqueNuevo(seccion, bloqueForm.tipo, ajustesDeBloqueNuevo(bloqueForm), bloqueForm.max), "")}
              className="flex min-h-9 w-full items-center gap-2 rounded-md pl-3 text-left text-sm text-marca hover:bg-papel-hondo disabled:cursor-not-allowed disabled:text-tinta-suave disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca"
            >
              <Icono nombre="mas" className="size-4" />
              Añadir {bloqueForm.etiqueta.toLowerCase()}
            </button>
          </li>
        </ul>
      )}

      {seleccionada && (
        <div className="flex flex-wrap items-center gap-1 border-t border-linea p-1" role="group" aria-label={`Acciones de ${etiqueta}`}>
          <BotonAccion etiqueta={`Subir ${etiqueta}`} motivo={fijo ? "El héroe queda fijo arriba de la plantilla." : subir === null ? "Ya es la primera de su grupo." : null} onClick={() => onAccion({ tipo: "mover-en-grupo", id: seccion.id, paso: -1 })}>
            <Icono nombre="flecha-arriba" className="size-4" />
          </BotonAccion>
          <BotonAccion etiqueta={`Bajar ${etiqueta}`} motivo={fijo ? "El héroe queda fijo arriba de la plantilla." : bajar === null ? "Ya es la última de su grupo." : null} onClick={() => onAccion({ tipo: "mover-en-grupo", id: seccion.id, paso: 1 })}>
            <Icono nombre="flecha-abajo" className="size-4" />
          </BotonAccion>
          <BotonAccion etiqueta={seccion.visible ? `Ocultar ${etiqueta}` : `Mostrar ${etiqueta}`} motivo={null} presionado={!seccion.visible} onClick={() => onAccion({ tipo: "alternar-visible", id: seccion.id })}>
            <Icono nombre={seccion.visible ? "ojo" : "ojo-cerrado"} className="size-4" />
          </BotonAccion>
          <BotonAccion etiqueta={`Duplicar ${etiqueta}`} motivo={motivoDuplicar} onClick={() => onAccion({ tipo: "duplicar", id: seccion.id })}>
            <Icono nombre="copiar" className="size-4" />
          </BotonAccion>
          {confirmando ? (
            <span className="flex items-center gap-1 text-sm" role="group" aria-label={`Confirmar eliminar ${etiqueta}`}>
              ¿Eliminar?
              <button type="button" className={`${BOTON_PEQUENO} border-error text-error`} onClick={() => { setConfirmando(false); onAccion({ tipo: "eliminar", id: seccion.id }); }}>
                Sí
              </button>
              <button type="button" className={BOTON_PEQUENO} onClick={() => setConfirmando(false)}>
                No
              </button>
            </span>
          ) : (
            <BotonAccion etiqueta={`Eliminar ${etiqueta}`} motivo={motivoEliminar} onClick={() => setConfirmando(true)}>
              <Icono nombre="papelera" className="size-4" />
            </BotonAccion>
          )}
        </div>
      )}
    </li>
  );
}

/**
 * Árbol de la landing (§11.1): grupos Encabezado, Plantilla, Pie y Fijos; cada sección se despliega y muestra sus
 * bloques, con «Añadir bloque» limitado por el schema. Se arrastra (o se mueve con teclado) solo dentro del grupo.
 */
export function PanelSecciones({ doc, seleccion, bloqueSeleccionado, onAccion, onSeleccionarBloque, onCambioSeccion, onAgregarSeccion, onTema, temaActivo, resaltada, onResaltar }: Props) {
  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  function alSoltar({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const desde = doc.secciones.findIndex((s) => s.id === active.id);
    const hasta = doc.secciones.findIndex((s) => s.id === over.id);
    if (desde >= 0 && hasta >= 0) onAccion({ tipo: "reordenar", desde, hasta });
  }

  const grupos = GRUPOS.map((g) => ({ grupo: g, filas: seccionesDelGrupo(doc, g) })).filter((g) => g.filas.length > 0 || g.grupo === "plantilla");

  return (
    <section aria-labelledby="titulo-secciones" className="flex flex-col gap-3" data-lista-secciones>
      <h2 id="titulo-secciones" className="font-editorial text-lg font-semibold">
        Secciones <span className="text-sm font-normal text-tinta-suave">({doc.secciones.length} de {MAX_SECCIONES})</span>
      </h2>
      <DndContext id="arbol-secciones" sensors={sensores} collisionDetection={closestCenter} onDragEnd={alSoltar}>
        {grupos.map(({ grupo, filas }) => (
          <div key={grupo} data-grupo={grupo} className="flex flex-col gap-1.5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-tinta-suave">{NOMBRE_GRUPO[grupo as Grupo]}</h3>
            <SortableContext items={filas.map((f) => f.seccion.id)} strategy={verticalListSortingStrategy}>
              <ol className="flex flex-col gap-1.5">
                {filas.map(({ seccion }) => (
                  <Fila
                    key={seccion.id}
                    seccion={seccion}
                    doc={doc}
                    seleccionada={seccion.id === seleccion}
                    bloqueSeleccionado={bloqueSeleccionado}
                    resaltada={resaltada === seccion.id}
                    onAccion={onAccion}
                    onSeleccionarBloque={onSeleccionarBloque}
                    onCambioSeccion={onCambioSeccion}
                    onResaltar={onResaltar}
                  />
                ))}
              </ol>
            </SortableContext>
            {grupo === "plantilla" && (
              <button
                type="button"
                data-anadir-seccion
                onClick={onAgregarSeccion}
                className="flex min-h-11 items-center gap-2 rounded-md border border-dashed border-linea px-3 text-sm font-medium text-marca hover:bg-papel-hondo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca"
              >
                <Icono nombre="mas" className="size-4" />
                Añadir sección
              </button>
            )}
          </div>
        ))}
      </DndContext>

      <div className="border-t border-linea pt-3">
        <button
          type="button"
          data-abrir-tema
          aria-current={temaActivo ? "true" : undefined}
          onClick={onTema}
          className="flex min-h-11 w-full items-center gap-2 rounded-md border border-linea px-3 text-left text-sm font-medium aria-[current=true]:border-marca aria-[current=true]:bg-papel-hondo hover:bg-papel-hondo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca"
        >
          <Icono nombre="paleta" className="size-4 text-tinta-suave" />
          Tema
        </button>
      </div>
    </section>
  );
}
