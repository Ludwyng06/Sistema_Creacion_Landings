import { execFile } from "node:child_process";
import ffmpegPath from "ffmpeg-static";

// Ayudas comunes de `media` y `fotogramas`: usan el ffmpeg empaquetado (`ffmpeg-static`), no el del sistema.

export function rutaFfmpeg(): string {
  if (!ffmpegPath) throw new Error("ffmpeg-static no tiene binario para esta plataforma.");
  return ffmpegPath;
}

export interface SalidaFfmpeg {
  stdout: Buffer;
  stderr: string;
}

/** Ejecuta ffmpeg; `ffmpeg -i` sin salida termina con error pero su stderr trae los metadatos, por eso `tolerar`. */
export function ffmpeg(args: string[], tolerar = false): Promise<SalidaFfmpeg> {
  return new Promise((resolver, rechazar) => {
    execFile(rutaFfmpeg(), ["-hide_banner", "-loglevel", tolerar ? "info" : "error", ...args], { encoding: "buffer", maxBuffer: 256 * 1024 * 1024 }, (error, stdout, stderr) => {
      const salida = { stdout, stderr: stderr.toString("utf8") };
      if (error && !tolerar) rechazar(new Error(`ffmpeg falló: ${salida.stderr.trim() || error.message}`));
      else resolver(salida);
    });
  });
}

export interface InfoVideo {
  duracion: number;
  fps: number;
  ancho: number;
  alto: number;
}

export async function infoVideo(mp4: string): Promise<InfoVideo> {
  const { stderr } = await ffmpeg(["-i", mp4], true);
  const d = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(stderr);
  const v = /Video:.*?,\s*(\d{2,5})x(\d{2,5})/.exec(stderr);
  const f = /([\d.]+)\s*fps/.exec(stderr);
  if (!d || !v) throw new Error(`No se pudo leer el video «${mp4}»: ${stderr.trim().split("\n").at(-1) ?? ""}`);
  return {
    duracion: Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3]),
    fps: f ? Number(f[1]) : 0,
    ancho: Number(v[1]),
    alto: Number(v[2]),
  };
}

/** Primer fotograma del video como PNG. */
export async function primerFotograma(mp4: string): Promise<Buffer> {
  const { stdout } = await ffmpeg(["-i", mp4, "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-"]);
  if (stdout.length === 0) throw new Error(`No se pudo extraer el primer fotograma de «${mp4}».`);
  return stdout;
}
