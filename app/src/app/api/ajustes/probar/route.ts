import { z } from "zod";
import { probarProveedores } from "@/lib/ia/ajustes";
import { json, leerCuerpo, manejar } from "../../_util";

const Cuerpo = z.object({ proveedor: z.enum(["openai", "gemini", "cerebras", "groq", "openrouter"]).optional() });

/**
 * `POST { proveedor? }` prueba uno o todos (en paralelo, 15 s de tope) → `{ resultados: [{ id, ok, ms, error? }] }`.
 * El resultado queda guardado y alimenta el semáforo de `GET /api/ajustes/proveedores`.
 */
export async function POST(request: Request) {
  return manejar(async () => {
    const texto = await request.text();
    const cuerpo = texto.trim() ? await leerCuerpo(new Request(request.url, { method: "POST", body: texto }), Cuerpo) : {};
    return json({ resultados: await probarProveedores(cuerpo.proveedor) });
  });
}
