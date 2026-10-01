import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formularioDe } from "@/app/api/_leads";
import { listarLeads, obtenerPorSlug } from "@/lib/landings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Leads de la landing", robots: { index: false } };

const ETIQUETAS: Record<string, string> = { nombre: "Nombre", correo: "Correo", telefono: "Teléfono", ciudad: "Ciudad", mensaje: "Mensaje" };

const fecha = (iso: string) => new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

const ENLACE_SECUNDARIO =
  "inline-flex min-h-11 items-center rounded-md border border-tinta px-5 text-base font-medium hover:bg-papel-hondo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca";
const ENLACE_PRIMARIO =
  "inline-flex min-h-11 items-center rounded-md bg-marca px-5 text-base font-medium text-marca-texto hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca";

export default async function PaginaLeads({ params }: { params: Promise<{ slug: string }> }) {
  const landing = await obtenerPorSlug((await params).slug);
  if (!landing) notFound();
  const leads = await listarLeads(landing.id);
  const campos = formularioDe(landing.doc)?.campos ?? [];

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 md:px-8">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-tinta-suave">Leads</p>
          <h1 className="mt-1 font-editorial text-4xl font-semibold tracking-tight">{landing.nombre}</h1>
          <p className="mt-2 text-tinta-suave" data-total-leads>
            {leads.length === 0
              ? "Todavía no hay contactos."
              : `${leads.length} ${leads.length === 1 ? "contacto" : "contactos"}, del más reciente al más antiguo.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <a href={`/l/${landing.slug}`} className={ENLACE_SECUNDARIO}>
            Ver la landing
          </a>
          <a href={`/api/landings/${landing.id}/leads.csv`} download className={ENLACE_PRIMARIO}>
            Exportar CSV
          </a>
        </div>
      </header>

      {leads.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-linea">
          <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
            <caption className="sr-only">Contactos recibidos por la landing {landing.nombre}</caption>
            <thead className="bg-papel-hondo">
              <tr>
                <th scope="col" className="p-3 font-medium">
                  Fecha
                </th>
                {campos.map((c) => (
                  <th key={c} scope="col" className="p-3 font-medium">
                    {ETIQUETAS[c] ?? c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id} className="border-t border-linea align-top">
                  <td className="whitespace-nowrap p-3 text-tinta-suave">{fecha(l.creadoEn)}</td>
                  {campos.map((c) => (
                    <td key={c} className="p-3">
                      {l.datos[c] ?? ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
