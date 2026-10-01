import { EsquemaTareas, guardarTareas, obtenerTareas } from "@/lib/ia/ajustes";
import { json, leerCuerpo, manejar } from "../../_util";

/** `GET` → `{ tareas: { [tarea]: ProveedorId } }` con las 8 tareas (lo guardado sobre los valores por defecto). */
export async function GET() {
  return manejar(async () => json({ tareas: await obtenerTareas() }));
}

/** `PUT { tareas: { [tarea]?: ProveedorId } }` guarda en `Ajuste` (`ia.tareas`). 400 con una tarea o proveedor desconocidos. */
export async function PUT(request: Request) {
  return manejar(async () => {
    const { tareas } = await leerCuerpo(request, EsquemaTareas);
    return json({ tareas: await guardarTareas(tareas) });
  });
}
