import { ApiError, GoogleGenAI } from "@google/genai";
import type { ZodType } from "zod";
import { leerTimeoutMs } from "./entorno";
import { motivoLegible, tipoPorEstado } from "./errores-http";
import { esquemaParaGemini } from "./esquema-json";
import { extraerJSON, validar } from "./json";
import { ErrorIA, type OpcionesLlamada, type ProveedorAmpliado, type ResultadoIA } from "./tipos";

type Env = Record<string, string | undefined>;

/** Parte mínima del SDK que usamos; permite inyectar un cliente simulado en los tests. */
export interface ClienteGemini {
  models: {
    generateContent(p: {
      model: string;
      contents: string | { role: string; parts: Record<string, unknown>[] }[];
      config: Record<string, unknown>;
    }): Promise<{
      text?: string;
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    }>;
  };
}

const MODELO_POR_DEFECTO = "gemini-flash-latest";
/** Modelo al que se pasa cuando el principal responde 503/429; `GEMINI_MODEL_RESPALDO` lo cambia (vacío lo desactiva). */
const MODELO_RESPALDO_POR_DEFECTO = "gemini-3.1-flash-lite";

function traducirError(e: unknown, clave?: string): ErrorIA {
  if (e instanceof ErrorIA) return e;
  if (e instanceof Error && (e.name === "AbortError" || e.name === "TimeoutError"))
    return new ErrorIA("timeout", "gemini: se agotó el tiempo de espera.");
  const estado = e instanceof ApiError ? e.status : (e as { status?: number } | null)?.status;
  const mensaje = e instanceof Error ? e.message : String(e);
  const motivo = motivoLegible(mensaje, [clave]);
  if (/API key not valid|API_KEY_INVALID/i.test(mensaje)) return new ErrorIA("auth", "gemini: clave rechazada.");
  if (estado !== undefined) {
    const tipo = tipoPorEstado(estado);
    const que = tipo === "auth" ? "clave rechazada" : tipo === "limite" ? "límite o saturación" : "error del servicio";
    return new ErrorIA(tipo, `gemini: ${que} (${estado})${motivo ? `: ${motivo}` : ""}`);
  }
  return new ErrorIA("red", `gemini: fallo de red (${motivo}).`);
}

export function crearGemini(env: Env = process.env, cliente?: ClienteGemini): ProveedorAmpliado & { modelo: string } {
  const clave = env.GEMINI_API_KEY;
  const modelo = env.GEMINI_MODEL || MODELO_POR_DEFECTO;
  const respaldo = env.GEMINI_MODEL_RESPALDO ?? MODELO_RESPALDO_POR_DEFECTO;
  const modelos = respaldo && respaldo !== modelo ? [modelo, respaldo] : [modelo];
  return {
    id: "gemini",
    modelo,
    soportaImagen: true,
    soportaVariasImagenes: true,
    disponible: () => Boolean(clave),
    async generarJSON<T>(p: {
      sistema: string;
      usuario: string;
      esquema: ZodType<T>;
      maxTokens?: number;
      temperatura?: number;
    } & OpcionesLlamada): Promise<ResultadoIA<T>> {
      const inicio = performance.now();
      let texto: string | undefined;
      let uso: { promptTokenCount?: number; candidatesTokenCount?: number } | undefined;
      let modeloUsado = modelo;
      const ai = cliente ?? (new GoogleGenAI({ apiKey: clave }) as unknown as ClienteGemini);
      const esquemaJson = esquemaParaGemini(p.esquema);
      // `rapido` (el crítico) empieza por el modelo ligero: sin razonamiento largo responde en segundos.
      const orden = p.rapido && modelos.length > 1 ? [...modelos].reverse() : modelos;
      for (const [i, m] of orden.entries()) {
        try {
          const r = await ai.models.generateContent({
            model: m,
            contents: p.imagen || p.imagenes?.length
              ? [{ role: "user", parts: [{ text: p.usuario }, ...[...(p.imagen ? [p.imagen] : []), ...(p.imagenes ?? [])].map((im) => ({ inlineData: { mimeType: im.mimeType, data: im.base64 } }))] }]
              : p.usuario,
            config: {
              systemInstruction: p.sistema,
              responseMimeType: "application/json",
              responseJsonSchema: esquemaJson,
              abortSignal: AbortSignal.timeout(Math.min(p.timeoutMs ?? Infinity, leerTimeoutMs(env))),
              ...(p.maxTokens !== undefined && { maxOutputTokens: p.maxTokens }),
              ...(p.temperatura !== undefined && { temperature: p.temperatura }),
            },
          });
          texto = r.text;
          uso = r.usageMetadata;
          modeloUsado = m;
          break;
        } catch (e) {
          const error = traducirError(e, clave);
          // Saturación o cuota del modelo principal: el de respaldo tiene su propio cupo.
          if (error.tipo === "limite" && i < orden.length - 1) continue;
          throw error;
        }
      }
      if (!texto) throw new ErrorIA("json", "gemini: la respuesta llegó sin contenido.");
      const datos = validar(p.esquema, extraerJSON(texto));
      return {
        datos,
        proveedor: "gemini",
        modelo: modeloUsado,
        ms: Math.round(performance.now() - inicio),
        ...(uso?.promptTokenCount !== undefined &&
          uso.candidatesTokenCount !== undefined && {
            tokens: { entrada: uso.promptTokenCount, salida: uso.candidatesTokenCount },
          }),
      };
    },
  };
}
