"use client";

import { Historial } from "./Historial";
import { Investigacion } from "./Investigacion";
import { Modo } from "./Modo";
import { Proveedores } from "./Proveedores";
import { Tareas } from "./Tareas";
import { UsoHoy } from "./UsoHoy";

/** Contenido de /ajustes: proveedores, uso de IA de hoy, modo, tabla de tareas e historial de uso. */
export function PanelAjustes() {
  return (
    <div className="flex flex-col gap-14">
      <Proveedores />
      <UsoHoy />
      <Modo />
      <Tareas />
      <Investigacion />
      <Historial />
    </div>
  );
}
