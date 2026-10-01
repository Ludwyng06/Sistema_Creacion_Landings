import { restaurarVersion } from "@/lib/landings";
import { json, manejar, type Contexto } from "../../../../../_util";

/** Restaura la versión (antes guarda la actual como «Antes de restaurar») → landing completa. */
export async function POST(_request: Request, { params }: Contexto<{ id: string; versionId: string }>) {
  return manejar(async () => {
    const { id, versionId } = await params;
    return json(await restaurarVersion(id, versionId));
  });
}
