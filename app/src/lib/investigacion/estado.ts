import { claveSerpApi, ErrorSerpApi, leerCuenta, type OpcionesSerpApi } from "./serpapi";

export type EstadoInvestigacion =
  | { estado: "sin-clave" }
  | { estado: "conectado"; plan?: string; usadasMes: number; limiteMes: number }
  | { estado: "error"; error: string };

/** Estado de SerpAPI para /ajustes. Lee `account.json`, que no gasta búsquedas. Nunca devuelve la clave. */
export async function estadoInvestigacion(op: OpcionesSerpApi = {}): Promise<EstadoInvestigacion> {
  if (!claveSerpApi(op.env ?? process.env)) return { estado: "sin-clave" };
  try {
    const c = await leerCuenta(op);
    return { estado: "conectado", plan: c.plan, usadasMes: c.usadasMes, limiteMes: c.limiteMes };
  } catch (e) {
    return { estado: "error", error: e instanceof ErrorSerpApi ? e.message : "No se pudo consultar SerpAPI." };
  }
}
