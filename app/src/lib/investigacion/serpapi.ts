import { motivoLegible } from "@/lib/ia/errores-http";

// Cliente mínimo de SerpAPI (https://serpapi.com/search-api). La clave solo viaja en la URL de la petición:
// ningún error, aviso ni log la incluye.

type Env = Record<string, string | undefined>;

export const TIMEOUT_SERPAPI_MS = 10_000;
const BASE_POR_DEFECTO = "https://serpapi.com";

export type TipoErrorSerpApi = "sin-clave" | "auth" | "cupo" | "timeout" | "red" | "respuesta";

export class ErrorSerpApi extends Error {
  readonly tipo: TipoErrorSerpApi;

  constructor(tipo: TipoErrorSerpApi, mensaje: string) {
    super(mensaje);
    this.name = "ErrorSerpApi";
    this.tipo = tipo;
  }
}

export interface ResultadoOrganico {
  title?: string;
  snippet?: string;
  link?: string;
  displayed_link?: string;
  source?: string;
}

export interface PreguntaRelacionada {
  question?: string;
  snippet?: string;
  title?: string;
  link?: string;
  displayed_link?: string;
  source?: string;
}

export interface GrafoConocimiento {
  title?: string;
  description?: string;
  source?: { name?: string; link?: string };
}

/** Lo único que se conserva de una búsqueda (y lo que se guarda en la caché). */
export interface RespuestaBusqueda {
  /** La consulta que se buscó: sirve de enlace a «La gente también pregunta», que casi nunca trae uno propio. */
  consulta?: string;
  organic_results?: ResultadoOrganico[];
  related_questions?: PreguntaRelacionada[];
  knowledge_graph?: GrafoConocimiento;
}

export interface CuentaSerpApi {
  plan?: string;
  usadasMes: number;
  limiteMes: number;
  restantes: number;
}

export interface OpcionesSerpApi {
  env?: Env;
  /** Solo para tests; por defecto `globalThis.fetch`. */
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

export const claveSerpApi = (env: Env = process.env): string | undefined => env.SERPAPI_API_KEY?.trim() || undefined;

const base = (env: Env) => (env.SERPAPI_BASE_URL?.trim() || BASE_POR_DEFECTO).replace(/\/+$/, "");

/** País (`gl`) e idioma (`hl`) de las búsquedas: `SERPAPI_PAIS` y `SERPAPI_IDIOMA`, por defecto `co` y `es`. */
export const regionSerpApi = (env: Env = process.env) => ({ gl: env.SERPAPI_PAIS?.trim() || "co", hl: env.SERPAPI_IDIOMA?.trim() || "es" });

async function pedir(ruta: string, params: Record<string, string>, op: OpcionesSerpApi): Promise<unknown> {
  const env = op.env ?? process.env;
  const clave = claveSerpApi(env);
  if (!clave) throw new ErrorSerpApi("sin-clave", "Falta SERPAPI_API_KEY en app/.env.local.");
  const url = `${base(env)}${ruta}?${new URLSearchParams({ ...params, api_key: clave })}`;
  const fetchFn = op.fetchFn ?? globalThis.fetch;
  let res: Response;
  try {
    res = await fetchFn(url, { signal: AbortSignal.timeout(op.timeoutMs ?? TIMEOUT_SERPAPI_MS) });
  } catch (e) {
    const nombre = e instanceof Error ? e.name : "";
    if (nombre === "AbortError" || nombre === "TimeoutError") throw new ErrorSerpApi("timeout", "SerpAPI no respondió en 10 s.");
    throw new ErrorSerpApi("red", `No se pudo conectar con SerpAPI (${motivoLegible(e instanceof Error ? e.message : String(e), [clave]) || "sin detalle"}).`);
  }
  const texto = await res.text();
  let cuerpo: unknown;
  try {
    cuerpo = JSON.parse(texto);
  } catch {
    cuerpo = undefined;
  }
  const mensajeApi = cuerpo && typeof cuerpo === "object" && "error" in cuerpo ? String((cuerpo as { error: unknown }).error) : "";
  if (!res.ok || mensajeApi) {
    const motivo = motivoLegible(mensajeApi || texto, [clave]);
    if (res.status === 401 || res.status === 403 || /invalid api key|api key/i.test(mensajeApi)) throw new ErrorSerpApi("auth", "SerpAPI rechazó la clave.");
    if (res.status === 429 || /run out of searches|out of searches|limit/i.test(mensajeApi)) throw new ErrorSerpApi("cupo", `Se acabó el cupo de búsquedas de SerpAPI${motivo ? `: ${motivo}` : "."}`);
    // «Google hasn't returned any results for this query» no es un fallo: la búsqueda simplemente no encontró nada.
    if (/hasn't returned any results|no results/i.test(mensajeApi)) return {};
    throw new ErrorSerpApi("respuesta", `SerpAPI respondió con un error (${res.status})${motivo ? `: ${motivo}` : "."}`);
  }
  if (!cuerpo || typeof cuerpo !== "object") throw new ErrorSerpApi("respuesta", "SerpAPI devolvió algo que no es JSON.");
  return cuerpo;
}

/** Una búsqueda de Google (`engine=google`). Gasta 1 de la cuota mensual. */
export async function buscar(q: string, op: OpcionesSerpApi = {}): Promise<RespuestaBusqueda> {
  const { gl, hl } = regionSerpApi(op.env ?? process.env);
  const r = (await pedir("/search.json", { engine: "google", q, gl, hl, num: "10" }, op)) as RespuestaBusqueda;
  // Solo lo que se usa: la caché no guarda anuncios, imágenes ni el resto de la respuesta.
  return { consulta: q, organic_results: r.organic_results, related_questions: r.related_questions, knowledge_graph: r.knowledge_graph };
}

export interface ResultadoShopping {
  title?: string;
  price?: string;
  extracted_price?: number;
  source?: string;
  link?: string;
  product_link?: string;
  thumbnail?: string;
}

/** Google Shopping (`engine=google_shopping`): precios de referencia. Gasta 1 de la cuota mensual. */
export async function buscarShopping(q: string, op: OpcionesSerpApi = {}): Promise<ResultadoShopping[]> {
  const { gl, hl } = regionSerpApi(op.env ?? process.env);
  const r = (await pedir("/search.json", { engine: "google_shopping", q, gl, hl }, op)) as { shopping_results?: ResultadoShopping[] };
  return r.shopping_results ?? [];
}

/** Estado de la cuenta (`account.json`): no gasta búsquedas. */
export async function leerCuenta(op: OpcionesSerpApi = {}): Promise<CuentaSerpApi> {
  const r = (await pedir("/account.json", {}, op)) as Record<string, unknown>;
  const n = (k: string) => (typeof r[k] === "number" ? (r[k] as number) : undefined);
  const limiteMes = n("searches_per_month") ?? 0;
  const restantes = n("total_searches_left") ?? n("plan_searches_left") ?? 0;
  const usadasMes = n("this_month_usage") ?? Math.max(0, limiteMes - restantes);
  return { plan: typeof r.plan_name === "string" ? r.plan_name : undefined, usadasMes, limiteMes, restantes };
}
