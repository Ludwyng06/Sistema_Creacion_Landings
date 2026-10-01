import sharp from "sharp";
import type { Critica, LandingDoc } from "@/lib/contratos";
import { ejecutar, type DepsEnrutador } from "@/lib/ia/enrutador";
import { CriticaDelModelo, promptCritico } from "@/lib/ia/prompts/critico";
import { resumirParaCritico } from "@/lib/ia/resumen-critico";

// Crítico multimodal: Gemini ve una captura del primer viewport (escritorio y móvil juntos) además del JSON. Misma rúbrica, misma escala
// y mismo umbral. Si no hay captura, no hay proveedor con visión o la llamada falla, degrada al crítico de solo JSON (quien llama decide).

export interface ResultadoCriticoVisual {
  critica: Critica;
  proveedor: string;
  /** `true` si el crítico vio la captura; `false` si se degradó a solo JSON. */
  vio: boolean;
  motivoDegradado?: string;
}

/** Une dos capturas en una sola imagen (escritorio a la izquierda, móvil a la derecha), a 1280 px de alto como máximo. */
export async function componerCaptura(escritorio: Buffer, movil: Buffer): Promise<Buffer> {
  const alto = 720;
  const a = await sharp(escritorio).resize({ height: alto }).jpeg({ quality: 78 }).toBuffer({ resolveWithObject: true });
  const b = await sharp(movil).resize({ height: alto }).jpeg({ quality: 78 }).toBuffer({ resolveWithObject: true });
  return sharp({ create: { width: a.info.width + 24 + b.info.width, height: alto, channels: 3, background: "#ffffff" } })
    .composite([{ input: a.data, left: 0, top: 0 }, { input: b.data, left: a.info.width + 24, top: 0 }])
    .jpeg({ quality: 80 })
    .toBuffer();
}

export async function criticarConCaptura(doc: LandingDoc, contextoBrief: string, captura: Buffer | null, deps?: DepsEnrutador): Promise<ResultadoCriticoVisual> {
  const resumen = resumirParaCritico(doc);
  const llamar = (visual: boolean, imagen?: Buffer) => {
    const p = promptCritico({ documento: resumen, contextoBrief, visual });
    return ejecutar(
      {
        tarea: "critico",
        sistema: p.sistema,
        usuario: p.usuario,
        esquema: CriticaDelModelo,
        maxTokens: 3000,
        temperatura: 0,
        rapido: true,
        plazoMs: 420_000,
        sinCache: true,
        ...(imagen ? { imagen: { mimeType: "image/jpeg", base64: imagen.toString("base64") } } : {}),
      },
      deps,
    );
  };
  if (captura) {
    try {
      const r = await llamar(true, captura);
      return { critica: r.datos, proveedor: r.proveedor, vio: true };
    } catch (e) {
      const motivo = e instanceof Error ? e.message.split("\n")[0] : String(e);
      const r = await llamar(false);
      return { critica: r.datos, proveedor: r.proveedor, vio: false, motivoDegradado: `sin visión (${motivo})` };
    }
  }
  const r = await llamar(false);
  return { critica: r.datos, proveedor: r.proveedor, vio: false, motivoDegradado: "sin captura" };
}
