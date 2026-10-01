import type { Brief, PeticionConstruir, PromptEstructurado, TecnicaId } from "@/lib/contratos";
import { leerFlujoNdjson } from "./ndjson";
import type { EventoConstruccion, ResultadoValidador } from "@/lib/contratos";
import type { LandingDoc } from "@/lib/contratos";
import type { EventoDuelo } from "@/lib/ia/duelo";
import type { RespuestaPrompt } from "./estado";
import type { RespuestaInvestigar } from "./investigar";

/** Error de una llamada a la API con un mensaje que se puede mostrar tal cual. */
export class ErrorApi extends Error {
  constructor(
    mensaje: string,
    readonly estado?: number,
    /** Cuerpo JSON de la respuesta de error (por ejemplo `motivos` o `errores`). */
    readonly datos?: Record<string, unknown>,
  ) {
    super(mensaje);
    this.name = "ErrorApi";
  }
}

async function mensajeDe(respuesta: Response, ruta: string): Promise<string> {
  if (respuesta.status === 404) return "Esta función todavía no está disponible. Inténtalo más tarde.";
  try {
    const dato = (await respuesta.json()) as { error?: string };
    if (dato.error) return dato.error;
  } catch {
    // La respuesta no traía JSON.
  }
  return `No pudimos completar la acción (${ruta}, código ${respuesta.status}).`;
}

async function enviar<T>(ruta: string, cuerpo: unknown, senal?: AbortSignal): Promise<T> {
  let respuesta: Response;
  try {
    respuesta = await fetch(ruta, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
      signal: senal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ErrorApi("No hay conexión con el servidor. Revisa tu red e inténtalo de nuevo.");
  }
  if (!respuesta.ok) throw new ErrorApi(await mensajeDe(respuesta, ruta), respuesta.status);
  return (await respuesta.json()) as T;
}

export function pedirPrompt(
  cuerpo: { brief: Brief; tecnicas: TecnicaId[]; numeroSemilla?: number },
  senal?: AbortSignal,
): Promise<RespuestaPrompt> {
  return enviar<RespuestaPrompt>("/api/prompt", cuerpo, senal);
}

export async function pedirObjeciones(brief: Brief): Promise<string[]> {
  const r = await enviar<{ objeciones: string[] }>("/api/objeciones", { brief });
  return r.objeciones;
}

export function pedirMejora(prompt: PromptEstructurado): Promise<{ prompt: PromptEstructurado; cambios: string[] }> {
  return enviar("/api/mejorar-prompt", { prompt });
}

export function enviarManual(texto: string, brief: Brief): Promise<{ doc: LandingDoc; salud: ResultadoValidador[] }> {
  return enviar("/api/construir/manual", { texto, brief });
}

export interface GuardadoLanding {
  id: string;
  slug: string;
}

/** Cuerpo de `POST /api/landings`: `{ brief, tecnicas, prompt, doc, proveedor }` (proveedor es obligatorio). */
export interface CuerpoGuardar {
  brief: Brief;
  tecnicas: TecnicaId[];
  prompt: PromptEstructurado;
  doc: LandingDoc;
  numeroSemilla?: number;
  proveedor?: string;
}

export function guardarLanding(cuerpo: CuerpoGuardar): Promise<GuardadoLanding> {
  return enviar<GuardadoLanding>("/api/landings", cuerpo);
}

/** `POST /api/construir`: lee el NDJSON y entrega cada evento en cuanto llega. */
export async function construir(
  peticion: PeticionConstruir,
  alEvento: (evento: EventoConstruccion) => void,
  opciones: { senal?: AbortSignal; alAviso?: (aviso: string) => void } = {},
): Promise<void> {
  let respuesta: Response;
  try {
    respuesta = await fetch("/api/construir", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(peticion),
      signal: opciones.senal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ErrorApi("No hay conexión con el servidor. Revisa tu red e inténtalo de nuevo.");
  }
  if (!respuesta.ok || !respuesta.body) {
    throw new ErrorApi(await mensajeDe(respuesta, "/api/construir"), respuesta.status);
  }
  await leerFlujoNdjson(respuesta.body, alEvento, opciones.alAviso);
}

/** `POST /api/construir-duelo`: NDJSON con eventos de los dos lados (`lado`) y, al final, el evento `duelo`. */
export async function construirDuelo(
  peticion: PeticionConstruir,
  alEvento: (evento: EventoDuelo) => void,
  opciones: { senal?: AbortSignal; alAviso?: (aviso: string) => void } = {},
): Promise<void> {
  let respuesta: Response;
  try {
    respuesta = await fetch("/api/construir-duelo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(peticion),
      signal: opciones.senal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ErrorApi("No hay conexión con el servidor. Revisa tu red e inténtalo de nuevo.");
  }
  if (!respuesta.ok || !respuesta.body) {
    throw new ErrorApi(await mensajeDe(respuesta, "/api/construir-duelo"), respuesta.status);
  }
  await leerFlujoNdjson<EventoDuelo>(respuesta.body, alEvento, opciones.alAviso);
}

/**
 * `POST /api/investigar` (09-A): sugerencias con fuente para el paso 1. Responde 503 legible si no hay `SERPAPI_API_KEY`.
 * Con `imagen` viaja como `multipart` (nombre, categoría y foto); sin ella, como JSON.
 */
export async function investigarProducto(
  cuerpo: { nombre: string; categoria?: string; imagen?: File },
  senal?: AbortSignal,
): Promise<RespuestaInvestigar> {
  const { imagen, ...datos } = cuerpo;
  if (!imagen) return enviar<RespuestaInvestigar>("/api/investigar", datos, senal);
  const formulario = new FormData();
  formulario.set("nombre", datos.nombre);
  if (datos.categoria) formulario.set("categoria", datos.categoria);
  formulario.set("imagen", imagen);
  let respuesta: Response;
  try {
    respuesta = await fetch("/api/investigar", { method: "POST", body: formulario, signal: senal });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ErrorApi("No hay conexión con el servidor. Revisa tu red e inténtalo de nuevo.");
  }
  if (!respuesta.ok) throw new ErrorApi(await mensajeDe(respuesta, "/api/investigar"), respuesta.status);
  return (await respuesta.json()) as RespuestaInvestigar;
}
