import { z } from "zod";
import { Brief, LandingDoc } from "@/lib/contratos";
import { validarPegado } from "@/lib/ia/manual";
import { ErrorIA } from "@/lib/ia/tipos";
import { validarTodo } from "@/lib/validadores";

const Peticion = z.object({ texto: z.string().min(1, "Pega la respuesta JSON"), brief: Brief });

/** Valida un LandingDoc pegado a mano (modo manual) y devuelve su salud. */
export async function POST(request: Request): Promise<Response> {
  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    return Response.json({ error: "El cuerpo de la petición debe ser un JSON válido." }, { status: 400 });
  }
  const r = Peticion.safeParse(cuerpo);
  if (!r.success) return Response.json({ error: z.prettifyError(r.error) }, { status: 400 });

  try {
    const doc = validarPegado(r.data.texto, LandingDoc);
    return Response.json(validarTodo(doc, r.data.brief));
  } catch (e) {
    if (e instanceof ErrorIA) return Response.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
