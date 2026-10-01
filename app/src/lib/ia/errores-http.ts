import { ErrorIA, type TipoErrorIA } from "./tipos";

/** La petición no cabe ni sola en el cupo del proveedor: reintentar no sirve, hay que pasar al siguiente. */
export class ErrorNoCabe extends ErrorIA {
  constructor(mensaje: string) {
    super("limite", mensaje);
    this.name = "ErrorNoCabe";
  }
}

const ESPERA_POR_DEFECTO_MS = 2_000;
export const ESPERA_MAXIMA_MS = 8_000;
/** Cuando el límite es el cupo por minuto (Groq), esperar a que se libere cabe en los 90 s de una construcción. */
export const ESPERA_MAXIMA_CUPO_MS = 60_000;

/** Espera sugerida por el proveedor («try again in 19.1s», «retry in 500ms», «try again in 1m5.2s») o la de por defecto. */
export function esperaSugeridaMs(mensaje: string): number {
  const m = /(?:try again|retry)[^0-9]{0,12}(?:(\d+)m)?(\d+(?:\.\d+)?)\s*(ms|s)\b/i.exec(mensaje);
  if (!m) return ESPERA_POR_DEFECTO_MS;
  const n = Number(m[2]);
  const minutos = m[1] ? Number(m[1]) * 60_000 : 0;
  return Math.ceil(minutos + (m[3].toLowerCase() === "ms" ? n : n * 1000));
}

/** 429, 503 y 529 (saturación) se tratan como `limite` (transitorios): se reintentan y pasan al siguiente proveedor. */
export function tipoPorEstado(estado: number): TipoErrorIA {
  if (estado === 429 || estado === 503 || estado === 529) return "limite";
  if (estado === 401 || estado === 403) return "auth";
  if (estado === 408) return "timeout";
  return "red";
}

/** Una línea legible con el motivo que dio el proveedor: saca `error.message` del JSON y quita cualquier clave. */
export function motivoLegible(cuerpo: string, claves: (string | undefined)[] = []): string {
  let texto = cuerpo.trim();
  try {
    const j = JSON.parse(texto) as { error?: { message?: unknown } | string; message?: unknown };
    const e = j.error;
    const m = typeof e === "string" ? e : e && typeof e === "object" ? e.message : j.message;
    if (typeof m === "string" && m.trim()) texto = m.trim();
  } catch {
    // no era JSON: se usa el texto tal cual
  }
  for (const c of claves) if (c && c.length > 8) texto = texto.split(c).join("***");
  texto = texto.replace(/(key|token|bearer)[=:\s]+[A-Za-z0-9_\-.]{12,}/gi, "$1 ***").replace(/\s+/g, " ");
  if (texto.length <= 220) return texto;
  // Al acortar se conserva la espera sugerida («Please try again in 32.4s»): el enrutador la lee para reintentar.
  const pista = /(?:try again|retry)[^0-9]{0,12}(?:\d+m)?\d+(?:\.\d+)?\s*(?:ms|s)/i.exec(texto)?.[0];
  return pista ? `${texto.slice(0, 217 - pista.length - 5)}... ${pista}` : `${texto.slice(0, 217)}...`;
}
