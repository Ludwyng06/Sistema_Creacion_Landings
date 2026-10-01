import { ErrorFuente, type OpcionesFuente } from "./tipos";

export const TIMEOUT_FUENTE_MS = 8_000;
const ESPERA_REINTENTO_MS = 1_200;
const USER_AGENT = "SistemaCreadorLandings/1.0 (proyecto academico; uso local)";

export interface PeticionHttp {
  fuente: string;
  url: string;
  headers?: Record<string, string>;
  señal?: AbortSignal;
  /** Palabras que no deben aparecer en los mensajes de error (las claves que viajan en la URL). */
  secretos?: string[];
}

const dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function limpiar(texto: string, secretos: string[] = []): string {
  let salida = texto;
  for (const s of secretos) if (s) salida = salida.split(s).join("***");
  return salida.slice(0, 200);
}

async function intento(p: PeticionHttp, fetchFn: typeof fetch): Promise<Response> {
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(new DOMException("tiempo agotado", "TimeoutError")), TIMEOUT_FUENTE_MS);
  const cancelar = () => control.abort(p.señal?.reason);
  p.señal?.addEventListener("abort", cancelar, { once: true });
  try {
    return await fetchFn(p.url, { signal: control.signal, headers: { "User-Agent": USER_AGENT, Accept: "application/json", ...p.headers } });
  } catch (e) {
    const nombre = e instanceof Error ? e.name : "";
    if (p.señal?.aborted) throw new ErrorFuente(p.fuente, "red", "La consulta se canceló.");
    if (nombre === "AbortError" || nombre === "TimeoutError" || control.signal.aborted) {
      throw new ErrorFuente(p.fuente, "timeout", `${p.fuente} no respondió en ${TIMEOUT_FUENTE_MS / 1000} s.`);
    }
    throw new ErrorFuente(p.fuente, "red", `No se pudo conectar con ${p.fuente} (${limpiar(e instanceof Error ? e.message : String(e), p.secretos)}).`);
  } finally {
    clearTimeout(reloj);
    p.señal?.removeEventListener("abort", cancelar);
  }
}

/** GET que devuelve JSON: 8 s de tope por intento y un reintento con espera si responde 429 o 5xx. */
export async function pedirJson(p: PeticionHttp, op: OpcionesFuente = {}): Promise<unknown> {
  const fetchFn = op.fetchFn ?? globalThis.fetch;
  let res = await intento(p, fetchFn);
  if (res.status === 429 || res.status >= 500) {
    await dormir(op.esperaReintentoMs ?? ESPERA_REINTENTO_MS);
    res = await intento(p, fetchFn);
  }
  const texto = await res.text();
  if (!res.ok) {
    const detalle = limpiar(texto, p.secretos);
    if (res.status === 401 || res.status === 403) throw new ErrorFuente(p.fuente, "auth", `${p.fuente} rechazó la clave o el acceso (${res.status}).`);
    if (res.status === 429) throw new ErrorFuente(p.fuente, "cupo", `${p.fuente} agotó su cupo (429).`);
    throw new ErrorFuente(p.fuente, "respuesta", `${p.fuente} respondió ${res.status}${detalle ? `: ${detalle}` : ""}`);
  }
  try {
    return JSON.parse(texto);
  } catch {
    throw new ErrorFuente(p.fuente, "respuesta", `${p.fuente} devolvió algo que no es JSON.`);
  }
}

/** Descarga un archivo binario (imagen) con el mismo tope de 8 s. */
export async function descargar(fuente: string, url: string, op: OpcionesFuente = {}, señal?: AbortSignal): Promise<Buffer> {
  const fetchFn = op.fetchFn ?? globalThis.fetch;
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), 60_000);
  señal?.addEventListener("abort", () => control.abort(), { once: true });
  try {
    const res = await fetchFn(url, { signal: control.signal, headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) throw new ErrorFuente(fuente, "respuesta", `${fuente}: la descarga respondió ${res.status}.`);
    return Buffer.from(await res.arrayBuffer());
  } catch (e) {
    if (e instanceof ErrorFuente) throw e;
    throw new ErrorFuente(fuente, control.signal.aborted ? "timeout" : "red", `${fuente}: no se pudo descargar la imagen.`);
  } finally {
    clearTimeout(reloj);
  }
}
