import type { ZodType } from "zod";

export type ProveedorId = "openai" | "gemini" | "groq" | "cerebras" | "openrouter" | "manual";

export type ModoIA = "cascada" | "simultaneo" | "duelo";

export type TareaIA =
  | "objeciones"
  | "landing"
  | "prompts-grok"
  | "corregir-lista-negra"
  | "humanizar"
  | "critico"
  | "mejorar-prompt"
  | "juez-duelo"
  | "investigar"
  | "identificar-producto"
  | "describir-medio"
  | "dato-curioso"
  | "estrategia"
  | "plan-secciones"
  | "redactar-seccion"
  | "prompts-imagen"
  | "validar-imagen"
  | "intake"
  | "elegir-imagen";

export interface ResultadoIA<T> {
  datos: T;
  proveedor: string;
  modelo: string;
  ms: number;
  tokens?: { entrada: number; salida: number };
}

/** Imagen para las tareas multimodales (`identificar-producto`). */
export interface ImagenIA {
  mimeType: string;
  base64: string;
}

export interface ProveedorIA {
  id: ProveedorId;
  disponible(): boolean;
  generarJSON<T>(p: {
    sistema: string;
    usuario: string;
    esquema: ZodType<T>;
    maxTokens?: number;
    temperatura?: number;
    /** Solo la entienden los proveedores con visión (Gemini). */
    imagen?: ImagenIA;
  }): Promise<ResultadoIA<T>>;
}

export type TipoErrorIA = "limite" | "red" | "json" | "auth" | "timeout";

export class ErrorIA extends Error {
  readonly tipo: TipoErrorIA;

  constructor(tipo: TipoErrorIA, mensaje: string) {
    super(mensaje);
    this.name = "ErrorIA";
    this.tipo = tipo;
  }
}
