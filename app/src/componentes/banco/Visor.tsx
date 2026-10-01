"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Icono } from "@/componentes/Icono";
import { BOTON_PEQUENO } from "@/componentes/crear/estilos";
import { AvisoGeneracion } from "@/componentes/entrega/AvisoGeneracion";
import { PanelEntrega } from "@/componentes/entrega/PanelEntrega";
import { hayAvisoGeneracion, useSenalGeneracion } from "@/lib/entrega/useSenalGeneracion";
import { BLOQUES_PROMPT, NOMBRE_TEMATICA } from "@/lib/banco";
import {
  DISPOSITIVOS,
  ETIQUETA_DISPOSITIVO,
  MEDIDA_DISPOSITIVO,
  escalaParaCaber,
  vecino,
  type Dispositivo,
  type ItemVisor,
} from "@/lib/visor";
import { ESTILO_BLOQUE, claseDePuntaje } from "./estilos";

/** Margen del marco del celular o de la tablet alrededor de la pantalla, en píxeles. */
const MARCO = 12;
const HUECO = 24;

const formatoPuntaje = (p: number) => p.toFixed(1).replace(".", ",");

interface Props {
  items: ItemVisor[];
  inicialId: string;
  dispositivoInicial?: Dispositivo;
  detallesInicial?: boolean;
  /** Panel de entrega desplegado al abrir (`?entrega=1`). */
  entregaInicial?: boolean;
}

/** Escala que hace caber un dispositivo en el espacio libre del escenario, medido con ResizeObserver. */
function useEscala(escenario: React.RefObject<HTMLElement | null>, medida: { ancho: number; alto: number } | null): number {
  const [escala, setEscala] = useState(1);
  useEffect(() => {
    const el = escenario.current;
    if (!el || !medida) return;
    const calcular = () => setEscala(escalaParaCaber(medida.ancho + MARCO * 2, medida.alto + MARCO * 2, el.clientWidth - HUECO * 2, el.clientHeight - HUECO * 2));
    calcular();
    if (typeof ResizeObserver === "undefined") return;
    const observador = new ResizeObserver(calcular);
    observador.observe(el);
    return () => observador.disconnect();
  }, [escenario, medida]);
  return medida ? escala : 1;
}

function SelectorDispositivo({ dispositivo, onCambio, claro = false }: { dispositivo: Dispositivo; onCambio: (d: Dispositivo) => void; claro?: boolean }) {
  return (
    <div role="group" aria-label="Dispositivo" className="flex gap-1" data-selector-dispositivo>
      {DISPOSITIVOS.map((d) => (
        <button
          key={d}
          type="button"
          aria-pressed={dispositivo === d}
          data-dispositivo={d}
          onClick={() => onCambio(d)}
          className={`inline-flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca ${
            dispositivo === d
              ? "border-marca bg-marca text-marca-texto"
              : claro
                ? "border-papel/40 text-papel hover:bg-papel/20"
                : "border-linea text-tinta hover:bg-papel-hondo"
          }`}
        >
          <Icono nombre={d} className="size-5" />
          <span className={claro ? "sr-only" : "max-sm:sr-only"}>{ETIQUETA_DISPOSITIVO[d]}</span>
        </button>
      ))}
    </div>
  );
}

function PanelDetalles({ item }: { item: ItemVisor }) {
  const critica = item.critica;
  return (
    <div className="flex flex-col gap-3" data-panel-detalles>
      <details open className="rounded-md border border-linea bg-papel p-3">
        <summary className="min-h-11 cursor-pointer font-medium">Prompt de 4 bloques</summary>
        <div className="mt-2 flex flex-col gap-3">
          {BLOQUES_PROMPT.map((b) => {
            const e = ESTILO_BLOQUE[b];
            return (
              <section key={b} data-bloque={b} className={`rounded-sm border-l-4 p-3 ${e.caja}`}>
                <h3 className={`text-sm font-semibold ${e.titulo}`}>{e.nombre}</h3>
                <p tabIndex={0} aria-label={`Texto del bloque ${e.nombre}`} className="mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap text-sm leading-snug focus-visible:outline-2 focus-visible:outline-marca">
                  {item.prompt[b]}
                </p>
              </section>
            );
          })}
        </div>
      </details>

      <details className="rounded-md border border-linea bg-papel p-3" data-critico>
        <summary className="min-h-11 cursor-pointer font-medium">
          Informe del crítico{" "}
          <span className={`ml-1 rounded-full border px-2 py-0.5 text-xs ${claseDePuntaje(item.puntaje)}`}>{item.puntaje === null ? "Sin crítico" : `${formatoPuntaje(item.puntaje)}/10`}</span>
        </summary>
        {critica ? (
          <div className="mt-2 flex flex-col gap-3 text-sm">
            <ul className="flex flex-col gap-2">
              {critica.porCriterio.map((c) => (
                <li key={c.criterio}>
                  <p className="font-medium">
                    {c.criterio}: {formatoPuntaje(c.puntaje)}
                  </p>
                  <p className="text-tinta-suave">{c.evidencia}</p>
                </li>
              ))}
            </ul>
            {critica.problemas.length > 0 && (
              <div>
                <h3 className="font-medium">Qué falló</h3>
                <ul className="list-disc pl-5 text-tinta-suave">
                  {critica.problemas.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
            {critica.correcciones.length > 0 && (
              <div>
                <h3 className="font-medium">Qué se corrigió</h3>
                <ul className="list-disc pl-5 text-tinta-suave">
                  {critica.correcciones.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <p className="mt-2 text-sm text-tinta-suave">Esta landing no tiene informe del crítico.</p>
        )}
      </details>

      <details className="rounded-md border border-linea bg-papel p-3" data-fuentes-panel>
        <summary className="min-h-11 cursor-pointer font-medium">Fuentes</summary>
        {item.fuentes.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {item.fuentes.map((f) => (
              <li key={f} className="rounded-full border border-linea px-2.5 py-0.5 text-sm">
                {f}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-tinta-suave">Sin fuentes externas: todo sale del brief.</p>
        )}
      </details>

      <details className="rounded-md border border-linea bg-papel p-3" data-creditos-panel>
        <summary className="min-h-11 cursor-pointer font-medium">Créditos de las imágenes</summary>
        {item.creditos.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-1.5 text-sm">
            {item.creditos.map((c) => (
              <li key={`${c.credito}|${c.licencia}`}>
                {c.urlOrigen ? (
                  <a href={c.urlOrigen} target="_blank" rel="noopener noreferrer" className="text-marca underline">
                    {c.credito}
                  </a>
                ) : (
                  c.credito
                )}
                <span className="text-tinta-suave"> · {c.licencia}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-tinta-suave">Ninguna imagen trae crédito todavía.</p>
        )}
      </details>
    </div>
  );
}

/**
 * Visor a pantalla completa (§12.1 del v2): la landing en un marco de móvil (390×844), tablet (820×1180) o a todo el
 * ancho, con ← → entre las landings del banco, Fullscreen API y un panel plegable con el prompt, el crítico, las
 * fuentes y los créditos. Cambiar de landing no recarga la página: así la pantalla completa no se pierde.
 */
export function Visor({ items, inicialId, dispositivoInicial = "escritorio", detallesInicial = false, entregaInicial = false }: Props) {
  const [indice, setIndice] = useState(() => Math.max(0, items.findIndex((i) => i.id === inicialId)));
  const [dispositivo, setDispositivoBase] = useState<Dispositivo>(dispositivoInicial);
  const [detalles, setDetalles] = useState(detallesInicial);
  const [entrega, setEntrega] = useState(entregaInicial);
  // Donde se dibujan los detalles de la entrega (un elemento de este mismo visor).
  const [destinoEntrega, setDestinoEntrega] = useState<HTMLElement | null>(null);
  const [pantallaCompleta, setPantallaCompleta] = useState(false);
  // Solo tras un cambio de landing o de dispositivo: el primer `load` del iframe puede llegar antes de hidratar y se perdería.
  const [cargando, setCargando] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const escenario = useRef<HTMLDivElement>(null);
  const item = items[indice];
  // El crítico falta cuando la landing no trae informe; las secciones por completar por cuota llegan de `/crear` en la URL.
  const senal = { ...useSenalGeneracion(item.id), fotosPendientes: item.sinFoto ?? 0 };
  const medida = MEDIDA_DISPOSITIVO[dispositivo];
  const escala = useEscala(escenario, medida);
  // El servidor da por buena la pantalla completa; el navegador dice si de verdad se puede.
  const puedePantallaCompleta = useSyncExternalStore(
    () => () => {},
    () => document.fullscreenEnabled !== false,
    () => true,
  );

  // La dirección refleja la landing y el dispositivo, para compartir el enlace o recargar en el mismo punto.
  useEffect(() => {
    const url = `/ver/${item.id}?dispositivo=${dispositivo}`;
    if (window.location.pathname + window.location.search !== url) window.history.replaceState(null, "", url);
    document.title = `${item.nombre} · Visor`;
  }, [item.id, item.nombre, dispositivo]);

  useEffect(() => {
    const alCambiar = () => setPantallaCompleta(document.fullscreenElement === raiz.current);
    document.addEventListener("fullscreenchange", alCambiar);
    return () => document.removeEventListener("fullscreenchange", alCambiar);
  }, []);

  function setDispositivo(nuevo: Dispositivo) {
    if (nuevo === dispositivo) return;
    // El iframe se vuelve a montar al cambiar de marco: vuelve a cargar.
    setCargando(true);
    setDispositivoBase(nuevo);
  }

  const ir = useCallback(
    (paso: 1 | -1) => {
      setIndice((i) => vecino(i, items.length, paso));
      setCargando(true);
    },
    [items.length],
  );

  useEffect(() => {
    const alTecla = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
      // Al escribir en un campo (o mover un control deslizante) las flechas son del campo.
      if (e.target instanceof Element && e.target.closest("input, textarea, select, [contenteditable='true'], [role='slider']")) return;
      ir(e.key === "ArrowRight" ? 1 : -1);
    };
    window.addEventListener("keydown", alTecla);
    return () => window.removeEventListener("keydown", alTecla);
  }, [ir]);

  async function alternarPantallaCompleta() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await raiz.current?.requestFullscreen();
    } catch {
      // El navegador puede negar la pantalla completa (permisos o iframe): el visor sigue funcionando.
    }
  }

  const iframe = (
    <iframe
      key={item.id}
      src={`/l/${item.slug}`}
      title={`Landing ${item.nombre} en ${ETIQUETA_DISPOSITIVO[dispositivo].toLowerCase()}`}
      onLoad={() => setCargando(false)}
      className="block size-full border-0 bg-papel"
    />
  );

  const controlesNavegacion = (
    <>
      <button type="button" onClick={() => ir(-1)} aria-label="Landing anterior" className={BOTON_PEQUENO} data-anterior>
        <Icono nombre="flecha-izquierda" className="size-5" />
      </button>
      <button type="button" onClick={() => ir(1)} aria-label="Landing siguiente" className={BOTON_PEQUENO} data-siguiente>
        <Icono nombre="flecha" className="size-5" />
      </button>
    </>
  );

  return (
    <div
      ref={raiz}
      data-visor
      data-dispositivo-activo={dispositivo}
      data-pantalla-completa={pantallaCompleta}
      className="flex h-dvh flex-col bg-papel-hondo text-tinta"
    >
      {!pantallaCompleta && (
        <header className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-linea bg-papel px-3 py-1.5 sm:gap-y-2 sm:px-4 sm:py-2">
          <Link href="/banco" className={BOTON_PEQUENO}>
            <Icono nombre="cerrar" className="size-4 sm:mr-1" />
            <span className="max-sm:sr-only">Salir</span>
          </Link>
          <div className="min-w-0 flex-1 basis-40">
            <h1 className="truncate font-editorial text-lg font-semibold leading-tight" data-nombre>
              {item.nombre}
            </h1>
            <p className="truncate text-xs text-tinta-suave">
              <span data-posicion>
                Landing {indice + 1} de {items.length}
              </span>
              {" · "}
              {NOMBRE_TEMATICA[item.tematica]} · {item.secciones} secciones
            </p>
          </div>
          <SelectorDispositivo dispositivo={dispositivo} onCambio={setDispositivo} />
          <div className="flex gap-1">{controlesNavegacion}</div>
          <button
            type="button"
            onClick={alternarPantallaCompleta}
            disabled={!puedePantallaCompleta}
            aria-pressed={pantallaCompleta}
            data-pantalla-completa-boton
            className={BOTON_PEQUENO}
          >
            <Icono nombre="pantalla-completa" className="mr-2 size-5" />
            <span className="max-sm:sr-only">Pantalla completa</span>
          </button>
          <button
            type="button"
            onClick={() => setDetalles((d) => !d)}
            aria-expanded={detalles}
            aria-controls="visor-detalles"
            data-detalles-boton
            className={BOTON_PEQUENO}
          >
            <Icono nombre="info" className="mr-2 size-5" />
            <span className="max-sm:sr-only">Detalles</span>
          </button>
          <Link href={`/editor/${item.id}`} className={BOTON_PEQUENO}>
            <Icono nombre="editar" className="mr-2 size-5" />
            <span className="max-sm:sr-only">Editar</span>
          </Link>
        </header>
      )}

      <div className="relative flex min-h-0 flex-1 flex-col lg:flex-row">
        <main ref={escenario} className="relative grid min-h-0 flex-1 place-items-center overflow-hidden" data-escenario>
          {medida ? (
            <div style={{ width: (medida.ancho + MARCO * 2) * escala, height: (medida.alto + MARCO * 2) * escala }} data-marco-caja>
              <div
                data-marco={dispositivo}
                style={{ width: medida.ancho + MARCO * 2, height: medida.alto + MARCO * 2, padding: MARCO, transform: `scale(${escala})`, transformOrigin: "top left" }}
                className={`relative bg-tinta shadow-xl ${dispositivo === "movil" ? "rounded-[3rem]" : "rounded-[1.75rem]"}`}
              >
                {dispositivo === "movil" && <span aria-hidden="true" data-notch className="absolute left-1/2 top-2 z-10 h-5 w-28 -translate-x-1/2 rounded-full bg-tinta" />}
                <div style={{ width: medida.ancho, height: medida.alto }} className={`overflow-hidden bg-papel ${dispositivo === "movil" ? "rounded-[2.25rem]" : "rounded-[1rem]"}`}>
                  {iframe}
                </div>
              </div>
            </div>
          ) : (
            <div data-marco="escritorio" className="size-full">
              {iframe}
            </div>
          )}
          {cargando && (
            <p role="status" className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-tinta px-3 py-1 text-xs text-papel">
              Cargando la landing…
            </p>
          )}
        </main>

        {!pantallaCompleta && detalles && (
          <aside
            id="visor-detalles"
            aria-label={`Detalles de ${item.nombre}`}
            className="max-h-[55dvh] overflow-y-auto border-t border-linea bg-papel-hondo p-3 lg:max-h-none lg:w-[26rem] lg:border-l lg:border-t-0"
          >
            <PanelDetalles item={item} />
          </aside>
        )}

        {/* Detalles de la entrega: columna junto al marco en pantallas anchas y hoja sobre la barra en las angostas; en ningún caso quitan alto al marco. */}
        <aside
          ref={setDestinoEntrega}
          aria-label="Detalles de la entrega"
          data-entrega-aside
          hidden={pantallaCompleta || !entrega}
          className="z-20 max-h-[55dvh] overflow-y-auto border-t border-linea bg-papel-hondo shadow-xl max-lg:absolute max-lg:inset-x-0 max-lg:bottom-0 lg:max-h-none lg:w-[26rem] lg:border-l lg:border-t-0 lg:shadow-none"
        />
      </div>

      {!pantallaCompleta && hayAvisoGeneracion(senal) && <AvisoGeneracion key={item.id} landingId={item.id} senal={senal} alReintentar={() => window.location.reload()} compacto />}

      {!pantallaCompleta && <PanelEntrega key={item.id} item={item} abierto={entrega} onAlternar={() => setEntrega((a) => !a)} destino={destinoEntrega} />}

      {pantallaCompleta && (
        <div
          data-controles-flotantes
          className="fixed right-3 top-3 z-50 flex items-center gap-1 rounded-lg bg-tinta/60 p-1 text-papel opacity-60 backdrop-blur transition-opacity focus-within:opacity-100 hover:opacity-100"
        >
          <SelectorDispositivo dispositivo={dispositivo} onCambio={setDispositivo} claro />
          <button type="button" onClick={() => ir(-1)} aria-label="Landing anterior" className="grid size-11 place-items-center rounded-md hover:bg-papel/20 focus-visible:outline-2 focus-visible:outline-marca" data-anterior>
            <Icono nombre="flecha-izquierda" className="size-5" />
          </button>
          <button type="button" onClick={() => ir(1)} aria-label="Landing siguiente" className="grid size-11 place-items-center rounded-md hover:bg-papel/20 focus-visible:outline-2 focus-visible:outline-marca" data-siguiente>
            <Icono nombre="flecha" className="size-5" />
          </button>
          <button type="button" onClick={alternarPantallaCompleta} aria-label="Salir de pantalla completa" className="grid size-11 place-items-center rounded-md hover:bg-papel/20 focus-visible:outline-2 focus-visible:outline-marca" data-salir-pantalla>
            <Icono nombre="salir-pantalla" className="size-5" />
          </button>
        </div>
      )}

      <p aria-live="polite" className="sr-only" data-anuncio>
        Landing {indice + 1} de {items.length}: {item.nombre}, en {ETIQUETA_DISPOSITIVO[dispositivo].toLowerCase()}.
      </p>
    </div>
  );
}
