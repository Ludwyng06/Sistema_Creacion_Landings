"use client";

import "@/secciones/esquemas";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAntiSplitRender } from "@/componentes/anti-split/useAntiSplitRender";
import { Icono } from "@/componentes/Icono";
import { LandingRender } from "@/componentes/LandingRender";
import type { LandingDoc, Seccion } from "@/lib/contratos";
import { urlFuentes } from "@/lib/fuentes/url";
import { registro } from "@/secciones/registro";
import { traducirAtajo, esCampoDeTexto } from "./atajos";
import { fontSizeDeBloque, conPresentacion, leerPresentacion, PASO_MAX_BLOQUE } from "@/secciones/presentacion";
import { compactar, conValorEnRuta, textosEditables } from "./edicion-en-linea";
import { leerMensajeAVista, type AccionRapida, type MensajeDeVista } from "./mensajes";

// La vista previa del editor (`/editor/[id]/vista`, dentro de un iframe): renderiza la landing con los mismos componentes
// de producción y le suma una capa del editor: contorno y etiqueta al pasar el mouse, barra rápida sobre la sección
// seleccionada y edición en línea con doble clic. Solo se activa dentro del editor (con una ventana padre).

interface Caja {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface Edicion {
  id: string;
  ruta: string;
  original: string;
}

const PERMITIDAS_POR_DEFECTO: Record<AccionRapida, boolean> = { subir: true, bajar: true, duplicar: true, ocultar: true, eliminar: true };

const BOTONES_RAPIDOS: { accion: AccionRapida; etiqueta: string; icono: string }[] = [
  { accion: "subir", etiqueta: "Subir la sección", icono: "flecha-arriba" },
  { accion: "bajar", etiqueta: "Bajar la sección", icono: "flecha-abajo" },
  { accion: "duplicar", etiqueta: "Duplicar la sección", icono: "copiar" },
  { accion: "ocultar", etiqueta: "Ocultar la sección", icono: "ojo-cerrado" },
  { accion: "eliminar", etiqueta: "Eliminar la sección", icono: "papelera" },
];

const idSeguro = (id: string) => id.replace(/[^A-Za-z0-9_-]/g, "");

function cajaDe(id: string | null): Caja | null {
  if (!id) return null;
  const el = document.querySelector(`[data-seccion-id="${idSeguro(id)}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { top: r.top + window.scrollY, left: r.left + window.scrollX, width: r.width, height: r.height };
}

/** El texto que ve la persona en un elemento (en los titulares cinéticos, la copia para lectores de pantalla). */
function textoVisible(el: Element): string {
  const cinetico = el.matches('[data-efecto="titular-cinetico"]') ? el : el.querySelector(':scope > [data-efecto="titular-cinetico"]');
  return compactar((cinetico?.querySelector(":scope > .sr-only") ?? el).textContent ?? "");
}

/** Sube desde `inicio` hasta la sección buscando el elemento más cercano cuyo texto sea justo el de un campo editable. */
function buscarEditable(inicio: Element, seccion: Seccion): { el: HTMLElement; ruta: string; valor: string } | null {
  const editables = textosEditables(seccion);
  const limite = inicio.closest("[data-seccion-id]");
  for (let el: Element | null = inicio; el && el !== limite; el = el.parentElement) {
    const visto = textoVisible(el);
    if (!visto) continue;
    const coincide = editables.filter((t) => compactar(t.valor) === visto);
    // Si dos campos dicen lo mismo no se sabe cuál es: no se edita en línea (queda el inspector).
    if (coincide.length === 1) return { el: el as HTMLElement, ruta: coincide[0].ruta, valor: coincide[0].valor };
    if (coincide.length > 1) return null;
  }
  return null;
}

export function VistaEditor() {
  const [doc, setDoc] = useState<LandingDoc | null>(null);
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [resaltada, setResaltada] = useState<string | null>(null);
  const [permitidas, setPermitidas] = useState<Record<AccionRapida, boolean>>(PERMITIDAS_POR_DEFECTO);
  const [cajas, setCajas] = useState<{ hover: Caja | null; seleccion: Caja | null; scroll: number }>({ hover: null, seleccion: null, scroll: 0 });
  const [edicion, setEdicion] = useState<Edicion | null>(null);
  // Caja del texto que se está editando, para colocar la mini barra de tamaño.
  const [cajaEdicion, setCajaEdicion] = useState<Caja | null>(null);
  // Cada edición en línea vuelve a montar la landing: el navegador cambió sus nodos de texto y React no debe tocarlos.
  const [generacion, setGeneracion] = useState(0);
  const docRef = useRef<LandingDoc | null>(null);
  const enEdicion = useRef<Edicion | null>(null);
  const enIframe = typeof window !== "undefined" && window.parent !== window;

  useAntiSplitRender(doc ?? undefined);

  const enviar = useCallback((mensaje: MensajeDeVista) => window.parent?.postMessage(mensaje, window.location.origin), []);

  useEffect(() => {
    docRef.current = doc;
  }, [doc]);

  // ── Mensajes del editor ──
  useEffect(() => {
    const recibir = (evento: MessageEvent) => {
      if (evento.origin !== window.location.origin || evento.source !== window.parent) return;
      const m = leerMensajeAVista(evento.data);
      if (!m) return;
      switch (m.type) {
        case "LANDING_UPDATE":
          // Mientras se escribe en línea no se pisa el texto: el documento llega de todos modos al confirmar.
          if (!enEdicion.current) setDoc(m.landing);
          break;
        case "SECTION_PATCH":
          setDoc((previo) => (previo ? { ...previo, secciones: previo.secciones.map((s) => (s.id === m.id ? { ...s, ...m.patch } : s)) } : previo));
          break;
        case "SELECT":
          setSeleccion(m.id);
          if (m.id && m.scroll) requestAnimationFrame(() => document.querySelector(`[data-seccion-id="${idSeguro(m.id!)}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
          break;
        case "HIGHLIGHT":
          setResaltada(m.id);
          break;
        case "QUICK_STATE":
          setPermitidas(m.permitidas);
          break;
        case "DEVICE":
          document.documentElement.dataset.dispositivo = m.device;
          break;
      }
    };
    window.addEventListener("message", recibir);
    enviar({ type: "READY" });
    return () => window.removeEventListener("message", recibir);
  }, [enviar]);

  // ── Hover y clic sobre las secciones ──
  useEffect(() => {
    if (!enIframe) return;
    const seccionDe = (destino: EventTarget | null) => (destino instanceof Element ? destino.closest("[data-seccion-id]") : null);
    const alMover = (e: MouseEvent) => {
      const id = seccionDe(e.target)?.getAttribute("data-seccion-id") ?? null;
      setHover((previo) => {
        if (previo !== id) enviar({ type: "HOVER_SECTION", id });
        return id;
      });
    };
    const alSalir = () => {
      setHover(null);
      enviar({ type: "HOVER_SECTION", id: null });
    };
    const alClic = (e: MouseEvent) => {
      if (e.target instanceof Element && e.target.closest("[data-editor-capa]")) return;
      // Dentro de un texto en edición el clic solo mueve el cursor.
      if (enEdicion.current && e.target instanceof Element && e.target.closest("[contenteditable]")) return;
      const destino = seccionDe(e.target);
      const id = destino?.getAttribute("data-seccion-id");
      // En el editor los enlaces y botones de la landing no navegan ni envían nada: solo seleccionan.
      if (e.target instanceof Element && e.target.closest("a[href], button, form")) e.preventDefault();
      if (id) {
        setSeleccion(id);
        enviar({ type: "CLICK_SECTION", id });
      }
    };
    document.addEventListener("mousemove", alMover, { passive: true });
    document.documentElement.addEventListener("mouseleave", alSalir);
    document.addEventListener("click", alClic, true);
    return () => {
      document.removeEventListener("mousemove", alMover);
      document.documentElement.removeEventListener("mouseleave", alSalir);
      document.removeEventListener("click", alClic, true);
    };
  }, [enIframe, enviar]);

  // ── Teclas: el foco vive en el iframe, así que los atajos del editor se reenvían ──
  useEffect(() => {
    if (!enIframe) return;
    const alTecla = (e: KeyboardEvent) => {
      if (enEdicion.current) return;
      const tecla = { key: e.key, ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey, altKey: e.altKey, enCampo: esCampoDeTexto(e.target) };
      if (!traducirAtajo(tecla)) return;
      e.preventDefault();
      enviar({ type: "KEY", key: e.key, ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey, altKey: e.altKey });
    };
    document.addEventListener("keydown", alTecla);
    return () => document.removeEventListener("keydown", alTecla);
  }, [enIframe, enviar]);

  // ── Cajas del contorno, la etiqueta y la barra rápida ──
  const medir = useCallback(() => {
    setCajas((previo) => {
      const nuevo = { hover: cajaDe(resaltada ?? hover), seleccion: cajaDe(seleccion), scroll: window.scrollY };
      const igual = (a: Caja | null, b: Caja | null) => (a === b) || (a && b && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height);
      return previo.scroll === nuevo.scroll && igual(previo.hover, nuevo.hover) && igual(previo.seleccion, nuevo.seleccion) ? previo : nuevo;
    });
  }, [hover, resaltada, seleccion]);

  useLayoutEffect(() => {
    const primera = requestAnimationFrame(medir);
    window.addEventListener("resize", medir);
    window.addEventListener("scroll", medir, { passive: true });
    // Las imágenes, las fuentes y las animaciones cambian el alto de las secciones sin avisar.
    const reloj = setInterval(medir, 300);
    return () => {
      cancelAnimationFrame(primera);
      window.removeEventListener("resize", medir);
      window.removeEventListener("scroll", medir);
      clearInterval(reloj);
    };
  }, [medir, doc, generacion]);

  // ── Edición en línea ──
  const terminarEdicion = useCallback(
    (el: HTMLElement, confirmar: boolean) => {
      const actual = enEdicion.current;
      if (!actual) return;
      enEdicion.current = null;
      const nuevo = compactar(el.textContent ?? "");
      el.removeAttribute("contenteditable");
      const previo = docRef.current;
      const seccion = previo?.secciones.find((s) => s.id === actual.id);
      const cambio = confirmar && nuevo && nuevo !== compactar(actual.original) && seccion ? conValorEnRuta(seccion, actual.ruta, nuevo) : null;
      if (previo && cambio) {
        setDoc({ ...previo, secciones: previo.secciones.map((s) => (s.id === actual.id ? cambio : s)) });
        enviar({ type: "INLINE_EDIT", id: actual.id, path: actual.ruta, value: nuevo });
      }
      setEdicion(null);
      setCajaEdicion(null);
      setGeneracion((g) => g + 1);
    },
    [enviar],
  );

  useEffect(() => {
    if (!enIframe) return;
    const alDobleClic = (e: MouseEvent) => {
      if (enEdicion.current || !(e.target instanceof Element) || !docRef.current) return;
      const contenedor = e.target.closest("[data-seccion-id]");
      const id = contenedor?.getAttribute("data-seccion-id");
      const seccion = docRef.current.secciones.find((s) => s.id === id);
      if (!seccion || !id) return;
      const hallado = buscarEditable(e.target, seccion);
      if (!hallado) return;
      e.preventDefault();
      // Sin animaciones de letras el texto es un solo nodo y se puede escribir encima.
      enEdicion.current = { id, ruta: hallado.ruta, original: hallado.valor };
      setEdicion({ id, ruta: hallado.ruta, original: hallado.valor });
      setGeneracion((g) => g + 1);
    };
    document.addEventListener("dblclick", alDobleClic, true);
    return () => document.removeEventListener("dblclick", alDobleClic, true);
  }, [enIframe]);

  // Ya con la landing vuelta a montar en texto plano, se activa el elemento que corresponde.
  useEffect(() => {
    if (!edicion || !doc) return;
    const seccion = doc.secciones.find((s) => s.id === edicion.id);
    const contenedor = document.querySelector(`[data-seccion-id="${idSeguro(edicion.id)}"]`);
    if (!seccion || !contenedor) return;
    const objetivo = compactar(edicion.original);
    const candidatos = [...contenedor.querySelectorAll<HTMLElement>("*")].filter((el) => textoVisible(el) === objetivo);
    // El más profundo con ese texto es el que lo contiene sin envolturas.
    const el = candidatos.at(-1);
    if (!el) return;
    el.setAttribute("contenteditable", "plaintext-only");
    if (el.contentEditable !== "plaintext-only") el.setAttribute("contenteditable", "true");
    el.setAttribute("data-editando", "");
    el.focus();
    const r = el.getBoundingClientRect();
    const cuadro = requestAnimationFrame(() => setCajaEdicion({ top: r.top + window.scrollY, left: r.left + window.scrollX, width: r.width, height: r.height }));
    const rango = document.createRange();
    rango.selectNodeContents(el);
    const seleccionDoc = window.getSelection();
    seleccionDoc?.removeAllRanges();
    seleccionDoc?.addRange(rango);
    const alTecla = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        terminarEdicion(el, true);
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        terminarEdicion(el, false);
      }
    };
    const alPerderFoco = () => terminarEdicion(el, true);
    el.addEventListener("keydown", alTecla);
    el.addEventListener("blur", alPerderFoco, { once: true });
    return () => {
      cancelAnimationFrame(cuadro);
      el.removeEventListener("keydown", alTecla);
      el.removeEventListener("blur", alPerderFoco);
    };
  }, [edicion, generacion, doc, terminarEdicion]);

  /** − y + de la mini barra: cambia el tamaño del texto en edición al instante y avisa al editor. */
  const cambiarTamano = (delta: -1 | 1) => {
    const actual = enEdicion.current;
    const previo = docRef.current;
    if (!actual || !previo) return;
    const seccion = previo.secciones.find((x) => x.id === actual.id);
    const el = document.querySelector<HTMLElement>("[data-editando]");
    if (!seccion || !el) return;
    const paso = Math.max(-PASO_MAX_BLOQUE, Math.min(PASO_MAX_BLOQUE, (leerPresentacion(seccion.ajustes).tamanos[actual.ruta] ?? 0) + delta));
    const tamanos = { ...leerPresentacion(seccion.ajustes).tamanos };
    if (paso === 0) delete tamanos[actual.ruta];
    else tamanos[actual.ruta] = paso;
    // Vista al instante: se quita el tamaño anterior para medir el base y se aplica el nuevo.
    el.style.removeProperty("font-size");
    if (paso !== 0) el.style.fontSize = fontSizeDeBloque(parseFloat(getComputedStyle(el).fontSize), paso);
    setDoc({ ...previo, secciones: previo.secciones.map((x) => (x.id === actual.id ? conPresentacion(x, { tamanos }) : x)) });
    enviar({ type: "INLINE_SIZE", id: actual.id, path: actual.ruta, step: paso });
  };

  if (!doc) return <p className="p-6 text-center text-sm text-tinta-suave">Cargando la vista previa…</p>;

  const seccionSel = doc.secciones.find((s) => s.id === seleccion);
  const nombre = (id: string | null) => {
    const s = doc.secciones.find((x) => x.id === id);
    return s ? (registro[s.tipo]?.etiqueta ?? s.tipo) : "";
  };
  const idHover = resaltada ?? hover;
  const mostrarHover = idHover && idHover !== seleccion ? cajas.hover : null;

  return (
    <>
      <style>{`[data-editando]{outline:2px solid var(--c-acento);outline-offset:4px;cursor:text}`}</style>
      <LandingRender key={generacion} onBuscarBancos={enIframe ? (slot) => enviar({ type: "BUSCAR_BANCOS", slot }) : undefined} doc={doc} urlFuentes={urlFuentes(doc.tokens)} morph reducirMovimiento={Boolean(edicion)} />
      {enIframe && (
        <div data-editor-capa aria-hidden={false} className="pointer-events-none absolute left-0 top-0 z-[60] size-0">
          {mostrarHover && (
            <div data-contorno="hover" style={{ top: mostrarHover.top, left: mostrarHover.left, width: mostrarHover.width, height: mostrarHover.height }} className="absolute border-2 border-dashed border-marca">
              <span className="absolute left-0 top-0 rounded-br-md bg-marca px-2 py-0.5 text-xs font-medium text-marca-texto">{nombre(idHover)}</span>
            </div>
          )}
          {edicion && cajaEdicion && (
            <div
              role="toolbar"
              aria-label="Tamaño de este texto"
              data-barra-tamano
              style={{ top: Math.max(4, cajaEdicion.top - 44), left: Math.max(4, cajaEdicion.left) }}
              className="pointer-events-auto absolute flex items-center gap-0.5 rounded-md border border-linea bg-papel p-0.5 text-tinta shadow-lg"
              // Mantiene el foco en el texto: si no, al pulsar − o + terminaría la edición.
              onMouseDown={(e) => e.preventDefault()}
            >
              <button type="button" aria-label="Texto más pequeño" data-tam-menos className="grid size-9 place-items-center rounded-md text-lg font-semibold hover:bg-papel-hondo focus-visible:outline-2 focus-visible:outline-marca" onClick={() => cambiarTamano(-1)}>
                <span aria-hidden="true">−</span>
              </button>
              <span className="px-1 text-xs text-tinta-suave">Aa</span>
              <button type="button" aria-label="Texto más grande" data-tam-mas className="grid size-9 place-items-center rounded-md text-lg font-semibold hover:bg-papel-hondo focus-visible:outline-2 focus-visible:outline-marca" onClick={() => cambiarTamano(1)}>
                <span aria-hidden="true">+</span>
              </button>
            </div>
          )}
          {cajas.seleccion && seccionSel && (
            <div data-contorno="seleccion" style={{ top: cajas.seleccion.top, left: cajas.seleccion.left, width: cajas.seleccion.width, height: cajas.seleccion.height }} className="absolute border-2 border-marca">
              <span className="absolute left-0 top-0 rounded-br-md bg-marca px-2 py-0.5 text-xs font-medium text-marca-texto">{nombre(seleccion)}</span>
              <div
                role="toolbar"
                aria-label={`Barra rápida de ${nombre(seleccion)}`}
                data-barra-rapida
                style={{ top: Math.max(8, cajas.scroll - cajas.seleccion.top + 8), right: 8 }}
                className="pointer-events-auto absolute flex gap-0.5 rounded-md border border-linea bg-papel p-0.5 text-tinta shadow-lg"
              >
                {BOTONES_RAPIDOS.map((b) => {
                  const etiqueta = b.accion === "ocultar" && !seccionSel.visible ? "Mostrar la sección" : b.etiqueta;
                  const icono = b.accion === "ocultar" && !seccionSel.visible ? "ojo" : b.icono;
                  const bloqueada = !permitidas[b.accion];
                  return (
                    <button
                      key={b.accion}
                      type="button"
                      data-accion-rapida={b.accion}
                      aria-label={etiqueta}
                      title={etiqueta}
                      aria-disabled={bloqueada ? true : undefined}
                      onClick={() => {
                        if (!bloqueada) enviar({ type: "SECTION_ACTION", id: seccionSel.id, action: b.accion });
                      }}
                      className={`grid size-9 place-items-center rounded-md hover:bg-papel-hondo focus-visible:outline-2 focus-visible:outline-marca ${bloqueada ? "cursor-not-allowed opacity-40" : ""}`}
                    >
                      <Icono nombre={icono} className="size-4" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
