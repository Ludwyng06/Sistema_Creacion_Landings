import { duplicarLanding } from "@/lib/landings";
import { json, manejar, type Contexto } from "../../../_util";

/** `POST` copia la landing como borrador nuevo (mismo brief, prompt y documento) → 201 landing completa de la copia. */
export async function POST(_request: Request, { params }: Contexto<{ id: string }>) {
  return manejar(async () => json(await duplicarLanding((await params).id), 201));
}
