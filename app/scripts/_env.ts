// Se importa primero en los scripts: carga app/.env.local antes de que los demás módulos lean el entorno.
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

/** Mensaje legible para los errores frecuentes de los scripts. */
export function explicarError(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (/does not exist in the current database|no such table/i.test(m)) {
    return "La base de datos no tiene las tablas. Ejecuta primero:  npm run db:push";
  }
  return m;
}
