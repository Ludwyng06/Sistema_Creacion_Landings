import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { optimizarImagen } from "@/lib/bancos/procesar";
import { ErrorFuente } from "@/lib/fuentes/tipos";

// Generación de imágenes con FLUX por el router de Hugging Face (Grok sale del proyecto). Sin dependencias nuevas.
// Presupuesto: el plan gratuito tiene un crédito mensual pequeño, así que solo se genera lo que falta y cada prompt se guarda en disco
// por su hash: el mismo prompt nunca se genera dos veces.

export const MODELO_FLUX = "black-forest-labs/FLUX.1-schnell";
export const URL_FLUX = "https://router.huggingface.co/nscale/v1/images/generations";
export const URL_FLUX_RESPALDO = "https://router.huggingface.co/fal-ai/fal-ai/flux/schnell";
const TIMEOUT_MS = 60_000;

export type Relacion = "1:1" | "4:5" | "16:9" | "9:16";

const TAMANOS: Record<Relacion, { ancho: number; alto: number }> = {
  "1:1": { ancho: 1024, alto: 1024 },
  "4:5": { ancho: 896, alto: 1152 },
  "16:9": { ancho: 1344, alto: 768 },
  "9:16": { ancho: 768, alto: 1344 },
};

export interface OpcionesFlux {
  env?: Record<string, string | undefined>;
  fetchFn?: typeof fetch;
  /** Carpeta `public/media`. */
  dirMedia: string;
}

export interface ImagenGenerada {
  /** Ruta web, dentro de `/media/bancos/generadas/` (fuera de git; la vitrina la copia a su carpeta). */
  ruta: string;
  hash: string;
  ancho: number;
  alto: number;
  coloresDominantes: string[];
  deCache: boolean;
  modelo: string;
}

export const tokenHf = (env: Record<string, string | undefined> = process.env) => env.HF_TOKEN?.trim() || undefined;
export const fluxHabilitado = (env?: Record<string, string | undefined>) => tokenHf(env) !== undefined;

export function hashPrompt(prompt: string, relacion: Relacion): string {
  return createHash("sha256").update(`${MODELO_FLUX}|${relacion}|${prompt.trim()}`).digest("hex").slice(0, 20);
}

async function pedir(url: string, cuerpo: unknown, token: string, fetchFn: typeof fetch): Promise<Response> {
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), TIMEOUT_MS);
  try {
    return await fetchFn(url, { method: "POST", signal: control.signal, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
  } catch (e) {
    throw new ErrorFuente("ia-flux", control.signal.aborted ? "timeout" : "red", `FLUX no respondió (${e instanceof Error ? e.name : "error"}).`);
  } finally {
    clearTimeout(reloj);
  }
}

/** Genera con nscale; si responde 5xx o 429, prueba fal-ai por el mismo router. */
async function descargarGenerada(prompt: string, relacion: Relacion, token: string, fetchFn: typeof fetch): Promise<{ buffer: Buffer; modelo: string }> {
  const { ancho, alto } = TAMANOS[relacion];
  const principal = await pedir(URL_FLUX, { model: MODELO_FLUX, prompt, response_format: "b64_json", size: `${ancho}x${alto}` }, token, fetchFn);
  if (principal.ok) {
    const j = (await principal.json().catch(() => null)) as { data?: { b64_json?: string }[] } | null;
    const b64 = j?.data?.[0]?.b64_json;
    if (b64) return { buffer: Buffer.from(b64, "base64"), modelo: `${MODELO_FLUX} (nscale)` };
    throw new ErrorFuente("ia-flux", "respuesta", "FLUX respondió sin imagen.");
  }
  if (principal.status === 401 || principal.status === 403) throw new ErrorFuente("ia-flux", "auth", "Hugging Face rechazó HF_TOKEN.");
  if (principal.status === 402) throw new ErrorFuente("ia-flux", "cupo", "Se acabó el crédito mensual gratuito de Hugging Face.");
  // Respaldo: fal-ai.
  const respaldo = await pedir(URL_FLUX_RESPALDO, { prompt, image_size: { width: ancho, height: alto }, num_images: 1 }, token, fetchFn).catch(() => null);
  if (respaldo?.ok) {
    const j = (await respaldo.json().catch(() => null)) as { images?: { url?: string }[] } | null;
    const url = j?.images?.[0]?.url;
    if (url) {
      const img = await fetchFn(url);
      if (img.ok) return { buffer: Buffer.from(await img.arrayBuffer()), modelo: `${MODELO_FLUX} (fal-ai)` };
    }
  }
  throw new ErrorFuente("ia-flux", principal.status === 429 ? "cupo" : "respuesta", `FLUX respondió ${principal.status}.`);
}

/** Genera (o reutiliza de disco) la imagen de un prompt. Lanza `ErrorFuente` si no hay token o el servicio falla. */
export async function generarImagen(prompt: string, relacion: Relacion, op: OpcionesFlux): Promise<ImagenGenerada> {
  const token = tokenHf(op.env ?? process.env);
  const hash = hashPrompt(prompt, relacion);
  const carpeta = join(op.dirMedia, "bancos", "generadas");
  const archivo = join(carpeta, `${hash}.webp`);
  const ruta = `/media/bancos/generadas/${hash}.webp`;
  if (existsSync(archivo)) {
    const { default: sharp } = await import("sharp");
    const m = await sharp(archivo).metadata();
    return { ruta, hash, ancho: m.width ?? 0, alto: m.height ?? 0, coloresDominantes: [], deCache: true, modelo: MODELO_FLUX };
  }
  if (!token) throw new ErrorFuente("ia-flux", "deshabilitada", "Falta HF_TOKEN en app/.env.local.");
  const { buffer, modelo } = await descargarGenerada(prompt, relacion, token, op.fetchFn ?? globalThis.fetch);
  const img = await optimizarImagen(buffer, { lado: 1600, calidad: 80 });
  await mkdir(carpeta, { recursive: true });
  await writeFile(archivo, img.webp);
  return { ruta, hash, ancho: img.ancho, alto: img.alto, coloresDominantes: img.coloresDominantes, deCache: false, modelo };
}
