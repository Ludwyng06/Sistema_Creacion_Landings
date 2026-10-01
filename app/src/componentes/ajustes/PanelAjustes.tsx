"use client";

import { Historial } from "./Historial";
import { Investigacion } from "./Investigacion";
import { Modo } from "./Modo";
import { Proveedores } from "./Proveedores";
import { Tareas } from "./Tareas";

/** Contenido de /ajustes: proveedores, modo, tabla de tareas e historial de uso. */
export function PanelAjustes() {
  return (
    <div className="flex flex-col gap-14">
      <Proveedores />
      <Modo />
      <Tareas />
      <Investigacion />
      <Historial />
    </div>
  );
}
