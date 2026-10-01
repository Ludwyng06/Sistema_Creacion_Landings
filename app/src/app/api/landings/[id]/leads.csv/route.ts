import { listarLeads, obtenerLanding } from "@/lib/landings";
import { construirCsv, formularioDe } from "../../../_leads";
import { manejar, type Contexto } from "../../../_util";

/** CSV UTF-8 con BOM: `fecha` + campos del formulario. `Content-Disposition: leads-<slug>-<fecha>.csv`. */
export async function GET(_request: Request, { params }: Contexto<{ id: string }>) {
  return manejar(async () => {
    const { id } = await params;
    const landing = await obtenerLanding(id);
    const csv = construirCsv(formularioDe(landing.doc)?.campos ?? [], await listarLeads(id));
    const fecha = new Date().toISOString().slice(0, 10);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="leads-${landing.slug}-${fecha}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
