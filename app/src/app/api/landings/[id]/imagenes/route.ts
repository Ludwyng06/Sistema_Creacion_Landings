import { obtenerDepsEnrutador } from "@/lib/ia/deps";
import { repararImagenes } from "@/lib/generar/reparar-imagenes";
import { json, manejar, type Contexto } from "../../../_util";

/**
 * `POST` (sin cuerpo) → llena los marcadores de imagen de una landing ya guardada con la misma regla de la generación: bancos y APIs gratuitas
 * por palabras clave, OpenAI (gpt-image-2 low) fuera de espacio o para el producto, crítico `elegir-imagen`, FLUX de último recurso.
 * Guarda antes la versión «Antes de buscar fotos». Responde `{ landing, asignados, marcadores, avisos, notas }`.
 * Los avisos y las alternativas por slot quedan en el checkpoint (`GET /api/landings/[id]/critico`). La UI («Buscar fotos») es de B.
 */
export async function POST(_request: Request, { params }: Contexto<{ id: string }>) {
  return manejar(async () => {
    const { id } = await params;
    return json(await repararImagenes(id, { enrutador: obtenerDepsEnrutador() }));
  });
}
