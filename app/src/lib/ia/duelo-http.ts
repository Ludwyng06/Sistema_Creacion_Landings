import { z } from "zod";
import { PeticionConstruir, type EventoDuelo } from "@/lib/contratos";
import { construirDuelo } from "./duelo";
import type { DepsEnrutador } from "./enrutador";

const Proveedor = z.enum(["openai", "gemini", "groq", "cerebras", "openrouter"]);

export const PeticionDuelo = PeticionConstruir.extend({ proveedores: z.tuple([Proveedor, Proveedor]).optional() });

/** Manejador de `POST /api/construir-duelo`: NDJSON, un `EventoDuelo` por línea. */
export function crearManejadorDuelo(deps: { enrutador?: DepsEnrutador } = {}) {
  return async function POST(request: Request): Promise<Response> {
    let cuerpo: unknown;
    try {
      cuerpo = await request.json();
    } catch {
      return Response.json({ error: "El cuerpo de la petición debe ser un JSON válido." }, { status: 400 });
    }
    const r = PeticionDuelo.safeParse(cuerpo);
    if (!r.success) return Response.json({ error: z.prettifyError(r.error) }, { status: 400 });

    const codificador = new TextEncoder();
    const flujo = new ReadableStream<Uint8Array>({
      async start(controlador) {
        const emitir = (e: EventoDuelo) => controlador.enqueue(codificador.encode(`${JSON.stringify(e)}\n`));
        try {
          await construirDuelo(r.data, emitir, deps);
        } catch (e) {
          emitir({ tipo: "error", mensaje: e instanceof Error ? e.message : String(e), lado: "juez" });
        } finally {
          controlador.close();
        }
      },
    });
    return new Response(flujo, {
      headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
    });
  };
}
