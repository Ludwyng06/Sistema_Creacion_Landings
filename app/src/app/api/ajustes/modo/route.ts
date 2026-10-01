import { EsquemaModo, guardarModo, obtenerModo } from "@/lib/ia/ajustes";
import { json, leerCuerpo, manejar } from "../../_util";

/** `GET` → `{ modo: "cascada" | "simultaneo" | "duelo", cascada: ProveedorId[] }` (lo guardado manda sobre IA_MODO / IA_CASCADA). */
export async function GET() {
  return manejar(async () => json(await obtenerModo()));
}

/** `PUT { modo, cascada }` guarda en `Ajuste` (`ia.modo`, `ia.cascada`) y devuelve lo guardado. 400 si es inválido. */
export async function PUT(request: Request) {
  return manejar(async () => {
    await guardarModo(await leerCuerpo(request, EsquemaModo));
    return json(await obtenerModo());
  });
}
