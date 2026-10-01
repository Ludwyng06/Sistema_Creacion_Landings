"use client";

import { useEffect, useRef, useState } from "react";
import { LandingRender } from "@/componentes/LandingRender";
import { efectosDelDoc, efectosGlobales } from "@/efectos/aplicables";
import { ContadorFps } from "./ContadorFps";
import { DEMOS, type Demo } from "./demos";
import { DEMOS_NIVEL_3 } from "./demos-nivel3";

function DemoEfecto({ demo, reduccionGlobal }: { demo: Demo; reduccionGlobal: boolean }) {
  const [reducidoPropio, setReducidoPropio] = useState(false);
  const [enPantalla, setEnPantalla] = useState(false);
  const seccion = useRef<HTMLElement>(null);
  const reducido = reduccionGlobal || reducidoPropio;
  const slug = demo.doc.meta.slug;
  const fuerte = demo.nivel === 3;

  useEffect(() => {
    const el = seccion.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observador = new IntersectionObserver(([e]) => setEnPantalla(e.isIntersecting), { rootMargin: "200px 0px" });
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  const aplicados = [...[...efectosDelDoc(demo.doc).porSeccion.values()].flat(), ...efectosGlobales(demo.doc)];
  return (
    <section ref={seccion} id={slug} aria-labelledby={`${slug}-t`} data-demo={slug}>
      <div className="mb-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 id={`${slug}-t`} className="font-editorial text-2xl font-semibold tracking-tight">
          {demo.titulo}
        </h2>
        <span className="rounded-full bg-papel-hondo px-3 py-0.5 text-xs">Nivel {demo.nivel}</span>
        <span className="rounded-full bg-papel-hondo px-3 py-0.5 text-xs">Intensidad {demo.doc.tokens.intensidad}</span>
        <span className="text-xs text-tinta-suave" data-aplicados>
          Aplicados: {aplicados.length ? aplicados.join(", ") : "ninguno"}
        </span>
      </div>
      <p className="text-sm">{demo.que}</p>
      <p className="text-sm text-tinta-suave">Con reducir movimiento: {demo.reducido}</p>
      {demo.nota && <p className="mt-1 text-sm text-tinta-suave">{demo.nota}</p>}

      {fuerte && (
        <div className="sticky top-2 z-40 mt-3 flex flex-wrap items-center gap-3">
          <label className="flex min-h-11 w-fit cursor-pointer items-center gap-2 rounded-full border border-linea bg-papel px-4 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-marca">
            <input type="checkbox" checked={reducidoPropio} onChange={(e) => setReducidoPropio(e.target.checked)} className="size-4 accent-[var(--marca)]" />
            reduced-motion en este efecto
          </label>
          <ContadorFps activo={enPantalla} />
        </div>
      )}

      {/* Los efectos que fijan la sección necesitan que ningún contenedor recorte el scroll: sin `overflow-hidden`. */}
      <div className={`mt-4 rounded-md border border-linea ${fuerte ? "" : "overflow-hidden"}`}>
        <LandingRender key={String(reducido)} doc={demo.doc} reducirMovimiento={reducido} />
      </div>
    </section>
  );
}

export function PaginaEfectos() {
  const [reducido, setReducido] = useState(false);
  const todos = [...DEMOS, ...DEMOS_NIVEL_3];

  return (
    <main className="mx-auto w-full max-w-[90rem] px-4 py-10 md:px-8">
      <header className="mb-10 max-w-3xl">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-tinta-suave">Solo desarrollo · /dev/efectos</p>
        <h1 className="mt-2 font-editorial text-4xl font-semibold tracking-tight md:text-5xl">Efectos de nivel 1, 2 y 3</h1>
        <p className="mt-3 text-tinta-suave">
          Cada efecto vive en su sección de ejemplo. Los efectos solo se aplican si están en el catálogo, si la sección los permite y si su nivel no supera la
          intensidad de la landing. Una landing renderiza como máximo 3 efectos de nivel 3. Los de nivel 3 tienen su propio conmutador de reduced-motion y un contador de fps.
        </p>

        <label className="mt-6 flex min-h-11 w-fit cursor-pointer items-center gap-3 rounded-full border border-linea px-5 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-marca">
          <input type="checkbox" checked={reducido} onChange={(evento) => setReducido(evento.target.checked)} className="size-4 accent-[var(--marca)]" />
          Simular «reducir movimiento» (prefers-reduced-motion) en todos
        </label>

        <nav aria-label="Efectos" className="mt-5">
          <ul className="flex flex-wrap gap-2 text-sm">
            {todos.map(({ doc, titulo }) => (
              <li key={doc.meta.slug}>
                <a
                  href={`#${doc.meta.slug}`}
                  className="inline-flex min-h-11 items-center rounded-full border border-linea px-4 hover:bg-papel-hondo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca"
                >
                  {titulo}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <div className="flex flex-col gap-16">
        {todos.map((demo) => (
          <DemoEfecto key={demo.doc.meta.slug} demo={demo} reduccionGlobal={reducido} />
        ))}
      </div>
    </main>
  );
}
