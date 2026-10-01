import { z } from "zod";
import { PeticionConstruir, type EventoConstruccion } from "@/lib/contratos";
import { construir, type DepsConstruir } from "./construir";

/** Manejador de `POST /api/construir`: NDJSON en streaming, un evento por línea. */
export function crearManejadorConstruir(deps: DepsConstruir = {}) {
  return async function POST(request: Request): Promise<Response> {
    let cuerpo: unknown;
    try {
      cuerpo = await request.json();
    } catch {
      return Response.json({ error: "El cuerpo de la petición debe ser un JSON válido." }, { status: 400 });
    }
    const r = PeticionConstruir.safeParse(cuerpo);
    if (!r.success) return Response.json({ error: z.prettifyError(r.error) }, { status: 400 });

    const codificador = new TextEncoder();
    const flujo = new ReadableStream<Uint8Array>({
      async start(controlador) {
        const emitir = (e: EventoConstruccion) => controlador.enqueue(codificador.encode(`${JSON.stringify(e)}\n`));
        try {
          await construir(r.data, emitir, deps);
        } catch (e) {
          emitir({ tipo: "error", mensaje: e instanceof Error ? e.message : String(e) });
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
