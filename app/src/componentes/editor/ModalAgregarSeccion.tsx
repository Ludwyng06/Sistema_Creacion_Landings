"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TIPOS_SECCION, type LandingDoc, type TipoSeccion } from "@/lib/contratos";
import { Icono } from "@/componentes/Icono";
import { CATEGORIAS, tieneVariantes, variantesDe, type VarianteCatalogo } from "@/secciones/catalogo-variantes";
import { registro } from "@/secciones/registro";
import { BOTON_PEQUENO, CLASE_CONTROL } from "../crear/estilos";
import { motivoNoAgregar } from "./estado-editor";
import { MiniaturaSeccion } from "./MiniaturaSeccion";

interface Props {
  doc: LandingDoc;
  onElegir: (tipo: TipoSeccion, variante: string | undefined) => void;
  onCerrar: () => void;
}

const normalizar = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Nombre corto de una variante para la tarjeta («lista-grande» → «lista grande»). */
export const nombreDeVariante = (clave: string) => clave.replace(/-/g, " ");

/**
 * Modal «Añadir sección»: buscador, categorías y una miniatura por variante (la sección de su `ejemplo.ts` a escala).
 * Esc cierra, el foco arranca en el buscador y vuelve a quien abrió el modal.
 */
export function ModalAgregarSeccion({ doc, onElegir, onCerrar }: Props) {
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState<string>("todas");
  const buscador = useRef<HTMLInputElement>(null);
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    buscador.current?.focus();
    return () => previo?.focus?.();
  }, []);

  useEffect(() => {
    const alTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCerrar();
        return;
      }
      // El foco no sale del modal con Tab.
      if (e.key !== "Tab" || !raiz.current) return;
      const foco = [...raiz.current.querySelectorAll<HTMLElement>("button:not([aria-disabled='true']), input, [href], [role='button']:not([aria-disabled='true'])")].filter((el) => !el.hasAttribute("disabled"));
      if (foco.length === 0) return;
      const primero = foco[0];
      const ultimo = foco[foco.length - 1];
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    };
    document.addEventListener("keydown", alTecla, true);
    return () => document.removeEventListener("keydown", alTecla, true);
  }, [onCerrar]);

  const tarjetas = useMemo(() => {
    const palabras = normalizar(busqueda).split(/\s+/).filter(Boolean);
    const cat = CATEGORIAS.find((c) => c.id === categoria);
    const tipos = TIPOS_SECCION.filter((t) => registro[t]).filter((t) => categoria === "todas" || !cat || !("tipos" in cat) || (cat.tipos as readonly string[]).includes(t));
    return tipos.flatMap((tipo) =>
      variantesDe(tipo)
        .filter((v) => {
          const pajar = normalizar(`${registro[tipo]!.etiqueta} ${tipo} ${v.clave}`);
          return palabras.every((p) => pajar.includes(p));
        })
        .map((v) => ({ tipo, v })),
    );
  }, [busqueda, categoria]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-tinta/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div ref={raiz} role="dialog" aria-modal="true" aria-labelledby="titulo-agregar" data-modal-agregar className="flex max-h-[90dvh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-linea bg-papel shadow-xl">
        <header className="flex flex-wrap items-center gap-3 border-b border-linea p-4">
          <h2 id="titulo-agregar" className="font-editorial text-xl font-semibold">
            Añadir sección
          </h2>
          <label className="min-w-0 flex-1 basis-56">
            <span className="sr-only">Buscar una sección</span>
            <input ref={buscador} type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar: galería, garantía, auroras…" className={CLASE_CONTROL} />
          </label>
          <button type="button" onClick={onCerrar} className={BOTON_PEQUENO} aria-label="Cerrar">
            <Icono nombre="cerrar" className="size-5" />
          </button>
        </header>
        <div role="group" aria-label="Categorías" className="flex flex-wrap gap-2 border-b border-linea px-4 py-3">
          {CATEGORIAS.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={categoria === c.id}
              onClick={() => setCategoria(c.id)}
              className="inline-flex min-h-11 items-center rounded-full border border-linea px-4 text-sm aria-pressed:border-marca aria-pressed:bg-marca aria-pressed:text-marca-texto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca"
            >
              {c.nombre}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
          {tarjetas.length === 0 ? (
            <p data-sin-resultados className="p-6 text-center text-tinta-suave">
              Ninguna sección coincide con «{busqueda}». Prueba con otra palabra o cambia de categoría.
            </p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-selector-tipos>
              {tarjetas.map(({ tipo, v }) => (
                <Tarjeta key={`${tipo}:${v.clave}`} doc={doc} tipo={tipo} v={v} onElegir={onElegir} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Tarjeta({ doc, tipo, v, onElegir }: { doc: LandingDoc; tipo: TipoSeccion; v: VarianteCatalogo; onElegir: Props["onElegir"] }) {
  const def = registro[tipo]!;
  const motivo = motivoNoAgregar(doc, tipo);
  const conVariantes = tieneVariantes(tipo);
  const nombre = conVariantes ? `${def.etiqueta} · ${nombreDeVariante(v.clave)}` : def.etiqueta;
  return (
    <li>
      <div
        role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (e.currentTarget as HTMLElement).click(); } }}
        data-agregar={tipo}
        data-variante={conVariantes ? v.clave : undefined}
        aria-disabled={motivo ? true : undefined}
        title={motivo ?? `Añadir ${nombre}`}
        onClick={() => {
          if (!motivo) onElegir(tipo, conVariantes ? v.clave : undefined);
        }}
        className={`flex w-full flex-col gap-2 rounded-md border border-linea p-2 text-left hover:border-marca focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca ${motivo ? "cursor-not-allowed opacity-50" : ""}`}
      >
        <MiniaturaSeccion doc={doc} seccion={v.seccion} assets={v.assets} ancho={280} alto={150} etiqueta={`Vista previa de ${nombre}`} />
        <span className="flex items-center gap-2 text-sm font-medium">
          <Icono nombre={def.icono} className="size-4 shrink-0 text-tinta-suave" />
          <span className="truncate">{nombre}</span>
        </span>
        {tipo === "html-libre" && <span className="w-fit rounded-full border border-linea px-2 py-0.5 text-xs">Solo personas</span>}
        {motivo && <span className="text-xs text-tinta-suave">{motivo}</span>}
      </div>
    </li>
  );
}
