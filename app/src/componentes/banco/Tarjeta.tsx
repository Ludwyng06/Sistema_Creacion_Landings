"use client";

import Link from "next/link";
import { useState } from "react";
import { BOTON_PEQUENO } from "@/componentes/crear/estilos";
import { BLOQUES_PROMPT, NOMBRE_INTENSIDAD, NOMBRE_TECNICA, NOMBRE_TEMATICA, formatearFecha, type TarjetaBanco } from "@/lib/banco";
import { ESTILO_BLOQUE, claseDePuntaje } from "./estilos";

const formatoPuntaje = (p: number) => p.toFixed(1).replace(".", ",");

/**
 * Tarjeta del banco. El frente muestra la landing y el reverso el prompt de 4 bloques resumido.
 * Se voltea con clic o Enter; con `prefers-reduced-motion` el giro se cambia por un fundido (variantes `motion-reduce:`).
 */
export function Tarjeta({ t }: { t: TarjetaBanco }) {
  const [volteada, setVolteada] = useState(false);
  // La captura real de la landing va primero; si falta o no carga, la imagen de su héroe.
  const [fallaCaptura, setFallaCaptura] = useState(false);
  const [fallaHeroe, setFallaHeroe] = useState(false);
  const imagen = t.miniatura && !fallaCaptura ? { src: t.miniatura, esCaptura: true } : t.imagenHeroe && !fallaHeroe ? { src: t.imagenHeroe, esCaptura: false } : null;

  return (
    <li data-tarjeta data-id={t.id} data-volteada={volteada} className="[perspective:1400px]">
      <div
        className={`grid h-full transition-transform duration-500 [transform-style:preserve-3d] motion-reduce:transition-none motion-reduce:[transform:none] ${volteada ? "[transform:rotateY(180deg)]" : ""}`}
      >
        {/* Frente */}
        <article
          aria-label={`${t.nombre}: landing`}
          inert={volteada}
          className={`col-start-1 row-start-1 flex flex-col overflow-hidden rounded-md border border-linea bg-papel [backface-visibility:hidden] motion-reduce:transition-opacity motion-reduce:duration-300 ${volteada ? "motion-reduce:opacity-0" : ""}`}
        >
          <button
            type="button"
            onClick={() => setVolteada(true)}
            className="flex flex-1 flex-col text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-marca"
          >
            <span className="sr-only">Ver el prompt de</span>
            <span className="relative block aspect-[4/3] w-full overflow-hidden border-b border-linea bg-papel-hondo">
              {/* Respaldo con el titular: se ve mientras carga la miniatura o si falta el archivo; la imagen lo cubre al cargar. */}
              <span
                data-respaldo-miniatura
                className="absolute inset-0 flex flex-col items-start justify-end gap-1 p-4 text-left"
              >
                <span className="font-editorial text-2xl font-semibold leading-tight">{t.nombre}</span>
                {!imagen && (
                  <span className="text-sm text-tinta-suave" title="La miniatura se genera con npm run capturas">
                    Vista previa pendiente
                  </span>
                )}
              </span>
              {imagen && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={imagen.src}
                  src={imagen.src}
                  alt={`Vista previa de ${t.nombre}`}
                  data-miniatura={imagen.esCaptura ? "captura" : "heroe"}
                  loading="lazy"
                  onError={() => (imagen.esCaptura ? setFallaCaptura(true) : setFallaHeroe(true))}
                  className="absolute inset-0 size-full object-cover object-top"
                />
              )}
            </span>
            <span className="flex flex-col gap-2 p-4">
              <span className="flex items-start justify-between gap-3">
                <span className="font-editorial text-xl font-semibold leading-tight">{t.nombre}</span>
                <span
                  data-puntaje={t.puntaje ?? "sin"}
                  className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${claseDePuntaje(t.puntaje)}`}
                >
                  {t.puntaje === null ? "Sin crítico" : `Crítico ${formatoPuntaje(t.puntaje)}/10`}
                </span>
              </span>
              <span className="text-sm text-tinta-suave">{t.producto}</span>
              <span className="flex flex-wrap items-center gap-1.5 text-xs" data-chips>
                <span data-tematica={t.tematica} className="rounded-full bg-marca px-2.5 py-0.5 font-medium text-marca-texto">
                  {NOMBRE_TEMATICA[t.tematica]}
                </span>
                <span data-secciones className="rounded-full border border-linea px-2.5 py-0.5">
                  {t.secciones} {t.secciones === 1 ? "sección" : "secciones"}
                </span>
                {t.fuentes.length > 0 && (
                  <span data-fuentes className="text-tinta-suave">
                    Fuentes: {t.fuentes.join(" · ")}
                  </span>
                )}
              </span>
              <span className="text-xs text-tinta-suave">
                {t.proveedor} · {formatearFecha(t.creadoEn)} · Intensidad {t.intensidad} ({NOMBRE_INTENSIDAD[t.intensidad]})
              </span>
              <span className="flex flex-wrap gap-1.5" data-tecnicas>
                {t.tecnicas.map((id) => (
                  <span key={id} className="rounded-full border border-linea px-2 py-0.5 text-xs">
                    {NOMBRE_TECNICA(id)}
                  </span>
                ))}
              </span>
            </span>
          </button>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-linea p-3">
            <span className="text-xs text-tinta-suave">Clic o Enter para ver el prompt</span>
            <span className="flex gap-2">
              <Link href={`/ver/${t.id}`} className={`${BOTON_PEQUENO} whitespace-nowrap`} aria-label={`Ver ${t.nombre} en pantalla completa`}>
                Pantalla completa
              </Link>
              <Link href={`/banco/${t.id}`} className={BOTON_PEQUENO}>
                Abrir
              </Link>
            </span>
          </div>
        </article>

        {/* Reverso */}
        <article
          aria-label={`${t.nombre}: prompt`}
          inert={!volteada}
          className={`col-start-1 row-start-1 flex flex-col gap-3 rounded-md border border-linea bg-papel p-4 [backface-visibility:hidden] [transform:rotateY(180deg)] motion-reduce:transition-opacity motion-reduce:duration-300 motion-reduce:[transform:none] ${volteada ? "" : "motion-reduce:opacity-0"}`}
        >
          <h3 className="font-editorial text-lg font-semibold leading-tight">Prompt de {t.nombre}</h3>
          <dl className="flex flex-1 flex-col gap-2">
            {BLOQUES_PROMPT.map((b) => {
              const e = ESTILO_BLOQUE[b];
              return (
                <div key={b} data-bloque={b} className={`rounded-sm border-l-4 p-2 ${e.caja}`}>
                  <dt className={`text-xs font-semibold uppercase tracking-wide ${e.titulo}`}>{e.nombre}</dt>
                  <dd className="text-sm leading-snug">{t.resumen[b]}</dd>
                </div>
              );
            })}
          </dl>
          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={() => setVolteada(false)} className={BOTON_PEQUENO}>
              Volver
            </button>
            <Link href={`/banco/${t.id}`} className={BOTON_PEQUENO}>
              Abrir
            </Link>
          </div>
        </article>
      </div>
    </li>
  );
}
