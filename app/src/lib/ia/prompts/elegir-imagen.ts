import { z } from "zod";
import { armarPromptProfesional, type PromptProfesional } from "./comun";

// Tarea `elegir-imagen` (24-A): una sola llamada por slot con todas las candidatas en miniatura. Puntúa cada una de 0 a 10 y elige la mejor.

const Nota = z.number().min(0).max(10);

export const EleccionImagen = z.object({
  candidatas: z
    .array(
      z.object({
        indice: z.number().int().min(0).max(8),
        relevancia: Nota,
        calidad: Nota,
        paleta: Nota,
        aptitud: Nota,
        /** Etiqueta corta de la composición («aurora sobre un lago», «cabaña con luz cálida»): sirve para detectar repeticiones entre slots. */
        escena: z.string().min(3).max(80).optional(),
        /** Texto alternativo en español de lo que de verdad se ve, de 8 a 16 palabras. */
        alt: z.string().min(10).max(220).optional(),
        motivo: z.string().min(3).max(160),
      }),
    )
    .min(1)
    .max(9),
  /** Índice de la mejor candidata, o -1 si ninguna sirve. */
  elegida: z.number().int().min(-1).max(8),
  motivo: z.string().min(3).max(240),
});
export type EleccionImagen = z.infer<typeof EleccionImagen>;

export const EJEMPLO_ELECCION: EleccionImagen = {
  candidatas: [
    { indice: 0, relevancia: 8, calidad: 9, paleta: 7, aptitud: 9, escena: "aurora verde sobre un lago", alt: "Aurora verde sobre un lago helado con montañas nevadas al fondo y cielo despejado", motivo: "Cielo nocturno con aurora verde, sin texto y con espacio libre arriba." },
    { indice: 1, relevancia: 5, calidad: 6, paleta: 6, aptitud: 4, escena: "calle con rótulo de tienda", alt: "Calle de una ciudad de noche con un rótulo luminoso de tienda en la esquina", motivo: "Tiene un rótulo de una tienda visible en la esquina." },
  ],
  elegida: 0,
  motivo: "La primera muestra justo lo que pide el slot y no tiene texto ni logos.",
};

export interface EntradaElegirImagen {
  slot: string;
  seccion: string;
  que: string;
  contextoBrief: string;
  fichaVisual: string;
  /** Una línea por candidata, en el orden de las miniaturas adjuntas. */
  candidatas: { indice: number; origen: string; titulo: string }[];
  /** Las imágenes que ya se eligieron para otros slots de esta landing: se penaliza repetir su composición. */
  yaElegidas?: { slot: string; escena: string }[];
}

export function promptElegirImagen(e: EntradaElegirImagen): PromptProfesional {
  return armarPromptProfesional({
    rol: "Eres director de arte y editor de fotos de una agencia de landings. Eliges, entre varias candidatas, la imagen que mejor sirve a un lugar concreto de la página.",
    tarea: "Mira las miniaturas adjuntas (en el orden de la lista) y puntúa cada una de 0 a 10 en relevancia (muestra lo que pide el slot), calidad técnica (nitidez, luz, encuadre), paleta (encaja con los colores de la landing) y aptitud (sin texto legible, logos, marcas ni personas identificables; deja espacio para el titular si es un héroe). Describe cada una con una etiqueta corta de escena y un texto alternativo en español de 8 a 16 palabras que diga lo que de verdad se ve (sin «imagen de» ni «foto de»). Si una candidata repite la composición de una ya elegida para otro slot, bájale la relevancia 3 puntos. Elige la mejor.",
    contexto: [
      `SLOT: ${e.slot} (sección ${e.seccion})`,
      `LO QUE DEBE MOSTRAR: ${e.que}`,
      `BRIEF\n${e.contextoBrief}`,
      `FICHA VISUAL DE LA LANDING\n${e.fichaVisual}`,
      ...(e.yaElegidas?.length ? [`YA ELEGIDAS PARA OTROS SLOTS DE ESTA LANDING (no repitas su composición)\n${e.yaElegidas.map((y) => `- ${y.slot}: ${y.escena}`).join("\n")}`] : []),
      `CANDIDATAS (en el orden de las imágenes)\n${e.candidatas.map((c) => `${c.indice}. [${c.origen}] ${c.titulo}`).join("\n")}`,
    ].join("\n\n"),
    conocimiento: [
      "Una foto de ambiente real vale más que una genérica; una imagen generada vale si es limpia y fiel al sujeto. Texto legible, marcas o personas identificables bajan la aptitud a 4 o menos.",
      "La nota de aptitud pesa más: una imagen bonita pero con logos no sirve. Si ninguna sirve, responde elegida = -1.",
    ],
    restricciones: [
      "Puntúa solo lo que ves en la miniatura y lo que dice su origen; no inventes detalles.",
      "El alt describe lo visible (sujeto, lugar, luz, acción) en español y tiene entre 8 y 16 palabras; nada genérico como «detalle del tema».",
      "Una nota por candidata, con su índice exacto; `elegida` es uno de esos índices o -1.",
      "Responde únicamente con JSON válido que cumpla el esquema; sin markdown ni texto antes o después.",
    ],
    formato: { esquema: z.toJSONSchema(EleccionImagen), ejemplo: EJEMPLO_ELECCION },
    autocontrol: [
      "¿Hay una nota por cada miniatura, con el índice correcto?",
      "¿La elegida tiene la mejor combinación de relevancia y aptitud?",
      "¿Cada alt tiene entre 8 y 16 palabras y describe lo que se ve?",
      "¿Descarté las que tienen texto, logos o personas identificables?",
    ],
  });
}
