import { z } from "zod";

// Tarea `validar-imagen` (Gemini multimodal): ¿esta imagen muestra lo esperado de forma apta para una landing?

export const ValidacionImagen = z.object({
  apta: z.boolean(),
  motivo: z.string().min(3).max(240),
  confianza: z.number().min(0).max(1),
});
export type ValidacionImagen = z.infer<typeof ValidacionImagen>;

export const SISTEMA_VALIDAR_IMAGEN =
  "Eres editor de imágenes de una tienda online. Recibes una imagen y lo que se espera que muestre, y decides si sirve para una landing. " +
  "Revisa: 1) ¿muestra de verdad lo esperado (no algo parecido)? 2) ¿tiene texto legible, logos, marcas o rótulos visibles? 3) ¿hay personas identificables? 4) ¿la calidad, el encuadre y la luz son aptos? " +
  "Responde apta=false si no muestra lo esperado, si tiene texto o logos visibles, si hay personas identificables o si es un mapa, gráfico o captura. " +
  'Responde solo con JSON { "apta": boolean, "motivo": "una frase en español que dice qué se ve y por qué sí o no", "confianza": número de 0 a 1 }.';

export function usuarioValidarImagen(esperado: string): string {
  return `Lo que se espera que muestre: ${esperado}\n¿Esta imagen muestra eso de forma apta para una landing? ¿Tiene texto, logos, marcas o personas identificables? Mira la imagen adjunta.`;
}
