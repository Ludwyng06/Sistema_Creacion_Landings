"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icono } from "@/componentes/Icono";
import { BOTON_PEQUENO, BOTON_PRIMARIO } from "@/componentes/crear/estilos";
import { ErrorApi } from "@/componentes/crear/api";
import { guardarEnBanco } from "@/componentes/editor/api-editor";
import { enlaceASeccion } from "@/lib/entrega/completar";
import type { ItemVisor } from "@/lib/visor";
import { ListaRevision } from "./ListaRevision";
import { ModalRevision } from "./ModalRevision";

/** Copia al portapapeles; si el navegador no lo permite (página sin HTTPS), usa un campo temporal. */
async function copiarTexto(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    const campo = document.createElement("textarea");
    campo.value = texto;
    campo.setAttribute("readonly", "");
    campo.style.position = "fixed";
    campo.style.opacity = "0";
    document.body.appendChild(campo);
    campo.select();
    try {
      return document.execCommand("copy");
    } finally {
      campo.remove();
    }
  }
}

interface Props {
  item: ItemVisor;
  /** Detalles desplegados. */
  abierto: boolean;
  onAlternar: () => void;
  /** Elemento del visor donde se dibujan los detalles: junto al marco en pantallas anchas, como hoja sobre la barra en las angostas. Así desplegarlos nunca encoge el marco. */
  destino: HTMLElement | null;
}

/**
 * Panel inferior plegable del visor (§12.1 del v2): copiar el link público, descargar el HTML, guardar en el banco con su
 * lista de revisión, qué mejoró el revisor y los datos por completar, cada uno con su enlace al editor.
 */
export function PanelEntrega({ item, abierto, onAlternar, destino }: Props) {
  const [aviso, setAviso] = useState<string | null>(null);
  const [revisando, setRevisando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorBanco, setErrorBanco] = useState<string | null>(null);
  const [enBanco, setEnBanco] = useState<Record<string, boolean>>({});
  const guardada = enBanco[item.id] ?? item.estado === "en-banco";

  // El aviso («Link copiado») desaparece solo.
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 3500);
    return () => clearTimeout(t);
  }, [aviso]);

  async function copiarLink() {
    const ok = await copiarTexto(`${window.location.origin}/l/${item.slug}`);
    setAviso(ok ? "Link copiado" : "No pudimos copiar el link");
  }

  async function guardar() {
    setGuardando(true);
    setErrorBanco(null);
    try {
      await guardarEnBanco(item.id);
      setEnBanco((m) => ({ ...m, [item.id]: true }));
      setRevisando(false);
      setAviso("Guardada en el banco");
    } catch (e) {
      if (e instanceof ErrorApi && e.estado === 409) {
        const motivos = (e.datos?.motivos as { mensaje: string }[] | undefined) ?? [];
        setErrorBanco(motivos.length > 0 ? motivos.map((m) => m.mensaje).join(" ") : e.message);
      } else setErrorBanco(e instanceof Error ? e.message : "No pudimos guardar en el banco.");
    } finally {
      setGuardando(false);
    }
  }

  const pendientes = item.completar.length;

  const detalles = (
        <div id="panel-entrega-detalles" data-entrega-detalles className="flex flex-col gap-4 p-3">
          <div data-mejoras>
            <h3 className="font-medium">Qué mejoró el revisor</h3>
            {item.mejoras.length > 0 ? (
              <ul className="mt-2 list-disc pl-5 text-sm text-tinta-suave">
                {item.mejoras.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-tinta-suave">{item.critica ? "El revisor no tuvo que corregir nada." : "Esta landing no tiene informe del crítico."}</p>
            )}
          </div>

          <div data-por-completar>
            <h3 className="font-medium">Datos por completar</h3>
            {pendientes > 0 ? (
              <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                {item.completar.map((d) => (
                  <li key={`${d.seccionId}:${d.ruta}`} className="flex items-baseline justify-between gap-2" data-pendiente={d.critico ? "critico" : "normal"}>
                    <span>
                      {d.etiqueta}: <span className="text-tinta-suave">{d.campo}</span>
                      {d.critico && <span className="ml-1 text-xs font-medium text-error">(obligatorio)</span>}
                    </span>
                    <Link href={enlaceASeccion(item.id, d.seccionId)} className="shrink-0 text-marca underline">
                      Completar
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-tinta-suave">No queda ningún [COMPLETAR].</p>
            )}
          </div>

          <div data-revision-panel>
            <h3 className="font-medium">Lista de revisión</h3>
            <div className="mt-2">
              <ListaRevision revision={item.revision} hrefSeccion={(id) => enlaceASeccion(item.id, id)} />
            </div>
          </div>
        </div>
  );

  return (
    <section aria-label="Entrega" data-panel-entrega data-abierto={abierto} className="border-t border-linea bg-papel">
      <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2">
        <button type="button" onClick={copiarLink} className={BOTON_PEQUENO} data-copiar-link>
          <Icono nombre="enlace" className="size-5 sm:mr-2" />
          <span className="max-sm:sr-only">Copiar link</span>
        </button>
        <a href={`/api/entrega/${item.id}/html`} download={`${item.slug}.html`} className={BOTON_PEQUENO} data-descargar-html>
          <Icono nombre="descargar" className="size-5 sm:mr-2" />
          <span className="max-sm:sr-only">Descargar HTML</span>
        </a>
        <button type="button" onClick={() => setRevisando(true)} className={`${BOTON_PRIMARIO} min-h-11 px-4 text-sm`} data-guardar-banco>
          {guardada ? "Actualizar en el banco" : "Guardar en el banco"}
        </button>
        <p role="status" aria-live="polite" data-aviso-entrega className="min-h-5 text-sm text-tinta-suave">
          {aviso}
        </p>
        <button
          type="button"
          onClick={onAlternar}
          aria-expanded={abierto}
          aria-controls="panel-entrega-detalles"
          data-entrega-alternar
          className={`${BOTON_PEQUENO} ml-auto`}
        >
          <Icono nombre="lista" className="mr-2 size-5" />
          <span>
            Revisión{pendientes > 0 ? ` · ${pendientes} por completar` : ""}
          </span>
        </button>
      </div>

      {abierto && destino && createPortal(detalles, destino)}

      {revisando && (
        <ModalRevision
          revision={item.revision}
          accion={guardada ? "Actualizar en el banco" : "Guardar en el banco"}
          guardando={guardando}
          onConfirmar={guardar}
          onCerrar={() => setRevisando(false)}
          hrefSeccion={(id) => enlaceASeccion(item.id, id)}
        />
      )}
      {errorBanco && (
        <p role="alert" className="border-t border-linea px-4 py-2 text-sm text-error">
          {errorBanco}
        </p>
      )}
    </section>
  );
}
