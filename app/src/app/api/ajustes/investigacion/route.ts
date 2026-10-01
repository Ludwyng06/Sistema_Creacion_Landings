import { estadoInvestigacion } from "@/lib/investigacion/estado";
import { json, manejar } from "../../_util";

/**
 * `GET` (y `POST`, el botón «Probar») → `{ estado: "sin-clave" }`
 * | `{ estado: "conectado", plan?, usadasMes, limiteMes }` | `{ estado: "error", error }`.
 * Consulta `account.json` de SerpAPI: no gasta búsquedas. Nunca devuelve la clave.
 */
export async function GET() {
  return manejar(async () => json(await estadoInvestigacion()));
}

export const POST = GET;
