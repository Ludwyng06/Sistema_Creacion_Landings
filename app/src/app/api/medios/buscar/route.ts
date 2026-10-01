import { z } from "zod";
import { OrientacionMedio } from "@/lib/contratos";
import { buscarMedios } from "@/lib/bancos/repositorio";
import { json, manejar, validarEntrada } from "../../_util";

const Consulta = z.object({
  banco: z.string().trim().min(1).optional(),
  q: z.string().trim().min(1).optional(),
  orientacion: OrientacionMedio.optional(),
  limite: z.coerce.number().int().min(1).max(100).optional(),
});

/**
 * `GET /api/medios/buscar?banco=&q=&orientacion=` para el editor y la vitrina.
 * Solo devuelve medios de uso comercial: si `usoComercial` es falso nunca se ofrece.
 */
export async function GET(request: Request) {
  return manejar(async () => {
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const filtro = validarEntrada(Consulta, params);
    return json({ medios: await buscarMedios(filtro) });
  });
}
