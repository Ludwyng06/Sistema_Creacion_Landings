import { buscar, buscarShopping, claveSerpApi, ErrorSerpApi, TIMEOUT_SERPAPI_MS, type ResultadoShopping } from "@/lib/investigacion/serpapi";
import { ErrorFuente, type Fuente, type OpcionesFuente } from "./tipos";

// SerpAPI, Google Shopping: precios de REFERENCIA del mercado. El precio de la landing lo fija el vendedor en el brief;
// estos valores nunca se copian a la oferta. Plan gratuito: ~250 búsquedas al mes (al 90 % se desactiva).

export const LIMITE_MENSUAL_SERPAPI = 250;

export interface ConsultaShopping {
  q: string;
  max?: number;
}

export interface PrecioReferencia {
  titulo: string;
  /** En pesos colombianos, sin decimales. */
  precio: number;
  precioTexto: string;
  tienda: string | null;
  enlace: string | null;
  miniatura: string | null;
}

export function normalizarShopping(filas: ResultadoShopping[]): PrecioReferencia[] {
  const salida: PrecioReferencia[] = [];
  for (const f of filas) {
    if (!f.title || typeof f.extracted_price !== "number" || !Number.isFinite(f.extracted_price) || f.extracted_price <= 0) continue;
    salida.push({
      titulo: f.title,
      precio: Math.round(f.extracted_price),
      precioTexto: f.price ?? `$${Math.round(f.extracted_price)}`,
      tienda: f.source ?? null,
      enlace: f.product_link ?? f.link ?? null,
      miniatura: f.thumbnail ?? null,
    });
  }
  return salida;
}

export function crearSerpApiShopping(op: OpcionesFuente = {}): Fuente<ConsultaShopping, PrecioReferencia[]> {
  const env = () => op.env ?? process.env;
  return {
    id: "serpapi-shopping",
    ttl: 24 * 3600,
    limiteMensual: LIMITE_MENSUAL_SERPAPI,
    grupoUso: "serpapi",
    habilitada: () => claveSerpApi(env()) !== undefined,
    async consultar(q, señal) {
      if (señal?.aborted) throw new ErrorFuente("serpapi-shopping", "red", "La consulta se canceló.");
      try {
        const filas = await buscarShopping(q.q, { env: env(), fetchFn: op.fetchFn, timeoutMs: Math.min(TIMEOUT_SERPAPI_MS, 8_000) });
        return normalizarShopping(filas).slice(0, q.max ?? 10);
      } catch (e) {
        if (e instanceof ErrorSerpApi) throw new ErrorFuente("serpapi-shopping", e.tipo === "cupo" ? "cupo" : e.tipo === "auth" ? "auth" : e.tipo === "timeout" ? "timeout" : e.tipo === "red" ? "red" : "respuesta", e.message);
        throw e;
      }
    },
    credito: () => "Google Shopping vía SerpAPI (solo referencia)",
  };
}

export interface ConsultaPreguntas {
  q: string;
  max?: number;
}

/** «La gente también pregunta» de Google (SerpAPI), para el FAQ. Comparte el plan mensual con Shopping. */
export function crearSerpApiPreguntas(op: OpcionesFuente = {}): Fuente<ConsultaPreguntas, string[]> {
  const env = () => op.env ?? process.env;
  return {
    id: "serpapi-preguntas",
    ttl: 7 * 24 * 3600,
    limiteMensual: LIMITE_MENSUAL_SERPAPI,
    grupoUso: "serpapi",
    habilitada: () => claveSerpApi(env()) !== undefined,
    async consultar(q, señal) {
      if (señal?.aborted) throw new ErrorFuente("serpapi-preguntas", "red", "La consulta se canceló.");
      try {
        const r = await buscar(q.q, { env: env(), fetchFn: op.fetchFn, timeoutMs: Math.min(TIMEOUT_SERPAPI_MS, 8_000) });
        return (r.related_questions ?? [])
          .map((p) => (p.question ?? "").trim())
          .filter((p) => p.length > 8 && p.length <= 100 && p.endsWith("?"))
          .slice(0, q.max ?? 5);
      } catch (e) {
        if (e instanceof ErrorSerpApi) throw new ErrorFuente("serpapi-preguntas", e.tipo === "cupo" ? "cupo" : e.tipo === "auth" ? "auth" : e.tipo === "timeout" ? "timeout" : e.tipo === "red" ? "red" : "respuesta", e.message);
        throw e;
      }
    },
    credito: () => "Google vía SerpAPI (solo referencia)",
  };
}
