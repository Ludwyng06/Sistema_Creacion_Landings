import { join } from "node:path";
import { z } from "zod";
import { Encargo } from "@/lib/contratos";
import { generarImagenOpenAI } from "@/lib/imagenes/openai";
import { actualizarDoc, crearLanding, listarLandings } from "@/lib/landings";
import { almacenCheckpointAjuste } from "./checkpoint";
import { crearFuentes } from "@/lib/fuentes/registro";
import { obtenerDepsEnrutador } from "@/lib/ia/deps";
import { candidatosPorDefecto } from "./candidatos";
import { HISTORIAL } from "./diversidad";
import { generarLanding, type DepsGenerar, type EventoGenerar } from "./pipeline";

/**
 * Manejador de `POST /api/generar`: recibe el `Encargo` y emite NDJSON, una línea por evento de `EventoGenerar`:
 * etapas («Entendiendo tu idea…», «Buscando datos e imágenes…», «Definiendo la estrategia…», «Escribiendo sección x/n…»,
 * «Revisando como director creativo…»), los faltantes y, al final, `listo` con el id de la landing guardada.
 */
export function crearManejadorGenerar(sobre: Partial<DepsGenerar> = {}) {
  return async function POST(request: Request): Promise<Response> {
    let cuerpo: unknown;
    try {
      cuerpo = await request.json();
    } catch {
      return Response.json({ error: "El cuerpo de la petición debe ser un JSON válido." }, { status: 400 });
    }
    const r = Encargo.safeParse(cuerpo);
    if (!r.success) return Response.json({ error: z.prettifyError(r.error) }, { status: 400 });

    const dirMedia = join(process.cwd(), "public", "media");
    const fuentes = sobre.fuentes ?? crearFuentes();
    const deps: DepsGenerar = {
      enrutador: obtenerDepsEnrutador(),
      fuentes,
      dirMedia,
      candidatos: (q, enrutado) => candidatosPorDefecto(q, enrutado, { dirMedia, fuentes }),
      guardar: async (p) => {
        const creada = await crearLanding({ brief: p.brief, tecnicas: p.tecnicas, prompt: p.prompt, doc: p.doc, proveedor: p.proveedor });
        return { id: creada.id, slug: creada.slug };
      },
      generarOpenAI: (prompt, relacion) => generarImagenOpenAI(prompt, relacion, { dirMedia }),
      actualizar: async (id, doc) => void (await actualizarDoc(id, doc)),
      checkpoint: almacenCheckpointAjuste,
      historial: async () => (await listarLandings({ conDoc: true })).slice(0, HISTORIAL).map((l) => l.doc),
      ...sobre,
    };

    const codificador = new TextEncoder();
    const flujo = new ReadableStream<Uint8Array>({
      async start(controlador) {
        const emitir = (e: EventoGenerar) => controlador.enqueue(codificador.encode(`${JSON.stringify(e)}\n`));
        try {
          const res = await generarLanding(r.data, emitir, deps);
          emitir({ tipo: "listo", id: res.id, slug: res.slug, criticoPendiente: res.criticoPendiente, ...(res.seccionesPorCompletar.length && { seccionesPorCompletar: res.seccionesPorCompletar }), ...(res.avisos.length && { avisos: res.avisos }) });
        } catch (e) {
          emitir({ tipo: "error", mensaje: e instanceof Error ? e.message : String(e) });
        } finally {
          controlador.close();
        }
      },
    });
    return new Response(flujo, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
  };
}
