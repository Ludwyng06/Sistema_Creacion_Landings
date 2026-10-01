import { z } from "zod";
import { Brief, TecnicaId } from "@/lib/contratos";
import { combinar } from "@/lib/tecnicas/combinador";
import { aTexto } from "@/lib/tecnicas/plantillas";
import { tirarSemilla, tokensParaBrief } from "@/lib/tecnicas/semillas";

const Peticion = z.object({
  brief: Brief,
  tecnicas: z.array(TecnicaId).default([]),
  numeroSemilla: z.number().int().optional(),
});

/** Arma el prompt combinado. No llama a ninguna IA. */
export async function POST(request: Request): Promise<Response> {
  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    return Response.json({ error: "El cuerpo de la petición debe ser un JSON válido." }, { status: 400 });
  }

  const r = Peticion.safeParse(cuerpo);
  if (!r.success) return Response.json({ error: z.prettifyError(r.error) }, { status: 400 });

  const { brief, tecnicas, numeroSemilla } = r.data;
  // Siempre hay semilla: los tokens son la fuente visual de cualquier landing, la pida o no la técnica 1.
  const { semilla } = tirarSemilla(numeroSemilla, brief.intensidad);
  const tokens = tokensParaBrief(semilla, brief);
  const prompt = combinar(brief, tecnicas, semilla);
  return Response.json({ prompt, texto: aTexto(prompt), semilla, tokens });
}
