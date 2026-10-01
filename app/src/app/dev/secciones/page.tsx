import { notFound } from "next/navigation";
import { LandingRender } from "@/componentes/LandingRender";
import { VARIANTES_HEROE } from "@/lib/contratos";
import { registro } from "@/secciones/registro";
import { DOCUMENTOS_REVISION, primerEjemploPorTipo } from "./documentos";

export const metadata = { title: "Revisión de secciones · desarrollo" };

const CHIP =
  "inline-flex min-h-11 items-center rounded-full border border-linea px-4 hover:bg-papel-hondo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca";

export default function PaginaRevisionSecciones() {
  if (process.env.NODE_ENV === "production") notFound();

  const porTipo = primerEjemploPorTipo();
  const tiposConEjemplo = Object.entries(registro).map(([tipo, definicion]) => ({
    tipo,
    etiqueta: definicion.etiqueta,
    ancla: tipo === "heroe" ? "revision-producto-monumental" : porTipo[tipo as keyof typeof porTipo],
  }));

  return (
    <main className="mx-auto w-full max-w-[90rem] px-4 py-10 md:px-8">
      <header className="mb-10 max-w-3xl">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-tinta-suave">
          Solo desarrollo · /dev/secciones
        </p>
        <h2 className="mt-2 font-editorial text-4xl font-semibold tracking-tight md:text-5xl">
          Revisión de secciones
        </h2>
        <p className="mt-3 text-tinta-suave">
          Cada bloque es un <code className="font-mono text-sm">LandingDoc</code> armado con los{" "}
          <code className="font-mono text-sm">ejemplo.ts</code> y pintado con{" "}
          <code className="font-mono text-sm">LandingRender</code>. Los datos que faltan del brief
          aparecen como <code className="font-mono text-sm">[COMPLETAR]</code>.
        </p>

        <nav aria-label="Las 8 variantes de héroe" className="mt-6">
          <p className="mb-2 text-sm font-medium">Variantes de héroe ({VARIANTES_HEROE.length})</p>
          <ul className="flex flex-wrap gap-2 text-sm">
            {VARIANTES_HEROE.map((variante) => (
              <li key={variante}>
                <a href={`#revision-${variante}`} className={CHIP}>
                  {variante}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Las 18 secciones" className="mt-6">
          <p className="mb-2 text-sm font-medium">Secciones ({tiposConEjemplo.length})</p>
          <ul className="flex flex-wrap gap-2 text-sm">
            {tiposConEjemplo.map(({ tipo, etiqueta, ancla }) => (
              <li key={tipo}>
                <a href={ancla ? `#${ancla}` : "#"} className={CHIP}>
                  {etiqueta}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <div className="flex flex-col gap-16">
        {DOCUMENTOS_REVISION.map(({ titulo, nota, doc }) => (
          <section key={doc.meta.slug} id={doc.meta.slug} aria-labelledby={`${doc.meta.slug}-titulo`}>
            <h3
              id={`${doc.meta.slug}-titulo`}
              className="font-editorial text-2xl font-semibold tracking-tight"
            >
              {titulo}
            </h3>
            <p className="mb-4 mt-1 text-sm text-tinta-suave">{nota}</p>
            <div className="overflow-hidden rounded-md border border-linea">
              <LandingRender doc={doc} />
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
