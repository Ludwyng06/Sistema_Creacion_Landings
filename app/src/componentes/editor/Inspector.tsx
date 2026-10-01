"use client";

import { useState, type ReactNode } from "react";
import type { Brief, LandingDoc, Seccion } from "@/lib/contratos";
import { Icono } from "@/componentes/Icono";
import { campoDeVariante, conVariante, tieneVariantes, varianteActual, variantesDe } from "@/secciones/catalogo-variantes";
import {
  ALINEACIONES,
  DISPOSITIVOS_VISIBILIDAD,
  ESPACIADOS,
  FONDOS,
  PESOS_TITULAR,
  conPresentacion,
  leerPresentacion,
  normalizarAncla,
  type DispositivoVisibilidad,
} from "@/secciones/presentacion";
import { registro } from "@/secciones/registro";
import { BOTON_PEQUENO, BOTON_SECUNDARIO, CLASE_CONTROL } from "../crear/estilos";
import type { ContextoSlots } from "./ControlCampo";
import { Diferido } from "./Diferido";
import { PanelAjustes } from "./PanelAjustes";
import { PanelEfectos } from "./PanelEfectos";
import { PanelSalud } from "./PanelSalud";
import { PanelTema } from "./PanelTema";
import { motivoNoEliminar, type AccionEditor } from "./estado-editor";
import { MiniaturaSeccion } from "./MiniaturaSeccion";
import { SelectorTamano } from "./SelectorTamano";
import { nombreDeVariante } from "./ModalAgregarSeccion";

/** Instrucciones de los botones rápidos del grupo IA (van a `regenerar-seccion` como instrucción libre). */
export const INSTRUCCIONES_IA = {
  corto: "Hazlo más corto: menos palabras, misma idea y mismos datos del brief.",
  directo: "Hazlo más directo: empieza por el beneficio y quita los rodeos.",
  angulo: "Cambia el ángulo: cuenta lo mismo desde otro punto de vista, sin inventar datos.",
} as const;

const NOMBRE_FONDO = { ninguno: "Sin fondo", superficie: "Superficie", acento: "Acento" } as const;
const NOMBRE_ALINEACION = { auto: "Según la sección", izquierda: "Izquierda", centro: "Centro" } as const;
const NOMBRE_ESPACIADO = { compacto: "Compacto", normal: "Normal", amplio: "Amplio" } as const;
const NOMBRE_PESO = { heredado: "Heredado", normal: "Normal", medio: "Medio", semi: "Seminegrita", negrita: "Negrita" } as const;
const NOMBRE_DISPOSITIVO: Record<DispositivoVisibilidad, string> = { movil: "Móvil", tablet: "Tablet", escritorio: "Escritorio" };

function Grupo({ id, titulo, abierto = false, children }: { id: string; titulo: string; abierto?: boolean; children: ReactNode }) {
  return (
    <details open={abierto} data-grupo-inspector={id} className="group rounded-md border border-linea bg-papel">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-marca">
        {titulo}
        <Icono nombre="flecha-abajo" className="size-4 text-tinta-suave transition-transform group-open:rotate-180" />
      </summary>
      <div className="flex flex-col gap-4 border-t border-linea p-3">{children}</div>
    </details>
  );
}

function Segmentado<T extends string>({ etiqueta, opciones, valor, nombres, onCambio }: { etiqueta: string; opciones: readonly T[]; valor: T; nombres: Record<T, string>; onCambio: (v: T) => void }) {
  return (
    <div role="group" aria-label={etiqueta} className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{etiqueta}</span>
      <div className="grid auto-cols-fr grid-flow-col gap-1">
        {opciones.map((o) => (
          <button
            key={o}
            type="button"
            aria-pressed={valor === o}
            onClick={() => onCambio(o)}
            className="min-h-11 rounded-md border border-linea px-1.5 text-xs aria-pressed:border-marca aria-pressed:bg-marca aria-pressed:text-marca-texto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca"
          >
            {nombres[o]}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Selector visual de variantes: una miniatura del `ejemplo.ts` de cada una; elegir una conserva el contenido. */
function SelectorVariante({ doc, seccion, onCambio }: { doc: LandingDoc; seccion: Seccion; onCambio: (s: Seccion) => void }) {
  const actual = varianteActual(seccion);
  return (
    <div role="group" aria-label="Variante" data-selector-variante className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">Variante</span>
      <ul className="grid grid-cols-2 gap-2">
        {variantesDe(seccion.tipo).map((v) => (
          <li key={v.clave}>
            <div
              role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (e.currentTarget as HTMLElement).click(); } }}
              data-variante={v.clave}
              aria-pressed={actual === v.clave}
              onClick={() => onCambio(conVariante(seccion, v.clave))}
              className="flex w-full flex-col gap-1 rounded-md border border-linea p-1 text-left aria-pressed:border-marca aria-pressed:ring-2 aria-pressed:ring-marca hover:border-marca focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca"
            >
              <MiniaturaSeccion doc={doc} seccion={v.seccion} assets={v.assets} ancho={130} alto={84} etiqueta={`Vista previa de la variante ${nombreDeVariante(v.clave)}`} />
              <span className="truncate text-xs">{nombreDeVariante(v.clave)}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface Props {
  doc: LandingDoc;
  brief: Brief;
  seccion: Seccion | null;
  slots: ContextoSlots;
  bloqueSeleccionado: string | null;
  soloTextos: boolean;
  onAccion: (a: AccionEditor) => void;
  onCambioSeccion: (seccion: Seccion, clave: string) => void;
  onRegenerar: (instruccion: string, etiqueta?: string) => void;
  regenerando: boolean;
  /** Qué acción de IA está corriendo (para rotular su botón). */
  regenerandoEtiqueta?: string | null;
  errorRegenerar: string | null;
  /** Aviso tras una acción de IA terminada, con la opción de deshacerla. */
  mensajeRegenerar?: string | null;
  onDeshacerIA?: () => void;
  onCorregir: () => void;
  corrigiendo: boolean;
  mensajeCorreccion: string | null;
  errorCorreccion: string | null;
}

/**
 * Configuración (§11.4): solo lo de lo seleccionado, en grupos plegables. Contenido (abierto), Diseño, Espaciado,
 * Visibilidad, IA, Efectos y Avanzado. Sin selección muestra el Tema y la salud de la landing.
 */
export function Inspector(p: Props) {
  const { seccion, doc } = p;
  const [instruccion, setInstruccion] = useState("");

  if (!seccion) {
    return (
      <div className="flex flex-col gap-6" data-inspector="tema">
        <PanelTema doc={doc} brief={p.brief} onAccion={p.onAccion} />
        <Diferido alto={260}>
          <PanelSalud doc={doc} brief={p.brief} onCorregir={p.onCorregir} corrigiendo={p.corrigiendo} mensajeCorreccion={p.mensajeCorreccion} errorCorreccion={p.errorCorreccion} />
        </Diferido>
      </div>
    );
  }

  const def = registro[seccion.tipo];
  const presentacion = leerPresentacion(seccion.ajustes);
  const cambiarPresentacion = (cambios: Partial<typeof presentacion>, clave: string) => p.onCambioSeccion(conPresentacion(seccion, cambios), `presentacion.${clave}`);
  const motivoEliminar = motivoNoEliminar(doc, seccion);
  const editada = (seccion.editadoPorHumano?.length ?? 0) > 0;

  return (
    <div className="flex flex-col gap-3" data-inspector="seccion" data-inspector-seccion={seccion.id}>
      <header>
        <h2 className="font-editorial text-xl font-semibold">
          {def?.etiqueta ?? seccion.tipo}
          {editada && (
            <span className="ml-2 inline-flex items-center gap-1 text-xs font-normal text-marca" data-editado>
              <span aria-hidden="true" className="size-2 rounded-full bg-marca" />
              Editado a mano
            </span>
          )}
        </h2>
        {!seccion.visible && <p className="mt-1 text-sm text-tinta-suave">Esta sección está oculta en la landing.</p>}
      </header>

      <Grupo id="contenido" titulo="Contenido" abierto>
        <PanelAjustes seccion={seccion} slots={p.slots} onCambio={p.onCambioSeccion} bloqueSeleccionado={p.bloqueSeleccionado} soloTextos={p.soloTextos} />
      </Grupo>

      {!p.soloTextos && (
        <>
          <Grupo id="diseno" titulo="Diseño">
            {tieneVariantes(seccion.tipo) && <SelectorVariante doc={doc} seccion={seccion} onCambio={(s) => p.onCambioSeccion(s, campoDeVariante(seccion.tipo) === "variante" ? "variante" : "ajustes.disposicion")} />}
            <Segmentado etiqueta="Fondo" opciones={FONDOS} valor={presentacion.fondo} nombres={NOMBRE_FONDO} onCambio={(fondo) => cambiarPresentacion({ fondo }, "fondo")} />
            <Segmentado etiqueta="Alineación" opciones={ALINEACIONES} valor={presentacion.alineacion} nombres={NOMBRE_ALINEACION} onCambio={(alineacion) => cambiarPresentacion({ alineacion }, "alineacion")} />
            <div className="flex flex-col gap-3 border-t border-linea pt-3" data-tamanos-seccion>
              <h4 className="text-sm font-semibold">Tamaño de letra de esta sección</h4>
              <SelectorTamano conHeredado clave="titular" etiqueta="Titular" valor={presentacion.tamTitular} onCambio={(tamTitular) => cambiarPresentacion({ tamTitular }, "tamTitular")} />
              <SelectorTamano conHeredado clave="subtitulo" etiqueta="Subtítulo" valor={presentacion.tamSubtitulo} onCambio={(tamSubtitulo) => cambiarPresentacion({ tamSubtitulo }, "tamSubtitulo")} />
              <SelectorTamano conHeredado clave="texto" etiqueta="Texto" valor={presentacion.tamTexto} onCambio={(tamTexto) => cambiarPresentacion({ tamTexto }, "tamTexto")} />
              <Segmentado etiqueta="Peso del titular" opciones={PESOS_TITULAR} valor={presentacion.pesoTitular} nombres={NOMBRE_PESO} onCambio={(pesoTitular) => cambiarPresentacion({ pesoTitular }, "pesoTitular")} />
              <p className="text-xs text-tinta-suave">El texto del cuerpo nunca baja de 16 px. Para un solo texto: doble clic en la vista previa y usa − y +.</p>
            </div>
          </Grupo>

          <Grupo id="espaciado" titulo="Espaciado">
            <Segmentado etiqueta="Aire arriba y abajo" opciones={ESPACIADOS} valor={presentacion.espaciado} nombres={NOMBRE_ESPACIADO} onCambio={(espaciado) => cambiarPresentacion({ espaciado }, "espaciado")} />
          </Grupo>

          <Grupo id="visibilidad" titulo="Visibilidad">
            <button
              type="button"
              role="switch"
              aria-checked={seccion.visible}
              onClick={() => p.onAccion({ tipo: "alternar-visible", id: seccion.id })}
              className="inline-flex min-h-11 items-center gap-3 text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca"
            >
              <span aria-hidden="true" className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${seccion.visible ? "bg-marca" : "bg-linea"}`}>
                <span className={`absolute top-0.5 size-5 rounded-full bg-papel transition-all ${seccion.visible ? "left-[1.375rem]" : "left-0.5"}`} />
              </span>
              Sección visible
            </button>
            <fieldset className="flex flex-col gap-1">
              <legend className="mb-1 text-sm font-medium">Mostrar en</legend>
              {DISPOSITIVOS_VISIBILIDAD.map((d) => {
                const oculta = presentacion.ocultarEn.includes(d);
                return (
                  <label key={d} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 accent-marca"
                      checked={!oculta}
                      onChange={() => cambiarPresentacion({ ocultarEn: oculta ? presentacion.ocultarEn.filter((x) => x !== d) : [...presentacion.ocultarEn, d] }, "ocultarEn")}
                    />
                    {NOMBRE_DISPOSITIVO[d]}
                  </label>
                );
              })}
            </fieldset>
          </Grupo>

          <Grupo id="ia" titulo="IA">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Acciones de IA" aria-busy={p.regenerando}>
              {(
                [
                  ["Regenerar", "", "Regenerando…"],
                  ["Más corto", INSTRUCCIONES_IA.corto, "Acortando…"],
                  ["Más directo", INSTRUCCIONES_IA.directo, "Afinando…"],
                  ["Otro ángulo", INSTRUCCIONES_IA.angulo, "Buscando otro ángulo…"],
                ] as const
              ).map(([nombre, texto, enCurso]) => (
                <button
                  key={nombre}
                  type="button"
                  className={BOTON_PEQUENO}
                  disabled={p.regenerando}
                  data-ia-rapida={nombre}
                  aria-busy={p.regenerandoEtiqueta === nombre}
                  onClick={() => p.onRegenerar(texto, nombre)}
                >
                  {p.regenerandoEtiqueta === nombre ? enCurso : nombre}
                </button>
              ))}
            </div>
            <label htmlFor="regenerar-instruccion" className="text-sm text-tinta-suave">
              Instrucción libre
            </label>
            <textarea id="regenerar-instruccion" rows={2} maxLength={500} className={CLASE_CONTROL} placeholder="Por ejemplo: más directo y con un dato del brief" value={instruccion} onChange={(e) => setInstruccion(e.target.value)} />
            <p className="text-xs text-tinta-suave" data-ia-nota>
              {editada
                ? `Respeta lo que editaste a mano (${seccion.editadoPorHumano!.length} ${seccion.editadoPorHumano!.length === 1 ? "campo" : "campos"}): esos textos no se tocan. `
                : "Respeta lo que edites a mano: esos textos no se tocan. "}
              Antes de cambiar la sección se guarda una versión y puedes deshacerlo.
            </p>
            <button
              type="button"
              className={`${BOTON_SECUNDARIO} self-start`}
              disabled={p.regenerando || !instruccion.trim()}
              data-ia-instruccion
              aria-busy={p.regenerandoEtiqueta === "Instrucción"}
              onClick={() => p.onRegenerar(instruccion, "Instrucción")}
            >
              {p.regenerandoEtiqueta === "Instrucción" ? "Aplicando…" : "Aplicar instrucción"}
            </button>
            {p.regenerando && (
              <p role="status" className="text-sm text-tinta-suave" data-ia-cargando>
                La IA está reescribiendo esta sección…
              </p>
            )}
            {p.mensajeRegenerar && !p.regenerando && (
              <p role="status" className="flex flex-wrap items-center gap-2 text-sm text-contexto" data-ia-listo>
                {p.mensajeRegenerar}
                {p.onDeshacerIA && (
                  <button type="button" className="text-marca underline" onClick={p.onDeshacerIA} data-ia-deshacer>
                    Deshacer
                  </button>
                )}
              </p>
            )}
            {p.errorRegenerar && (
              <p role="alert" className="text-sm text-error">
                {p.errorRegenerar}
              </p>
            )}
          </Grupo>

          <Grupo id="efectos" titulo="Efectos">
            <Diferido alto={200}>
              <PanelEfectos doc={doc} seccion={seccion} onAccion={p.onAccion} />
            </Diferido>
          </Grupo>

          <Grupo id="avanzado" titulo="Avanzado">
            <label className="flex flex-col gap-1 text-sm font-medium" htmlFor="avanzado-ancla">
              Ancla
              <input
                id="avanzado-ancla"
                className={`${CLASE_CONTROL} font-mono text-sm`}
                value={presentacion.ancla}
                maxLength={40}
                placeholder="por-ejemplo-precios"
                onChange={(e) => cambiarPresentacion({ ancla: normalizarAncla(e.target.value) }, "ancla")}
              />
              <span className="text-xs font-normal text-tinta-suave">{presentacion.ancla ? `Enlaza a esta sección con #${presentacion.ancla}.` : "Un nombre corto para enlazar a esta sección desde un botón o un enlace."}</span>
            </label>
          </Grupo>

          <button
            type="button"
            data-eliminar-seccion
            aria-disabled={motivoEliminar ? true : undefined}
            title={motivoEliminar ?? "Eliminar la sección"}
            onClick={() => {
              if (!motivoEliminar) p.onAccion({ tipo: "eliminar", id: seccion.id });
            }}
            className={`${BOTON_PEQUENO} gap-2 self-start border-error text-error ${motivoEliminar ? "cursor-not-allowed opacity-40" : ""}`}
          >
            <Icono nombre="papelera" className="size-4" />
            Eliminar sección
          </button>
          {motivoEliminar && <p className="text-xs text-tinta-suave">{motivoEliminar}</p>}
        </>
      )}
    </div>
  );
}
