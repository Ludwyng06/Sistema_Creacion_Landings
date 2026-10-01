import { z } from "zod";
import { Brief, LandingDoc, PromptEstructurado, TecnicaId } from "@/lib/contratos";
import { crearLanding, listarLandings } from "@/lib/landings";
import { json, leerCuerpo, manejar, validarEntrada } from "../_util";

const Nueva = z.object({
  brief: Brief,
  tecnicas: z.array(TecnicaId),
  prompt: PromptEstructurado,
  doc: LandingDoc,
  proveedor: z.string().min(1),
});

const Filtros = z.object({
  tecnica: TecnicaId.optional(),
  puntajeMin: z.coerce.number().min(0).max(10).optional(),
  favoritas: z.enum(["true", "false"]).optional(),
  estado: z.enum(["borrador", "en-banco"]).optional(),
});

/** Crea una landing con el resultado de /crear: `{ brief, tecnicas, prompt, doc, proveedor }` → 201 landing completa. */
export async function POST(request: Request) {
  return manejar(async () => {
    const datos = await leerCuerpo(request, Nueva);
    return json(await crearLanding(datos), 201);
  });
}

/** `GET /api/landings?tecnica&puntajeMin&favoritas&estado` → `{ landings: ResumenLanding[] }` (sin `doc`). */
export async function GET(request: Request) {
  return manejar(async () => {
    const { searchParams } = new URL(request.url);
    const f = validarEntrada(Filtros, Object.fromEntries(searchParams));
    return json({
      landings: await listarLandings({
        tecnica: f.tecnica,
        puntajeMin: f.puntajeMin,
        favoritas: f.favoritas === "true" ? true : undefined,
        estado: f.estado,
      }),
    });
  });
}
