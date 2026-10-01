import { z } from "zod";
import { PromptEstructurado } from "@/lib/contratos";
import { ErrorEdicion, mejorarPrompt } from "@/lib/ia/edicion";
import { ErrorHttp, json, leerCuerpo, manejar } from "../_util";

const Cuerpo = z.object({ prompt: PromptEstructurado });

/** `POST { prompt: PromptEstructurado }` → `{ prompt: PromptEstructurado, cambios: string[] }`. 422 si el resultado no es válido. */
export async function POST(request: Request) {
  return manejar(async () => {
    const { prompt } = await leerCuerpo(request, Cuerpo);
    try {
      const { prompt: mejorado, cambios } = await mejorarPrompt(prompt);
      return json({ prompt: mejorado, cambios });
    } catch (e) {
      if (e instanceof ErrorEdicion) throw new ErrorHttp(422, e.message);
      throw e;
    }
  });
}
