import { z } from "zod";
import { corregirDoc } from "@/lib/ia/corregir";
import { obtenerDepsEnrutador } from "@/lib/ia/deps";
import { ejecutar } from "@/lib/ia/enrutador";
import { actualizarDoc, obtenerLanding } from "@/lib/landings";
import { json, leerCuerpo, manejar } from "../_util";

const Cuerpo = z.object({ landingId: z.string().min(1) });

/**
 * `POST { landingId }` aplica al documento guardado la corrección de lista negra por lotes.
 * → `{ doc, corregidas: number, pendientes: [{ ruta, regla, fragmento }] }` (los campos de `editadoPorHumano` no se tocan).
 */
export async function POST(request: Request) {
  return manejar(async () => {
    const { landingId } = await leerCuerpo(request, Cuerpo);
    const landing = await obtenerLanding(landingId);
    const avisos: string[] = [];
    const r = await corregirDoc(landing.doc, { llamar: (p) => ejecutar(p, obtenerDepsEnrutador()), avisos });
    const guardada = r.corregidas > 0 ? (await actualizarDoc(landingId, r.doc)).doc : r.doc;
    return json({ doc: guardada, corregidas: r.corregidas, pendientes: r.pendientes, avisos });
  });
}
