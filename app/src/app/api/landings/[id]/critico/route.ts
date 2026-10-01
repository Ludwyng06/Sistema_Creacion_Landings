import { almacenCheckpointAjuste } from "@/lib/generar/checkpoint";
import { reintentarCritico } from "@/lib/generar/reintentar-critico";
import { obtenerDepsEnrutador } from "@/lib/ia/deps";
import { obtenerLanding } from "@/lib/landings";
import { json, manejar, type Contexto } from "../../../_util";

/**
 * Checkpoint del crítico de una landing (la UI es de B: botón «Reintentar el crítico» en el visor y el banco).
 *
 * `GET` → `{ criticoPendiente, puntaje, etapa, avisos, seccionesPorCompletar }`: pendiente cuando la landing no tiene nota
 * (el crítico falló por cuota al generarla).
 * `POST` (sin cuerpo) → corre solo el crítico sobre la landing guardada y devuelve `{ landing, puntaje, bajoUmbral }`.
 * Si todavía no hay cupo responde 503 con `{ error, intentos, promptManual }` y la landing sigue pendiente.
 */
export async function GET(_request: Request, { params }: Contexto<{ id: string }>) {
  return manejar(async () => {
    const { id } = await params;
    const landing = await obtenerLanding(id);
    const cp = await almacenCheckpointAjuste.leer(id).catch(() => null);
    return json({
      criticoPendiente: landing.criticoPendiente,
      puntaje: landing.puntaje,
      etapa: cp?.etapa ?? null,
      avisos: cp?.avisos ?? [],
      seccionesPorCompletar: cp?.seccionesPorCompletar ?? [],
    });
  });
}

export async function POST(_request: Request, { params }: Contexto<{ id: string }>) {
  return manejar(async () => {
    const { id } = await params;
    return json(await reintentarCritico(id, { enrutador: obtenerDepsEnrutador() }));
  });
}
