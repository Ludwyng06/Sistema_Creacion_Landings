import { z, type ZodType } from "zod";
import { ErrorIA, type ProveedorIA, type PromptManual } from "./tipos";
import { extraerJSON, validar } from "./json";

/** Texto del esquema que se añade al mensaje de sistema (compartido con openai-compat). */
export function instruccionEsquema<T>(esquema: ZodType<T>): string {
  return (
    "Responde únicamente con un objeto JSON válido, sin texto adicional ni bloques de código, " +
    "que cumpla este JSON Schema:\n" +
    JSON.stringify(z.toJSONSchema(esquema))
  );
}

/** Prompt listo para copiar en Claude o Grok cuando la cascada se agota. */
export function armarPromptManual<T>(p: {
  sistema: string;
  usuario: string;
  esquema: ZodType<T>;
}): PromptManual {
  return { sistema: `${p.sistema}\n\n${instruccionEsquema(p.esquema)}`, usuario: p.usuario };
}

/** Valida un JSON pegado a mano. */
export function validarPegado<T>(texto: string, esquema: ZodType<T>): T {
  return validar(esquema, extraerJSON(texto));
}

export const proveedorManual: ProveedorIA = {
  id: "manual",
  disponible: () => true,
  async generarJSON() {
    throw new ErrorIA("red", "El proveedor manual no llama a ningún servicio: pega la respuesta JSON.");
  },
};
