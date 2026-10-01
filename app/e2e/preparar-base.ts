import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

const BASE = "file:./e2e-test.db";

/**
 * Crea una base SQLite de prueba limpia con el esquema de Prisma y los 5 ejemplos del banco (sin llamar a la IA).
 * Debe correr ANTES de que arranque el servidor: en Windows, si el servidor ya abrió el archivo no se puede borrar.
 */
export function prepararBase() {
  for (const sufijo of ["", "-journal", "-wal", "-shm"]) rmSync(`e2e-test.db${sufijo}`, { force: true });
  const env = { ...process.env, DATABASE_URL: BASE };
  execSync("npx prisma db push", { env, stdio: "pipe" });
  // El banco de ejemplo sale de datos/semilla-manual/*.json.
  execSync("npx tsx scripts/semilla-db.ts --desde-json", {
    env: { ...env, GEMINI_API_KEY: "", GROQ_API_KEY: "", CEREBRAS_API_KEY: "", OPENROUTER_API_KEY: "" },
    stdio: "pipe",
  });
}
