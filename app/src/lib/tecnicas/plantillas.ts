import type { PromptEstructurado } from "@/lib/contratos";

/** Texto final con los 4 encabezados, para copiar y para el modo manual. */
export function aTexto(prompt: PromptEstructurado): string {
  return [
    "### ROL",
    prompt.rol,
    "",
    "### TAREA",
    prompt.tarea,
    "",
    "### CONTEXTO",
    prompt.contexto,
    "",
    "### FORMATO",
    prompt.formato,
    "",
  ].join("\n");
}
