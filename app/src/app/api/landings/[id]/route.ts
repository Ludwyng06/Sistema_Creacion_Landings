import { z } from "zod";
import { LandingDoc } from "@/lib/contratos";
import { marcarEditadoPorHumano } from "@/lib/ia/rutas";
import {
  actualizarDoc,
  alternarFavorita,
  eliminarLanding,
  obtenerLanding,
  renombrarLanding,
} from "@/lib/landings";
import { json, leerCuerpo, manejar, type Contexto } from "../../_util";

const Cambio = z
  .object({ doc: LandingDoc.optional(), favorita: z.boolean().optional(), nombre: z.string().trim().min(1).max(120).optional() })
  .refine((c) => c.doc !== undefined || c.favorita !== undefined || c.nombre !== undefined, {
    message: "Envía `doc`, `favorita` o `nombre`.",
  });

type Ctx = Contexto<{ id: string }>;

/** Landing completa: resumen + `brief`, `prompt` (texto), `promptBloques` y `doc`. */
export async function GET(_request: Request, { params }: Ctx) {
  return manejar(async () => json(await obtenerLanding((await params).id)));
}

/**
 * `PATCH { doc }` autoguarda (sin crear versión) y marca `editadoPorHumano` en las secciones con textos cambiados;
 * `PATCH { favorita: boolean }`; `PATCH { nombre: string }`. Devuelve la landing completa.
 */
export async function PATCH(request: Request, { params }: Ctx) {
  return manejar(async () => {
    const { id } = await params;
    const cambio = await leerCuerpo(request, Cambio);
    let landing = await obtenerLanding(id);
    if (cambio.doc) landing = await actualizarDoc(id, marcarEditadoPorHumano(landing.doc, cambio.doc));
    if (cambio.nombre !== undefined) landing = await renombrarLanding(id, cambio.nombre);
    if (cambio.favorita !== undefined && cambio.favorita !== landing.favorita) landing = await alternarFavorita(id);
    return json(landing);
  });
}

/** Elimina la landing con sus versiones y leads. */
export async function DELETE(_request: Request, { params }: Ctx) {
  return manejar(async () => {
    await eliminarLanding((await params).id);
    return json({ ok: true });
  });
}
