import { CategoriaBrief } from "@/lib/contratos";
import { ejecutar, type DepsEnrutador } from "@/lib/ia/enrutador";
import { Identificacion } from "@/lib/contratos";

// Tarea `identificar-producto`: Gemini multimodal mira la foto y el nombre. Google Lens queda fuera (pide una URL pública).

export const SISTEMA_IDENTIFICAR =
  "Identificas productos físicos a partir de una foto y el nombre que escribe su dueño, para preparar la búsqueda de información. " +
  "Describe solo lo que se ve en la foto o lo que dice el nombre; no inventes marca, modelo, medidas ni funciones que no se vean. " +
  "Si la foto no deja reconocer el producto (borrosa, no es un producto, no coincide con el nombre), pon `reconocido: false` y una `confianza` baja, " +
  "y devuelve igual las consultas a partir del nombre. Responde con un JSON con: " +
  "`reconocido` (boolean), `tipoProducto` (qué es, en pocas palabras), " +
  `\`categoriaSugerida\` (una de: ${CategoriaBrief.options.join(", ")}), ` +
  "`rasgosVisibles` (hasta 6: material, forma, color y lo que trae la foto), " +
  "`consultas` (2 o 3 búsquedas de Google en español para saber qué beneficios tiene, qué problemas o dudas genera y qué preguntan las personas; sin comillas ni precios) " +
  "y `confianza` (de 0 a 1).";

export interface EntradaIdentificar {
  nombre: string;
  categoria?: CategoriaBrief;
  jpegBase64: string;
}

/** Pregunta a la IA qué producto es. Por el enrutador (regla 9); solo lo atiende un proveedor con visión. */
export async function identificarProducto(e: EntradaIdentificar, deps?: DepsEnrutador): Promise<{ identificacion: Identificacion; proveedor: string }> {
  const r = await ejecutar(
    {
      tarea: "identificar-producto",
      sistema: SISTEMA_IDENTIFICAR,
      usuario: `Nombre que escribió la persona: «${e.nombre}»${e.categoria ? `\nCategoría que eligió: ${e.categoria}` : ""}\nMira la foto adjunta.`,
      esquema: Identificacion,
      imagen: { mimeType: "image/jpeg", base64: e.jpegBase64 },
      maxTokens: 800,
      temperatura: 0.2,
      rapido: true,
    },
    deps,
  );
  const consultas = r.datos.consultas.map((c) => c.replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 3);
  return { identificacion: { ...r.datos, consultas, rasgosVisibles: r.datos.rasgosVisibles.slice(0, 6) }, proveedor: r.proveedor };
}

