import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { optimizarImagen } from "@/lib/bancos/procesar";
import { ErrorFuente } from "@/lib/fuentes/tipos";
import { contadorCompartido, precioImagen, type ContadorGasto } from "@/lib/ia/gasto";
import type { ImagenGenerada } from "./flux";
import type { Relacion } from "./flux";

// Imágenes generadas con OpenAI (tarea 24-A): gpt-image-2 en calidad baja (~11 s, foto de catálogo), gpt-image-1-mini de respaldo y,
// si también falla, quien llama cae a FLUX. `b64_json` → webp con sharp, guardado por hash del prompt (el mismo prompt no se paga dos veces)
// y sumado al control de gasto diario. Sin dependencias nuevas.

export const URL_IMAGENES_OPENAI = "https://api.openai.com/v1/images/generations";
const TIMEOUT_MS = 90_000;

const TAMANOS: Record<Relacion, string> = { "1:1": "1024x1024", "16:9": "1536x1024", "4:5": "1024x1536", "9:16": "1024x1536" };

type Env = Record<string, string | undefined>;

export interface OpcionesImagenOpenAI {
  env?: Env;
  fetchFn?: typeof fetch;
  /** Carpeta `public/media`. */
  dirMedia: string;
  gasto?: ContadorGasto;
}

export const claveOpenAI = (env: Env = process.env) => env.OPENAI_API_KEY?.trim() || undefined;
export const imagenOpenAIHabilitada = (env?: Env) => claveOpenAI(env) !== undefined;

export function modelosDeImagen(env: Env = process.env): { principal: string; respaldo: string; calidad: string } {
  return {
    principal: env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-2",
    respaldo: env.OPENAI_IMAGE_RESPALDO?.trim() || "gpt-image-1-mini",
    calidad: env.OPENAI_IMAGE_QUALITY?.trim() || "low",
  };
}

export function hashImagenOpenAI(prompt: string, relacion: Relacion, modelo: string, calidad: string): string {
  return createHash("sha256").update(`${modelo}|${calidad}|${relacion}|${prompt.trim()}`).digest("hex").slice(0, 20);
}

async function pedir(modelo: string, calidad: string, prompt: string, relacion: Relacion, clave: string, fetchFn: typeof fetch): Promise<Response> {
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), TIMEOUT_MS);
  try {
    return await fetchFn(URL_IMAGENES_OPENAI, {
      method: "POST",
      signal: control.signal,
      headers: { Authorization: `Bearer ${clave}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: modelo, prompt, size: TAMANOS[relacion], quality: calidad, output_format: "webp", output_compression: 85, n: 1 }),
    });
  } catch (e) {
    throw new ErrorFuente("ia-openai", control.signal.aborted ? "timeout" : "red", `OpenAI imágenes no respondió (${e instanceof Error ? e.name : "error"}).`);
  } finally {
    clearTimeout(reloj);
  }
}

/** Genera (o reutiliza de disco) la imagen de un prompt. Lanza `ErrorFuente` si no hay clave, no hay presupuesto o los dos modelos fallan. */
export async function generarImagenOpenAI(prompt: string, relacion: Relacion, op: OpcionesImagenOpenAI): Promise<ImagenGenerada> {
  const env = op.env ?? process.env;
  const clave = claveOpenAI(env);
  const { principal, respaldo, calidad } = modelosDeImagen(env);
  const carpeta = join(op.dirMedia, "bancos", "generadas");
  // La caché mira los dos modelos: un prompt ya generado con cualquiera no se vuelve a pagar.
  for (const m of [principal, respaldo]) {
    const h = hashImagenOpenAI(prompt, relacion, m, calidad);
    const archivo = join(carpeta, `oa-${h}.webp`);
    if (existsSync(archivo)) {
      const { default: sharp } = await import("sharp");
      const meta = await sharp(archivo).metadata();
      return { ruta: `/media/bancos/generadas/oa-${h}.webp`, hash: h, ancho: meta.width ?? 0, alto: meta.height ?? 0, coloresDominantes: [], deCache: true, modelo: m };
    }
  }
  if (!clave) throw new ErrorFuente("ia-openai", "deshabilitada", "Falta OPENAI_API_KEY en app/.env.local.");
  const gasto = op.gasto ?? contadorCompartido("openai");
  const tope = await gasto.bloqueo();
  if (tope) throw new ErrorFuente("ia-openai", "cupo", `Presupuesto diario de OpenAI agotado (${tope}).`);
  const fetchFn = op.fetchFn ?? globalThis.fetch;

  let ultimo = 0;
  for (const modelo of [principal, respaldo].filter((m, i, t) => m && t.indexOf(m) === i)) {
    const r = await pedir(modelo, calidad, prompt, relacion, clave, fetchFn);
    ultimo = r.status;
    if (r.status === 401 || r.status === 403) throw new ErrorFuente("ia-openai", "auth", "OpenAI rechazó la clave de imágenes.");
    if (!r.ok) continue; // 429, 5xx, modelo sin acceso o prompt rechazado: se prueba el modelo de respaldo
    const j = (await r.json().catch(() => null)) as { data?: { b64_json?: string }[] } | null;
    const b64 = j?.data?.[0]?.b64_json;
    if (!b64) continue;
    const img = await optimizarImagen(Buffer.from(b64, "base64"), { lado: 1600, calidad: 82 });
    const h = hashImagenOpenAI(prompt, relacion, modelo, calidad);
    await mkdir(carpeta, { recursive: true });
    await writeFile(join(carpeta, `oa-${h}.webp`), img.webp);
    await gasto.registrarUsd(modelo, precioImagen(modelo, env)).catch(() => undefined);
    return { ruta: `/media/bancos/generadas/oa-${h}.webp`, hash: h, ancho: img.ancho, alto: img.alto, coloresDominantes: img.coloresDominantes, deCache: false, modelo };
  }
  throw new ErrorFuente("ia-openai", ultimo === 429 ? "cupo" : "respuesta", `OpenAI imágenes respondió ${ultimo || "sin imagen"} con los dos modelos.`);
}
