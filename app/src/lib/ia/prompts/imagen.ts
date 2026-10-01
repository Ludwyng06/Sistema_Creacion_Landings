import { z } from "zod";
import { FOTOS } from "../conocimiento";
import { armarPromptProfesional, RESTRICCIONES_COMUNES, type PromptProfesional } from "./comun";

// Prompts de imagen profesionales (docs/v2 §15.3 y §15.4): una ficha común por landing para que todas las imágenes sean coherentes
// y un prompt por slot con sujeto, escena, composición, proporción y restricciones. Se escriben en inglés (FLUX los entiende mejor).

export const RELACIONES = ["1:1", "4:5", "16:9", "9:16"] as const;

export const PromptsImagen = z.object({
  ficha: z.object({ paleta: z.string().min(5).max(160), luz: z.string().min(5).max(160), lente: z.string().min(5).max(100), estilo: z.string().min(5).max(160), fondo: z.string().min(5).max(160) }),
  slots: z.array(z.object({
    slot: z.string().min(1),
    prompt: z.string().min(60).max(700),
    /** Texto alternativo descriptivo en español, de 8 a 25 palabras, que dice qué se ve. */
    alt: z.string().min(30).max(200),
  })).min(1).max(12),
});
export type PromptsImagen = z.infer<typeof PromptsImagen>;

export const EJEMPLO_PROMPTS_IMAGEN: PromptsImagen = {
  ficha: { paleta: "deep navy and teal with warm amber accents", luz: "soft low-key light from one side, gentle glow", lente: "50 mm, shallow depth of field", estilo: "clean product photography, realistic, editorial", fondo: "dark bedroom wall, uncluttered" },
  slots: [{
    slot: "heroe-producto",
    prompt: "A compact white galaxy projector sitting on a wooden nightstand in a dark bedroom, casting soft teal and violet light patterns across the ceiling. Product centered, filling about half of the frame, three-quarter angle. Deep navy and teal palette with warm amber accents, soft low-key side light, 50 mm lens, shallow depth of field, clean realistic product photography. Square 1:1. No text, no logos, no watermark, no people.",
    alt: "Proyector de galaxias blanco sobre una mesa de noche que llena de luces verdes y violetas el techo de una habitación oscura",
  }],
};

export interface SlotAGenerar {
  slot: string;
  /** Qué debe mostrar (objetivo de la imagen y objeción que mata). */
  que: string;
  relacion: (typeof RELACIONES)[number];
}

export interface EntradaImagenes {
  contextoBrief: string;
  contextoEstrategia: string;
  contextoSemilla: string;
  /** Rasgos visibles del producto que el vendedor dio (sin inventar variantes ni accesorios). */
  producto: string;
  slots: SlotAGenerar[];
}

/** Cierre fijo que se agrega a cada prompt de slot antes de generar: nada de texto, marcas ni personas. */
export const RESTRICCIONES_DE_IMAGEN = "No text, no letters, no logos, no brand names, no watermark, no people, no hands.";

export function promptImagenes(e: EntradaImagenes): PromptProfesional {
  return armarPromptProfesional({
    rol: "Eres director de arte para ecommerce y fotografía publicitaria. Escribes prompts en inglés para un generador de imágenes (FLUX) y describes en español cada imagen para quien no la ve.",
    tarea: "Define la ficha común de esta landing (paleta de la semilla, luz, lente, estilo y fondo) y un prompt por slot con sujeto, escena, composición, proporción y restricciones. Cada imagen mata una objeción y todas parecen de la misma sesión. Objetivo medible: un prompt de 60 a 700 caracteres por slot que incluya la ficha, y un texto alternativo descriptivo por slot.",
    contexto: [`BRIEF\n${e.contextoBrief}`, `ESTRATEGIA\n${e.contextoEstrategia}`, `SEMILLA Y TOKENS\n${e.contextoSemilla}`, `PRODUCTO (solo lo que el vendedor dijo)\n${e.producto}`, `SLOTS A GENERAR\n${e.slots.map((s) => `- ${s.slot} (${s.relacion}): ${s.que}`).join("\n")}`].join("\n\n"),
    conocimiento: [FOTOS],
    restricciones: [
      ...RESTRICCIONES_COMUNES.filter((r) => !r.startsWith("Lista negra")),
      "Los prompts van en inglés; los textos alternativos, en español neutro.",
      "El producto es el protagonista: ocupa al menos el 45 % del encuadre en el héroe y es fiel a lo que dijo el vendedor (forma, color, escala). No agregues accesorios, variantes ni funciones que no estén en el brief.",
      "Nada de texto legible, logos, marcas, marcas de agua ni personas (nunca se presentan personas como clientes reales).",
      "Cada prompt repite la paleta, la luz, la lente y el estilo de la ficha común; cambia solo el sujeto, la escena y la composición.",
      "El texto alternativo dice qué se ve (objeto, lugar, luz), no «imagen de»; de 8 a 25 palabras.",
    ],
    formato: { esquema: z.toJSONSchema(PromptsImagen), ejemplo: EJEMPLO_PROMPTS_IMAGEN },
    autocontrol: [
      "¿Hay un prompt por cada slot pedido, con el nombre exacto?",
      "¿Cada prompt lleva la paleta, la luz, la lente y el estilo de la ficha?",
      "¿El producto ocupa al menos el 45 % del héroe y no tiene accesorios inventados?",
      "¿Ningún prompt pide texto, logos, marcas ni personas?",
      "¿Cada imagen responde una objeción distinta?",
      "¿Cada texto alternativo describe lo que se ve y tiene entre 8 y 25 palabras?",
    ],
  });
}
