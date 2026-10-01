import { Editor } from "@/componentes/editor/Editor";
import { obtenerLanding } from "@/lib/landings";

export const metadata = { title: "Editor de landing", robots: { index: false } };

// La landing viaja en el HTML: el editor no espera a un segundo viaje al servidor para pintarse.
export const dynamic = "force-dynamic";

export default async function PaginaEditor({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ seccion?: string }> }) {
  const { id } = await params;
  const { seccion } = await searchParams;
  // Si no existe (o falla la lectura), el editor la pide por la API y muestra su mensaje de error de siempre.
  const inicial = await obtenerLanding(id).catch(() => null);
  return <Editor id={id} inicial={inicial} seccionInicial={seccion} />;
}
