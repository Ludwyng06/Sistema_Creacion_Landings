import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Carpeta temporal de las bases SQLite de prueba (una plantilla y una copia por archivo de test).
 * `global-setup` la crea única por corrida y la publica en `CL_DIR_PRUEBAS`, que heredan los workers;
 * así dos worktrees (o dos corridas) nunca comparten ni borran la plantilla del otro.
 */
export const dirPruebas = () => process.env.CL_DIR_PRUEBAS ?? join(tmpdir(), `creador-landings-tests-${process.pid}`);
export const rutaPlantilla = () => join(dirPruebas(), "plantilla.db");

export const urlSqlite = (ruta: string) => `file:${ruta.replaceAll("\\", "/")}`;
