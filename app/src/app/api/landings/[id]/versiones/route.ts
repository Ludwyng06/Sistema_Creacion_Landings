import { z } from "zod";
import { guardarVersion, listarVersiones } from "@/lib/landings";
import { json, leerCuerpo, manejar, type Contexto } from "../../../_util";

const Nueva = z.object({ nota: z.string().trim().max(200).optional() });

type Ctx = Contexto<{ id: string }>;

/** `{ versiones: [{ id, landingId, nota, creadoEn }] }`, de la más nueva a la más antigua (sin el documento). */
export async function GET(_request: Request, { params }: Ctx) {
  return manejar(async () => json({ versiones: await listarVersiones((await params).id) }));
}

/** `POST { nota? }` guarda una versión con el documento actual → 201 `{ id, landingId, nota, creadoEn }`. */
export async function POST(request: Request, { params }: Ctx) {
  return manejar(async () => {
    const { id } = await params;
    const cuerpo = await leerCuerpo(request, Nueva);
    return json(await guardarVersion(id, cuerpo.nota), 201);
  });
}
