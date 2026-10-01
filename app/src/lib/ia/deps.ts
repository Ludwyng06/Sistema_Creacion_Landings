import type { DepsEnrutador } from "./enrutador";

// Dependencias del enrutador que usan las rutas de la API. En producción no hay nada fijado
// (se usan las claves de .env.local); los tests fijan proveedores simulados.

let deps: DepsEnrutador | undefined;

export function fijarDepsEnrutador(nuevas: DepsEnrutador | undefined): void {
  deps = nuevas;
}

export function obtenerDepsEnrutador(): DepsEnrutador | undefined {
  return deps;
}
