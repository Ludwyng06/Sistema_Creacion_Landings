import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rutaPlantilla, urlSqlite } from "./db-comun";

/** Crea una vez la base SQLite de plantilla con el esquema de Prisma; cada test copia este archivo. */
export default function setup() {
  // Carpeta única por corrida: los workers la heredan por CL_DIR_PRUEBAS.
  const dir = mkdtempSync(join(tmpdir(), "creador-landings-tests-"));
  process.env.CL_DIR_PRUEBAS = dir;
  execSync("npx prisma db push", {
    env: { ...process.env, DATABASE_URL: urlSqlite(rutaPlantilla()) },
    stdio: "pipe",
  });
  // En Windows sharp puede tener aún abierto un archivo de prueba: limpiar es un extra, no un requisito.
  return () => {
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
    } catch {
      // el sistema borra la carpeta temporal más tarde
    }
  };
}
