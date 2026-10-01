import { listarLeads, obtenerLanding } from "@/lib/landings";
import { formularioDe } from "../../../_leads";
import { json, manejar, type Contexto } from "../../../_util";

/** `{ campos: string[], leads: [{ id, landingId, datos, creadoEn }] }`, del más nuevo al más antiguo. */
export async function GET(_request: Request, { params }: Contexto<{ id: string }>) {
  return manejar(async () => {
    const { id } = await params;
    const landing = await obtenerLanding(id);
    return json({ campos: formularioDe(landing.doc)?.campos ?? [], leads: await listarLeads(id) });
  });
}
