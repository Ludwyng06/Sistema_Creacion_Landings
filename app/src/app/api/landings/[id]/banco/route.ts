import { z } from "zod";
import type { ResultadoValidador } from "@/lib/contratos";
import { guardarEnBanco } from "@/lib/landings";
import { ErrorHttp, json, leerCuerpo, manejar, type Contexto } from "../../../_util";

const Cuerpo = z.object({
  saludRender: z
    .object({
      id: z.literal("anti-split-render"),
      estado: z.enum(["verde", "amarillo", "rojo", "pendiente"]),
      problemas: z.array(z.object({ ruta: z.string(), mensaje: z.string() })),
    })
    .optional(),
});

/**
 * `POST { saludRender?: ResultadoValidador }` pasa la landing a `en-banco` → landing completa.
 * 409 `{ error, motivos: [{ validador, ruta, mensaje }] }` si algún validador está en rojo.
 */
export async function POST(request: Request, { params }: Contexto<{ id: string }>) {
  return manejar(async () => {
    const { id } = await params;
    const { saludRender } = await leerCuerpo(request, Cuerpo);
    const r = await guardarEnBanco(id, saludRender as ResultadoValidador | undefined);
    if (!r.ok) {
      throw new ErrorHttp(409, `No se puede guardar en el banco: ${r.motivos.length} problema(s) en rojo.`, { motivos: r.motivos });
    }
    return json(r.landing);
  });
}
