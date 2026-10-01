import type { ModuloTecnica } from "@/lib/contratos";
import { armarPrompt } from "../armado";
import { error, resultado, type Problema } from "./util";

/** Bloque que comparten todos los prompts de imagen: misma luz, lente, ángulo, fondo y paleta. */
export const BLOQUE_CONSISTENCIA =
  "Consistency block: same soft natural window light, 50mm lens, eye-level angle, shallow depth of field, matte neutral backdrop, palette taken from the design tokens.";

export const PLANTILLA_IMAGEN =
  "[SUJETO] {producto} {acción o uso concreto}, [ESCENA] {entorno real coherente con la industria vecina}, [LUZ] {luz de la semilla}, [CÁMARA] {lente, ángulo, profundidad de campo}, [PALETA] {colores de tokens en palabras}, [TEXTURA] documentary photo, natural film grain, real imperfections, [COMPOSICIÓN] {relación} with clear negative space at {zona donde irá el texto}, no text, no logos, no watermark.";

export const tecnicaImagenes: ModuloTecnica = {
  id: "imagenes",
  numero: 4,
  nombre: "Generación de imágenes",
  fase: "entregar",
  descripcionCorta: "Un prompt de Grok Imagine por slot, todos con el mismo bloque de consistencia.",
  prioridad: 4,
  aporta: {
    rol: "Eres director de fotografía de producto y escribes prompts para Grok Imagine.",
    tarea: [
      "Declara un slot por cada sección que necesite imagen, con relación 1:1, 16:9, 9:16 o 4:5 y una descripción concreta.",
      "Escribe un prompt en inglés por slot con la plantilla de imagen y termina cada uno con el bloque de consistencia.",
      "Deriva la paleta y la luz de la semilla y describe personas diversas y naturales, con expresiones espontáneas y fondos con contexto real.",
    ],
    contexto: [
      `Plantilla del prompt de imagen (en inglés):\n${PLANTILLA_IMAGEN}`,
      `Bloque de consistencia (idéntico en todos los slots):\n${BLOQUE_CONSISTENCIA}`,
    ],
    formato: [
      "Cada elemento de `assets[]` lleva { slot, tipo: 'imagen', relacion, promptGrok, alt } y su `promptGrok` incluye el bloque de consistencia completo.",
    ],
  },
  generarPromptIndividual(brief, semilla) {
    return armarPrompt({ brief, modulos: [tecnicaImagenes], semilla, modo: "individual" });
  },
  verificador(doc) {
    const problemas: Problema[] = [];
    if (doc.assets.length === 0) problemas.push(error("assets", "El documento no declara ningún asset."));
    doc.assets.forEach((a, i) => {
      if (!a.promptGrok.trim()) {
        problemas.push(error(`assets[${i}].promptGrok`, `El slot «${a.slot}» no tiene prompt de Grok.`));
      } else if (a.tipo === "imagen" && !a.promptGrok.includes(BLOQUE_CONSISTENCIA)) {
        problemas.push(error(`assets[${i}].promptGrok`, `El slot «${a.slot}» no incluye el bloque de consistencia.`));
      }
    });
    return resultado(problemas);
  },
};
