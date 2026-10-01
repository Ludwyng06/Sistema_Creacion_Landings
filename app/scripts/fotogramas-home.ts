// npm run fotogramas:home [-- --medir] [-- --calidad 90] [-- --formato avif|webp (por defecto webp)] [-- --n 120] [-- --n-movil 96] [-- --enfoque-x 0.28]
// Regenera la portada desde el ORIGINAL (public/media/home/home-16-9.mp4, 1280×720, 24 fps, 10 s) a su resolución nativa:
//   · home-loop-frames/       escritorio, 1280 de ancho, 1 de cada 2 cuadros (≥ 120), con realce suave
//   · home-loop-frames-movil/ móvil, recorte cuadrado de 720 centrado en los teléfonos de la banda (sin reescalar)
//   · home-poster.webp y home-poster-movil.webp desde home-16-9.jpg (1792×1008, la imagen más nítida que existe)
//   · home-loop.mp4           respaldo: CRF 19, preset slow, sin reescalar, GOP corto
// Presupuesto: 25 MB el juego de escritorio y 10 MB el móvil; si no caben, baja la calidad (mínimo 88) y luego los cuadros.
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
const tiene = (f: string) => args.includes(f);

const CARPETA = resolve(process.cwd(), "public", "media", "home");
const ORIGEN = join(CARPETA, "home-16-9.mp4");
const POSTER_ORIGEN = join(CARPETA, "home-16-9.jpg");
const MB = 1024 * 1024;
const PRESUPUESTO = { escritorio: 25 * MB, movil: 10 * MB };
const formato = (valor("--formato") ?? "webp") as "webp" | "avif";
const EXT = formato;
const pad = (i: number) => String(i).padStart(4, "0");

type Codificar = (origen: string, calidad: number) => Promise<Buffer>;

const codificador = (recorte?: { left: number; top: number; width: number; height: number }): Codificar => async (origen, calidad) => {
  let tuberia = sharp(origen);
  if (recorte) tuberia = tuberia.extract(recorte);
  tuberia = tuberia.sharpen({ sigma: Number(valor("--sigma") ?? 0.6) });
  return formato === "avif" ? tuberia.avif({ quality: calidad, effort: 4 }).toBuffer() : tuberia.webp({ quality: calidad, effort: 5 }).toBuffer();
};

async function tamanoMedio(png: string[], codificar: Codificar, calidad: number): Promise<number> {
  const muestra = [0.1, 0.4, 0.7].map((p) => png[Math.floor(p * (png.length - 1))]);
  let total = 0;
  for (const f of muestra) total += (await codificar(f, calidad)).length;
  return total / muestra.length;
}

// WebP de 82 a 85 (decodifica varias veces más rápido que AVIF); AVIF de 60 a 70 (en AVIF esa franja equivale visualmente: ver capturas/dia17B/comparacion-formatos.png).
const MIN_CALIDAD = formato === "avif" ? 60 : 82;
const TOPE_CALIDAD = formato === "avif" ? 70 : 85;

/** La mayor calidad (entre `tope` y el mínimo) con la que caben `nDeseado` cuadros en el presupuesto; si ni con el mínimo, menos cuadros. */
async function elegir(png: string[], codificar: Codificar, presupuesto: number, nDeseado: number, tope: number) {
  let medio = 0;
  for (let q = tope; q >= MIN_CALIDAD; q -= 2) {
    medio = await tamanoMedio(png, codificar, q);
    const n = Math.min(nDeseado, Math.floor(presupuesto / (medio * 1.06)));
    if (n >= nDeseado) return { calidad: q, n: nDeseado, medio };
    if (q - 2 < MIN_CALIDAD) return { calidad: MIN_CALIDAD, n: Math.max(60, n), medio };
  }
  return { calidad: MIN_CALIDAD, n: 60, medio };
}

async function escribirJuego(png: string[], salida: string, n: number, calidad: number, codificar: Codificar, ancho: number, alto: number, fps: number) {
  await rm(salida, { recursive: true, force: true });
  await mkdir(salida, { recursive: true });
  let bytes = 0;
  for (let i = 0; i < n; i++) {
    // Cuadros repartidos de forma pareja a lo largo de los 240 del original (1 de cada 2 con n = 120).
    const origen = png[Math.min(png.length - 1, Math.round((i * (png.length - 1)) / Math.max(1, n - 1)))];
    const datos = await codificar(origen, calidad);
    bytes += datos.length;
    await writeFile(join(salida, `${pad(i + 1)}.${EXT}`), datos);
  }
  await writeFile(join(salida, "manifest.json"), `${JSON.stringify({ n, ancho, alto, fps, formato: EXT, calidad }, null, 2)}\n`);
  return bytes;
}

async function main() {
  const info = await infoVideo(ORIGEN);
  console.log(`Original: ${info.ancho}×${info.alto}, ${info.fps} fps, ${info.duracion.toFixed(1)} s`);
  const temp = await mkdtemp(join(tmpdir(), "home-"));
  try {
    await ffmpeg(["-i", ORIGEN, "-vsync", "0", join(temp, "f%04d.png")]);
    const png = (await readdir(temp)).filter((f) => f.endsWith(".png")).sort().map((f) => join(temp, f));
    console.log(`Cuadros extraídos: ${png.length} (resolución nativa)`);

    const anchoMovil = Math.min(720, info.alto);
    const x0 = Math.round((info.ancho - anchoMovil) * Number(valor("--enfoque-x") ?? 0.28));
    const recorteMovil = { left: x0, top: 0, width: anchoMovil, height: info.alto };
    const esc = codificador();
    const mov = codificador(recorteMovil);
    const tope = Number(valor("--calidad") ?? TOPE_CALIDAD);

    if (tiene("--medir")) {
      for (const q of (valor("--q") ?? "88,90,92").split(",").map(Number)) console.log(`${EXT} q${q}: escritorio ${((await tamanoMedio(png, esc, q)) / 1024).toFixed(0)} KB/cuadro · móvil ${((await tamanoMedio(png, mov, q)) / 1024).toFixed(0)} KB/cuadro`);
      return;
    }

    const e = await elegir(png, esc, PRESUPUESTO.escritorio, Number(valor("--n") ?? 120), tope);
    const m = await elegir(png, mov, PRESUPUESTO.movil, Number(valor("--n-movil") ?? 120), tope);
    console.log(`Escritorio: ${e.n} cuadros, calidad ${e.calidad}; móvil: ${m.n} cuadros, calidad ${m.calidad}`);
    const bE = await escribirJuego(png, join(CARPETA, "home-loop-frames"), e.n, e.calidad, esc, info.ancho, info.alto, info.fps);
    const bM = await escribirJuego(png, join(CARPETA, "home-loop-frames-movil"), m.n, m.calidad, mov, anchoMovil, info.alto, info.fps);
    console.log(`Escritorio: ${(bE / MB).toFixed(1)} MB · móvil: ${(bM / MB).toFixed(1)} MB`);

    // Póster y primer cuadro: salen de la imagen más nítida (1792×1008), sin reducirla.
    const meta = await sharp(POSTER_ORIGEN).metadata();
    await sharp(POSTER_ORIGEN).sharpen({ sigma: 0.6 }).webp({ quality: 90, effort: 5 }).toFile(join(CARPETA, "home-poster.webp"));
    const escala = (meta.width ?? info.ancho) / info.ancho;
    await sharp(POSTER_ORIGEN)
      .extract({ left: Math.round(x0 * escala), top: 0, width: Math.round(anchoMovil * escala), height: meta.height ?? info.alto })
      .sharpen({ sigma: 0.6 })
      .webp({ quality: 90, effort: 5 })
      .toFile(join(CARPETA, "home-poster-movil.webp"));
    console.log(`Póster: ${meta.width}×${meta.height} → home-poster.webp y home-poster-movil.webp`);

    // Respaldo mp4: sin reescalar, CRF 19, preset slow y GOP corto para que el seek sea rápido.
    await ffmpeg(["-y", "-i", ORIGEN, "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "19", "-g", "12", "-pix_fmt", "yuv420p", "-movflags", "+faststart", join(CARPETA, "home-loop.mp4")]);
    console.log(`Respaldo home-loop.mp4: ${((await stat(join(CARPETA, "home-loop.mp4"))).size / MB).toFixed(1)} MB`);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
