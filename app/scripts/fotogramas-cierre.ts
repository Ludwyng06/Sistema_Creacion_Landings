// npm run fotogramas:cierre [-- --calidad 85] [-- --n 120]
// Genera el cierre del home desde el ORIGINAL vertical (public/media/home/home-cierre-9x16.mp4, 720×1280, 24 fps, 10 s):
//   · home-cierre-frames/   WebP de calidad 82 a 85 a su resolución nativa (720×1280, sin reescalar), hasta 120 cuadros
//   · home-cierre-poster.webp  desde home-cierre-9x16.jpg (1008×1792)
//   · home-cierre.mp4       respaldo: CRF 21, preset slow, sin reescalar, GOP corto
// Presupuesto: 10 MB de fotogramas; si no caben, baja la calidad (mínimo 82) y luego los cuadros. Los originales no se suben a git.
import "./_env";
import { mkdir, mkdtemp, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import sharp from "sharp";
import { ffmpeg, infoVideo } from "./ffmpeg";

sharp.cache(false);

const args = process.argv.slice(2);
const valor = (f: string) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};

const CARPETA = resolve(process.cwd(), "public", "media", "home");
const ORIGEN = join(CARPETA, "home-cierre-9x16.mp4");
const POSTER_ORIGEN = join(CARPETA, "home-cierre-9x16.jpg");
const MB = 1024 * 1024;
const PRESUPUESTO = 10 * MB;
const MIN_CALIDAD = 82;
const TOPE_CALIDAD = Number(valor("--calidad") ?? 85);
const pad = (i: number) => String(i).padStart(4, "0");

const codificar = (origen: string, calidad: number) => sharp(origen).webp({ quality: calidad, effort: 5 }).toBuffer();

async function tamanoMedio(png: string[], calidad: number): Promise<number> {
  let total = 0;
  const muestra = [0.1, 0.4, 0.7, 0.95].map((p) => png[Math.floor(p * (png.length - 1))]);
  for (const f of muestra) total += (await codificar(f, calidad)).length;
  return total / muestra.length;
}

async function main() {
  const info = await infoVideo(ORIGEN);
  console.log(`Original: ${info.ancho}×${info.alto}, ${info.fps} fps, ${info.duracion.toFixed(1)} s`);
  const temp = await mkdtemp(join(tmpdir(), "cierre-"));
  try {
    await ffmpeg(["-i", ORIGEN, "-vsync", "0", join(temp, "f%04d.png")]);
    const png = (await readdir(temp)).filter((f) => f.endsWith(".png")).sort().map((f) => join(temp, f));
    console.log(`Cuadros extraídos: ${png.length} (resolución nativa)`);

    const deseado = Number(valor("--n") ?? 120);
    let calidad = TOPE_CALIDAD;
    let n = deseado;
    for (let q = TOPE_CALIDAD; q >= MIN_CALIDAD; q -= 1) {
      const medio = await tamanoMedio(png, q);
      calidad = q;
      n = Math.min(deseado, Math.floor(PRESUPUESTO / (medio * 1.06)));
      console.log(`  q${q}: ${(medio / 1024).toFixed(0)} KB/cuadro → caben ${n}`);
      if (n >= deseado) break;
    }
    n = Math.max(60, n);

    const salida = join(CARPETA, "home-cierre-frames");
    await rm(salida, { recursive: true, force: true });
    await mkdir(salida, { recursive: true });
    let bytes = 0;
    for (let i = 0; i < n; i++) {
      const origen = png[Math.min(png.length - 1, Math.round((i * (png.length - 1)) / Math.max(1, n - 1)))];
      const datos = await codificar(origen, calidad);
      bytes += datos.length;
      await writeFile(join(salida, `${pad(i + 1)}.webp`), datos);
    }
    await writeFile(join(salida, "manifest.json"), `${JSON.stringify({ n, ancho: info.ancho, alto: info.alto, fps: info.fps, formato: "webp", calidad }, null, 2)}\n`);
    console.log(`Fotogramas: ${n} cuadros, WebP q${calidad}, ${(bytes / MB).toFixed(1)} MB`);

    const meta = await sharp(POSTER_ORIGEN).metadata();
    await sharp(POSTER_ORIGEN).sharpen({ sigma: 0.4 }).webp({ quality: 88, effort: 5 }).toFile(join(CARPETA, "home-cierre-poster.webp"));
    console.log(`Póster: ${meta.width}×${meta.height} → home-cierre-poster.webp`);

    await ffmpeg(["-y", "-i", ORIGEN, "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "21", "-g", "12", "-pix_fmt", "yuv420p", "-movflags", "+faststart", join(CARPETA, "home-cierre.mp4")]);
    console.log(`Respaldo home-cierre.mp4: ${((await stat(join(CARPETA, "home-cierre.mp4"))).size / MB).toFixed(1)} MB`);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
