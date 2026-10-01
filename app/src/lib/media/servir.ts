import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { Readable } from "node:stream";

// Sirve /media/** desde el disco en tiempo de ejecución. Con `next start`, Next solo sirve lo que existía en public/ al compilar:
// miniaturas, fotos subidas, imágenes generadas y medios de la vitrina se crean después y darían 404 hasta recompilar.

/** Carpeta de medios: `MEDIA_DIR` o `public/media`. */
export const carpetaMedia = () => process.env.MEDIA_DIR ?? join(process.cwd(), "public", "media");

const TIPOS: Record<string, string> = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

/** Ruta absoluta dentro de `raiz`, o `null` si intenta salir de ella (`..`, `\`, bytes nulos, rutas vacías). */
export function resolverSegura(raiz: string, segmentos: string[]): string | null {
  if (segmentos.length === 0) return null;
  const limpios: string[] = [];
  for (const s of segmentos) {
    let d: string;
    try {
      d = decodeURIComponent(s);
    } catch {
      return null;
    }
    if (d === "" || d === "." || d === ".." || d.includes("/") || d.includes("\\") || d.includes("\0") || d.startsWith(".")) return null;
    limpios.push(d);
  }
  const base = resolve(raiz);
  const destino = resolve(base, ...limpios);
  return destino.startsWith(base + sep) ? destino : null;
}

const noEncontrado = () => new Response("No encontrado", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

/** Rango `bytes=a-b` de una petición (un solo rango); `null` si no hay, `"invalido"` si no se puede cumplir. */
export function leerRango(cabecera: string | null, tamano: number): { inicio: number; fin: number } | null | "invalido" {
  if (!cabecera) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(cabecera.trim());
  if (!m || (m[1] === "" && m[2] === "")) return "invalido";
  let inicio: number;
  let fin: number;
  if (m[1] === "") {
    const n = Number(m[2]);
    inicio = Math.max(0, tamano - n);
    fin = tamano - 1;
  } else {
    inicio = Number(m[1]);
    fin = m[2] === "" ? tamano - 1 : Math.min(Number(m[2]), tamano - 1);
  }
  if (!Number.isFinite(inicio) || inicio >= tamano || fin < inicio) return "invalido";
  return { inicio, fin };
}

export async function servirMedia(request: Request, segmentos: string[], raiz: string = carpetaMedia()): Promise<Response> {
  const ruta = resolverSegura(raiz, segmentos);
  if (!ruta) return noEncontrado();
  let info;
  try {
    info = await stat(ruta);
  } catch {
    return noEncontrado();
  }
  if (!info.isFile()) return noEncontrado();

  const etag = `W/"${info.size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}"`;
  const cabeceras: Record<string, string> = {
    "Content-Type": TIPOS[extname(ruta).toLowerCase()] ?? "application/octet-stream",
    "Cache-Control": "public, max-age=300, must-revalidate",
    ETag: etag,
    "Last-Modified": info.mtime.toUTCString(),
    "Accept-Ranges": "bytes",
    "X-Content-Type-Options": "nosniff",
  };

  const coincide = request.headers.get("if-none-match");
  if (coincide && coincide.split(",").some((t) => t.trim() === etag)) return new Response(null, { status: 304, headers: cabeceras });

  const rango = leerRango(request.headers.get("range"), info.size);
  if (rango === "invalido") return new Response(null, { status: 416, headers: { ...cabeceras, "Content-Range": `bytes */${info.size}` } });
  const esHead = request.method === "HEAD";
  if (rango) {
    const largo = rango.fin - rango.inicio + 1;
    const cuerpo = esHead ? null : (Readable.toWeb(createReadStream(ruta, { start: rango.inicio, end: rango.fin })) as unknown as ReadableStream);
    return new Response(cuerpo, { status: 206, headers: { ...cabeceras, "Content-Length": String(largo), "Content-Range": `bytes ${rango.inicio}-${rango.fin}/${info.size}` } });
  }
  const cuerpo = esHead ? null : (Readable.toWeb(createReadStream(ruta)) as unknown as ReadableStream);
  return new Response(cuerpo, { status: 200, headers: { ...cabeceras, "Content-Length": String(info.size) } });
}
