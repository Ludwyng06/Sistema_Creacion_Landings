import { colaCompartida } from "./cola-rpm";
import { crearGemini } from "./gemini";
import { crearProveedorCompatible } from "./openai-compat";
import type { ProveedorIA, ProveedorId } from "./tipos";

type Env = Record<string, string | undefined>;

const CASCADA_POR_DEFECTO = "cerebras,gemini,groq,openrouter";

const COMPATIBLES = {
  groq: { prefijo: "GROQ", baseUrl: "https://api.groq.com/openai/v1", modelo: "openai/gpt-oss-120b" },
  cerebras: { prefijo: "CEREBRAS", baseUrl: "https://api.cerebras.ai/v1", modelo: "gpt-oss-120b" },
  openrouter: { prefijo: "OPENROUTER", baseUrl: "https://openrouter.ai/api/v1", modelo: "poolside/laguna-xs-2.1:free" },
} as const;

export const CASCADA_ID_POR_DEFECTO: ProveedorId[] = ["cerebras", "gemini", "groq", "openrouter"];

const NOMBRES: Record<ProveedorId, string> = { gemini: "Google Gemini", groq: "Groq", cerebras: "Cerebras", openrouter: "OpenRouter", manual: "Manual" };

/** Nombre, modelo configurado y si hay clave, sin exponer nunca la clave. */
export function infoProveedor(id: ProveedorId, env: Env = process.env): { id: ProveedorId; nombre: string; modelo: string; tieneClave: boolean } {
  if (id === "gemini") return { id, nombre: NOMBRES[id], modelo: env.GEMINI_MODEL || "gemini-flash-latest", tieneClave: Boolean(env.GEMINI_API_KEY) };
  if (id === "manual") return { id, nombre: NOMBRES[id], modelo: "—", tieneClave: true };
  const c = COMPATIBLES[id];
  return { id, nombre: NOMBRES[id], modelo: env[`${c.prefijo}_MODEL`] || c.modelo, tieneClave: Boolean(env[`${c.prefijo}_API_KEY`]) };
}

function numeroPositivo(v?: string): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function construir(id: ProveedorId, env: Env): ProveedorIA | null {
  if (id === "gemini") return crearGemini(env);
  if (id === "groq" || id === "cerebras" || id === "openrouter") {
    const c = COMPATIBLES[id];
    return crearProveedorCompatible({
      id,
      baseUrl: env[`${c.prefijo}_BASE_URL`] || c.baseUrl,
      clave: env[`${c.prefijo}_API_KEY`],
      modelo: env[`${c.prefijo}_MODEL`] || c.modelo,
      // Cerebras gratuito: 5 peticiones por minuto. Una cola compartida las reparte en vez de dejar que fallen con 429.
      ...(id === "cerebras" && { cola: colaCompartida("cerebras", numeroPositivo(env.CEREBRAS_RPM) ?? 5), timeoutMs: numeroPositivo(env.CEREBRAS_TIMEOUT_MS) ?? 120_000 }),
      ...(id === "groq" && { limiteTokensMinuto: numeroPositivo(env.GROQ_TPM) ?? 8000 }),
      // Los modelos gratuitos de OpenRouter razonan y tardan: ~1 min para una landing completa.
      // Menos razonamiento = respuestas mucho más rápidas para un JSON que ya viene guiado por el esquema.
      // `reasoning_effort` solo lo entienden los modelos gpt-oss; otros (Llama, Qwen) responden 400 si se envía.
      cuerpoExtra: id === "openrouter" ? { reasoning: { effort: "low" } } : /gpt-oss/i.test(env[`${c.prefijo}_MODEL`] || c.modelo) ? { reasoning_effort: "low" } : {},
      ...(id === "openrouter" && { modelosRespaldo: (env.OPENROUTER_MODEL_RESPALDO ?? "google/gemma-4-26b-a4b-it:free").split(",").map((m) => m.trim()).filter(Boolean) }),
      ...(id === "openrouter" && { timeoutMs: numeroPositivo(env.OPENROUTER_TIMEOUT_MS) ?? 45_000 }),
    });
  }
  return null; // "manual" no forma parte de la cascada automática
}

/** Proveedores con clave, en el orden de IA_CASCADA. Los desconocidos y repetidos se ignoran. */
export function proveedoresDisponibles(env: Env = process.env): ProveedorIA[] {
  const orden = (env.IA_CASCADA?.trim() || CASCADA_POR_DEFECTO)
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s, i, todos) => s && todos.indexOf(s) === i);
  const lista: ProveedorIA[] = [];
  for (const id of orden) {
    const proveedor = construir(id as ProveedorId, env);
    if (proveedor?.disponible()) lista.push(proveedor);
  }
  return lista;
}
