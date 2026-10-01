import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LandingRender } from "@/componentes/LandingRender";
import { urlFuentes } from "@/lib/fuentes/url";
import { obtenerPorSlug } from "@/lib/landings";
import { ESQUEMAS_SECCION } from "@/secciones/esquemas";

// La landing se lee de la base en cada visita: lo que se edita se ve al recargar.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const landing = await obtenerPorSlug((await params).slug);
  return landing ? { title: landing.nombre, description: landing.doc.meta.producto } : { title: "Landing no encontrada" };
}

export default async function PaginaLanding({ params }: Props) {
  const landing = await obtenerPorSlug((await params).slug);
  if (!landing) notFound();

  // Las secciones se validan aquí, en el servidor: el navegador no descarga zod y una sección inválida no se muestra al público.
  const doc = {
    ...landing.doc,
    secciones: landing.doc.secciones.map((s) => {
      const esquema = ESQUEMAS_SECCION[s.tipo as keyof typeof ESQUEMAS_SECCION];
      return esquema && !esquema.safeParse({ ajustes: s.ajustes, bloques: s.bloques }).success ? { ...s, visible: false } : s;
    }),
  };

  return (
    <>
      <LandingRender doc={doc} urlFuentes={urlFuentes(doc.tokens)?.replace("display=swap", "display=optional") ?? null} landingId={landing.id} diferirSecciones />
      <footer className="border-t border-linea px-5 py-6 text-center text-sm text-tinta-suave">
        <p>{landing.doc.meta.producto}</p>
        <p>Usamos tus datos solo para contactarte sobre este producto.</p>
      </footer>
    </>
  );
}
