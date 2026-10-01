import { listarProveedores } from "@/lib/ia/ajustes";
import { json, manejar } from "../../_util";

/**
 * `GET` → `{ proveedores: [{ id, nombre, modelo, tieneClave, estado, ultimoError?, usoHoy, limiteDiario, porcentaje }] }`
 * con `estado`: "sin-clave" | "conectado" | "limite" | "error" | "sin-probar". Nunca devuelve las claves.
 */
export async function GET() {
  return manejar(async () => json({ proveedores: await listarProveedores() }));
}
