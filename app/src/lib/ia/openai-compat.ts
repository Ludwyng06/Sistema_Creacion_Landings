import type { ZodType } from "zod";
import { instruccionEsquemaCompacta } from "./compactar";
import type { ContadorGasto } from "./gasto";
import { crearGuardiaCupoDia, leerCupoDia, type GuardiaCupoDia } from "./cupo-dia";
import { leerTimeoutMs } from "./entorno";
import { ErrorNoCabe, motivoLegible, tipoPorEstado } from "./errores-http";
import { extraerJSON, validar } from "./json";
import { instruccionEsquema } from "./manual";
import { ErrorIA, type OpcionesLlamada, type ProveedorAmpliado, type ResultadoIA } from "./tipos";

/** Respuesta que se da por hecha cuando la tarea no fija `maxTokens` (una landing completa ronda los 5.000). */
const SALIDA_ESPERADA_TOKENS = 4000;
/** Espera por defecto entre el modelo principal y el de respaldo tras un 429/503. */
const ESPERA_ENTRE_MODELOS_MS = 1500;
/** Español con JSON en el tokenizador de Groq: medido 3,57 (17.354 caracteres = 4.866 tokens). */
const CARACTERES_POR_TOKEN = 3.6;
/** Margen para el error de la estimación de tokens de entrada. */
const MARGEN_TOKENS = 150;
/** Menos salida que esto no alcanza para un JSON útil: mejor no llamar y pasar al siguiente proveedor. */
const SALIDA_MINIMA_TOKENS = 2400;

export interface OpcionesCompatible {
  id: "openai" | "groq" | "cerebras" | "openrouter";
  baseUrl: string;
  clave?: string;
  modelo: string;
  timeoutMs?: number;
  /** Tokens por minuto del plan gratuito (Groq: 8000). Una petición que no cabe ni sola se descarta sin llamar. */
  limiteTokensMinuto?: number;
  /** Campos extra del cuerpo (p. ej. el esfuerzo de razonamiento, que en modelos gratuitos domina el tiempo). */
  cuerpoExtra?: Record<string, unknown>;
  /** Modelos a probar, en orden, cuando el principal responde con límite o saturación (429/503). */
  modelosRespaldo?: string[];
  /** Espera entre el modelo principal y el de respaldo cuando el principal da 429/503 (backoff); los tests inyectan una inmediata. */
  esperaEntreModelosMs?: number;
  /** Cola que reparte las peticiones por minuto del plan (Cerebras: 5). Cada intento HTTP espera su turno. */
  cola?: { esperar(): Promise<void> };
  /** Lee `x-ratelimit-remaining-*-day` de cada respuesta y salta a otro proveedor antes de agotar el cupo del día (Cerebras). */
  cupoDia?: boolean | GuardiaCupoDia;
  /** Entiende imágenes en el mensaje (OpenAI): las tareas con imagen se le envían y el mensaje lleva `image_url`. */
  soportaImagen?: boolean;
  soportaVariasImagenes?: boolean;
  /** Cuenta tokens y USD por día y salta a otro proveedor al llegar al presupuesto (OpenAI). */
  gasto?: ContadorGasto;
  /** Solo para tests; por defecto `globalThis.fetch`. */
  fetchFn?: typeof fetch;
}

interface RespuestaChat {
  choices?: { message?: { content?: string | null; reasoning?: string | null; reasoning_content?: string | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/** Desde esta temperatura (con OpenAI y un modelo que admite «none») la petición pasa a razonamiento «none» + `temperature`; por debajo va con «low» y sin temperatura. */
export const TEMPERATURA_CREATIVA_MIN = 0.6;

/** gpt-5.x y la serie o: razonan, usan `max_completion_tokens` y no aceptan `temperature` distinta de 1. */
export function esModeloConRazonamiento(modelo: string): boolean {
  return /^(gpt-5|o\d)/i.test(modelo) && !/chat/i.test(modelo);
}

/** gpt-5.1 en adelante aceptan `reasoning_effort: "none"`; el gpt-5 original no. */
export function admiteSinRazonamiento(modelo: string): boolean {
  return /^gpt-5\.\d/i.test(modelo);
}

function esAbort(e: unknown): boolean {
  return e instanceof Error && (e.name === "AbortError" || e.name === "TimeoutError");
}

/** Un solo adaptador para Groq, Cerebras y OpenRouter (API compatible con OpenAI). */
export function crearProveedorCompatible(op: OpcionesCompatible): ProveedorAmpliado & { id: OpcionesCompatible["id"]; modelo: string } {
  const guardia = op.cupoDia === true ? crearGuardiaCupoDia() : op.cupoDia || null;
  return {
    id: op.id,
    modelo: op.modelo,
    limiteTokensMinuto: op.limiteTokensMinuto,
    ...(op.soportaImagen && { soportaImagen: true }),
    ...(op.soportaVariasImagenes && { soportaVariasImagenes: true }),
    disponible: () => Boolean(op.clave),
    async generarJSON<T>(p: {
      sistema: string;
      usuario: string;
      esquema: ZodType<T>;
      maxTokens?: number;
      temperatura?: number;
    } & OpcionesLlamada): Promise<ResultadoIA<T>> {
      const inicio = performance.now();
      const fetchFn = op.fetchFn ?? globalThis.fetch;
      // Con cupo por minuto pequeño el esquema va sin patrones ni límites (Zod los valida igual del lado nuestro).
      const esquemaTexto = op.limiteTokensMinuto ? instruccionEsquemaCompacta(p.esquema) : instruccionEsquema(p.esquema);
      const sistema = `${p.sistema}\n\n${esquemaTexto}`;
      // Con cupo por minuto: la salida se recorta para que entrada + salida quepan; si no queda margen útil, no se llama.
      let maxTokens = p.maxTokens;
      if (op.limiteTokensMinuto) {
        const entrada = Math.ceil((sistema.length + p.usuario.length) / CARACTERES_POR_TOKEN);
        const pedidos = p.maxTokens ?? SALIDA_ESPERADA_TOKENS;
        const cabe = op.limiteTokensMinuto - entrada - MARGEN_TOKENS;
        if (cabe < Math.min(pedidos, SALIDA_MINIMA_TOKENS))
          throw new ErrorNoCabe(
            `${op.id}: la petición (~${entrada + pedidos} tokens con la respuesta) supera el límite de ${op.limiteTokensMinuto} por minuto del plan gratuito.`,
          );
        maxTokens = Math.min(pedidos, cabe);
      }
      if (op.gasto) {
        const motivo = await op.gasto.bloqueo();
        if (motivo) throw new ErrorNoCabe(`${op.id}: presupuesto diario agotado (${motivo}); se pasa a otro proveedor.`);
      }
      const todasLasImagenes = [...(p.imagen ? [p.imagen] : []), ...(p.imagenes ?? [])];
      // Varias imágenes (miniaturas de candidatas) van con detalle bajo: cuestan una fracción de los tokens.
      const usuarioMensaje = todasLasImagenes.length
        ? [
            { type: "text", text: p.usuario },
            ...todasLasImagenes.map((im) => ({ type: "image_url", image_url: { url: `data:${im.mimeType};base64,${im.base64}`, ...(p.imagenes?.length ? { detail: "low" } : {}) } })),
          ]
        : p.usuario;
      const cuerpoPara = (modelo: string) => {
        const esOpenai = op.id === "openai";
        const razona = esOpenai && esModeloConRazonamiento(modelo);
        // Medido contra la API: gpt-5.4-mini rechaza `temperature` 0.9 con razonamiento «low» y la acepta con «none».
        // La redacción creativa (temperatura ≥ 0,6) usa «none» + temperatura para que dos landings del mismo encargo salgan distintas.
        const creativa = razona && admiteSinRazonamiento(modelo) && (p.temperatura ?? 0) >= TEMPERATURA_CREATIVA_MIN;
        // gpt-5 y serie o: `max_completion_tokens`, sin `temperature` distinta de 1 y con razonamiento bajo para ahorrar.
        const { reasoning_effort: esfuerzo, ...extra } = (op.cuerpoExtra ?? {}) as Record<string, unknown>;
        return {
          model: modelo,
          messages: [
            { role: "system", content: sistema },
            { role: "user", content: usuarioMensaje },
          ],
          response_format: { type: "json_object" },
          ...extra,
          ...(razona ? { reasoning_effort: creativa ? "none" : (esfuerzo ?? "low") } : esfuerzo !== undefined && !esOpenai ? { reasoning_effort: esfuerzo } : {}),
          ...(maxTokens !== undefined && (esOpenai ? { max_completion_tokens: maxTokens } : { max_tokens: maxTokens })),
          ...(p.temperatura !== undefined && (!razona || creativa) && { temperature: p.temperatura }),
        };
      };

      if (guardia) {
        const motivo = guardia.bloqueo(Math.ceil((sistema.length + p.usuario.length) / CARACTERES_POR_TOKEN) + (p.maxTokens ?? SALIDA_ESPERADA_TOKENS));
        if (motivo) throw new ErrorNoCabe(`${op.id}: cupo del día casi agotado (${motivo}); se pasa a otro proveedor.`);
      }

      const pedir = async (modelo: string): Promise<RespuestaChat> => {
        let datosRespuesta: RespuestaChat;
        try {
          await op.cola?.esperar();
          const res = await fetchFn(`${op.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${op.clave ?? ""}` },
            body: JSON.stringify(cuerpoPara(modelo)),
            signal: AbortSignal.timeout(Math.min(p.timeoutMs ?? Infinity, op.timeoutMs ?? leerTimeoutMs())),
          });
          guardia?.registrar(leerCupoDia(res.headers));
          if (!res.ok) {
            const motivo = motivoLegible(await res.text().catch(() => ""), [op.clave]);
            // Groq responde 400 cuando el modelo no llegó a cerrar un JSON válido (p. ej. se quedó sin tokens): se corrige como un `json`.
            const tipo = res.status === 400 && /failed to generate json|json_validate_failed/i.test(motivo) ? "json" : tipoPorEstado(res.status);
            const que = tipo === "auth" ? "clave rechazada" : tipo === "limite" ? "límite o saturación" : tipo === "json" ? "JSON incompleto" : "error del servicio";
            throw new ErrorIA(tipo, `${op.id}: ${que} (${res.status})${motivo ? `: ${motivo}` : ""}`);
          }
          try {
            datosRespuesta = (await res.json()) as RespuestaChat;
          } catch (e) {
            if (esAbort(e)) throw e;
            throw new ErrorIA("json", `${op.id}: la respuesta no es JSON.`);
          }
        } catch (e) {
          if (e instanceof ErrorIA) throw e;
          if (esAbort(e)) throw new ErrorIA("timeout", `${op.id}: se agotó el tiempo de espera.`);
          throw new ErrorIA("red", `${op.id}: fallo de red (${e instanceof Error ? e.message : String(e)}).`);
        }
        return datosRespuesta;
      };

      const modelos = [op.modelo, ...(op.modelosRespaldo ?? []).filter((m) => m && m !== op.modelo)];
      let datosRespuesta: RespuestaChat | undefined;
      let modeloUsado = op.modelo;
      for (const [i, m] of modelos.entries()) {
        try {
          datosRespuesta = await pedir(m);
          modeloUsado = m;
          break;
        } catch (e) {
          if (e instanceof ErrorIA && e.tipo === "limite" && !(e instanceof ErrorNoCabe) && i < modelos.length - 1) {
            // Backoff antes de probar el respaldo: el 429 de un modelo gratuito suele ser un pico de segundos.
            await new Promise((r) => setTimeout(r, op.esperaEntreModelosMs ?? ESPERA_ENTRE_MODELOS_MS));
            continue;
          }
          throw e;
        }
      }
      if (!datosRespuesta) throw new ErrorIA("json", `${op.id}: la respuesta llegó sin contenido.`);

      const mensaje = datosRespuesta.choices?.[0]?.message;
      const contenido = mensaje?.content?.trim();
      // Los modelos con razonamiento a veces dejan `content` vacío y ponen la respuesta en `reasoning`.
      const razonamiento = (mensaje?.reasoning ?? mensaje?.reasoning_content)?.trim();
      if (!contenido && !razonamiento) throw new ErrorIA("json", `${op.id}: la respuesta llegó sin contenido.`);
      const datos = validar(p.esquema, extraerJSON(contenido || razonamiento || ""));
      const uso = datosRespuesta.usage;
      if (op.gasto && uso?.prompt_tokens !== undefined && uso.completion_tokens !== undefined)
        await op.gasto.registrar(modeloUsado, { entrada: uso.prompt_tokens, salida: uso.completion_tokens });
      return {
        datos,
        proveedor: op.id,
        modelo: modeloUsado,
        ms: Math.round(performance.now() - inicio),
        ...(uso?.prompt_tokens !== undefined &&
          uso.completion_tokens !== undefined && {
            tokens: { entrada: uso.prompt_tokens, salida: uso.completion_tokens },
          }),
      };
    },
  };
}
