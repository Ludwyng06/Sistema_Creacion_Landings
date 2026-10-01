import { z } from "zod";
import { obtenerUso } from "@/lib/ia/uso";
import { json, manejar, validarEntrada } from "../_util";

const Consulta = z.object({ dias: z.coerce.number().int().min(1).max(90).default(7) });

/**
 * `GET /api/uso?dias=7` (1 a 90) →
 * `{ dias, desde, porProveedor: [{ proveedor, total, ok, errores, msPromedio, limiteDiario, usoHoy, porcentajeHoy, aviso80 }],
 *    porDia: [{ fecha, total, errores, proveedores: { [id]: n } }],
 *    porDiaProveedor: [{ fecha, proveedor, total, errores, msPromedio }], errores: [{ proveedor, tipo, cantidad, ultimo }], avisos: string[] }`.
 * `aviso80` es `true` cuando el uso de hoy llega al 80 % del límite diario (Gemini solo con `GEMINI_LIMITE_DIARIO`).
 */
export async function GET(request: Request) {
  return manejar(async () => {
    const { dias } = validarEntrada(Consulta, Object.fromEntries(new URL(request.url).searchParams));
    return json(await obtenerUso(dias));
  });
}
