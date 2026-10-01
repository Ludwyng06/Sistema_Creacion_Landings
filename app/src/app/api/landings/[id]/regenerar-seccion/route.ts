import { z } from "zod";
import { ErrorEdicion, regenerarSeccion } from "@/lib/ia/edicion";
import { actualizarDoc, guardarVersion, obtenerLanding } from "@/lib/landings";
import { ErrorHttp, json, leerCuerpo, manejar, type Contexto } from "../../../_util";

const Cuerpo = z.object({ seccionId: z.string().min(1), instruccion: z.string().trim().max(500).optional() });

/**
 * `POST { seccionId, instruccion? }` → landing completa con solo esa sección regenerada.
 * Conserva `id`, `tipo` y los campos de `editadoPorHumano`; guarda antes la versión «Antes de regenerar <tipo>».
 * 404 si no existe la sección; 422 si la IA devuelve una sección inválida.
 */
export async function POST(request: Request, { params }: Contexto<{ id: string }>) {
  return manejar(async () => {
    const { id } = await params;
    const { seccionId, instruccion } = await leerCuerpo(request, Cuerpo);
    const landing = await obtenerLanding(id);
    const seccion = landing.doc.secciones.find((s) => s.id === seccionId);
    if (!seccion) throw new ErrorHttp(404, `No existe la sección «${seccionId}».`);
    let r;
    try {
      r = await regenerarSeccion(landing.doc, landing.brief, seccionId, instruccion);
    } catch (e) {
      if (e instanceof ErrorEdicion) throw new ErrorHttp(422, e.message);
      throw e;
    }
    await guardarVersion(id, `Antes de regenerar ${seccion.tipo}`);
    return json({ ...(await actualizarDoc(id, r.doc)), proveedorRegeneracion: r.proveedor });
  });
}
