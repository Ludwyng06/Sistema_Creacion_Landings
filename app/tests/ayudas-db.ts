// Importar PRIMERO en los tests que usan la base: fija DATABASE_URL a una copia aislada de la plantilla
// antes de que `@/lib/db` cree el cliente de Prisma.
import { copyFileSync, mkdirSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { dirPruebas, rutaPlantilla, urlSqlite } from "./db-comun";

mkdirSync(dirPruebas(), { recursive: true });
const dir = mkdtempSync(join(dirPruebas(), "t-"));
const ruta = join(dir, "test.db");
copyFileSync(rutaPlantilla(), ruta);
process.env.DATABASE_URL = urlSqlite(ruta);
process.env.MEDIA_DIR = join(dir, "media");
