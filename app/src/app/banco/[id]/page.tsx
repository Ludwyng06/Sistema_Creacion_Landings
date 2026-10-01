import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Cabecera } from "@/componentes/ajustes/Cabecera";
import { AccionesDetalle } from "@/componentes/banco/AccionesDetalle";
import { PromptCompleto } from "@/componentes/banco/PromptCompleto";
import { Versiones } from "@/componentes/banco/Versiones";
import { VistaDividida } from "@/componentes/banco/VistaDividida";
import { claseDePuntaje } from "@/componentes/banco/estilos";
import { formatearFecha } from "@/lib/banco";
import { LandingNoEncontrada, listarVersiones, obtenerLanding, type LandingCompleta } from "@/lib/landings";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

async function cargar(id: string): Promise<LandingCompleta | null> {
  try {
    return await obtenerLanding(id);
  } catch (e) {
    if (e instanceof LandingNoEncontrada) return null;
    throw e;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const landing = await cargar((await params).id);
  return { title: landing ? `${landing.nombre} · Banco` : "Landing no encontrada" };
}

export default async function PaginaDetalleBanco({ params }: Props) {
  const { id } = await params;
  const landing = await cargar(id);
  if (!landing) notFound();
  const versiones = await listarVersiones(id);
  const puntaje = landing.puntaje;

  return (
    <>
      <Cabecera actual="/banco" titulo={landing.nombre} ancho="max-w-7xl" />
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-4">
          <Link href="/banco" className="inline-flex min-h-11 items-center text-sm text-tinta-suave hover:underline">
            ← Volver al banco
          </Link>
          <p className="text-tinta-suave">{landing.doc.meta.producto}</p>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-tinta-suave" data-meta>
            <span>{landing.proveedor}</span>
            <span>{formatearFecha(landing.creadoEn)}</span>
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${claseDePuntaje(puntaje)}`}>
              {puntaje === null ? "Sin crítico" : `Crítico ${puntaje.toFixed(1).replace(".", ",")}/10`}
            </span>
            {landing.estado !== "en-banco" && <span className="rounded-full border border-linea px-2.5 py-0.5 text-xs">Borrador</span>}
          </p>
          <AccionesDetalle id={landing.id} />
        </div>

        <VistaDividida
          landing={
            <section aria-label="La landing" data-landing className="flex flex-col gap-2">
              <iframe
                src={`/l/${landing.slug}`}
                title={`Vista de la landing ${landing.nombre}`}
                loading="lazy"
                className="h-[70vh] w-full rounded-md border border-linea bg-papel lg:h-[calc(100vh-6rem)]"
              />
              <a href={`/l/${landing.slug}`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-sm text-marca underline">
                Abrir la landing en una pestaña
              </a>
            </section>
          }
          prompt={<PromptCompleto landing={landing} />}
        />

        <Versiones landingId={landing.id} versiones={versiones} />
      </main>
    </>
  );
}
