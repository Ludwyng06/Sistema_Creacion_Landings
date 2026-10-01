// npm run fotogramas -- <mp4> [--n 120] [--ancho 1600] [--movil]
// Extrae N fotogramas WebP (calidad 72) repartidos de forma uniforme a `<slot>-frames/0001.webp…`
// y escribe `manifest.json` { n, ancho, alto, fps } para <VideoScroll>. Con --movil crea además `<slot>-frames-movil/`.
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import { ffmpeg, infoVideo } from "./ffmpeg";

// En Windows la caché de archivos de sharp los deja bloqueados y no se pueden borrar ni reemplazar.
sharp.cache(false);

export interface OpcionesFotogramas {
  mp4: string;
  n?: number;
  ancho?: number;
  movil?: boolean;
}

export interface ManifestFotogramas {
  n: number;
  ancho: number;
  alto: number;
  /** Fotogramas por segundo del video de origen. */
  fps: number;
}

const pad = (i: number) => String(i).padStart(4, "0");

async function extraer(mp4: string, salida: string, n: number, ancho: number): Promise<ManifestFotogramas> {
  const info = await infoVideo(mp4);
  const temp = await mkdtemp(join(tmpdir(), "fotogramas-"));
  try {
    const anchoFinal = Math.min(ancho, info.ancho);
    // fps = n / duración reparte los fotogramas de forma uniforme; el 1 % extra evita quedarse en n-1 por redondeo.
    const paso = (n / Math.max(info.duracion, 0.001)) * 1.01;
    await ffmpeg(["-i", mp4, "-vf", `fps=${paso},scale=${anchoFinal}:-2`, "-frames:v", String(n), join(temp, "f%04d.png")]);
    const png = (await readdir(temp)).filter((f) => f.endsWith(".png")).sort();
    if (png.length === 0) throw new Error(`ffmpeg no produjo fotogramas de «${mp4}».`);
    await rm(salida, { recursive: true, force: true });
    await mkdir(salida, { recursive: true });
    let alto = 0;
    for (let i = 0; i < n; i++) {
      const origen = join(temp, png[Math.min(i, png.length - 1)]); // si faltara alguno, repite el último
      const i2 = await sharp(origen).webp({ quality: 72 }).toFile(join(salida, `${pad(i + 1)}.webp`));
      alto = i2.height;
    }
    const manifest: ManifestFotogramas = { n, ancho: anchoFinal, alto, fps: info.fps };
    await writeFile(join(salida, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    return manifest;
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}

export async function fotogramas(o: OpcionesFotogramas): Promise<{ escritorio: ManifestFotogramas; movil?: ManifestFotogramas; carpeta: string }> {
  const mp4 = resolve(o.mp4);
  const slot = basename(mp4, extname(mp4));
  const carpeta = join(dirname(mp4), `${slot}-frames`);
  const escritorio = await extraer(mp4, carpeta, o.n ?? 120, o.ancho ?? 1600);
  const movil = o.movil ? await extraer(mp4, join(dirname(mp4), `${slot}-frames-movil`), 72, 900) : undefined;
  return { escritorio, movil, carpeta };
}

function leerArgumentos(argv: string[]): OpcionesFotogramas {
  const o: OpcionesFotogramas = { mp4: "" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--movil") o.movil = true;
    else if (a === "--n" || a === "--ancho") {
      const v = Number(argv[++i]);
      if (!Number.isInteger(v) || v <= 0) throw new Error(`${a} necesita un número entero positivo.`);
      o[a === "--n" ? "n" : "ancho"] = v;
    } else if (a.startsWith("--")) throw new Error(`Opción desconocida: ${a}`);
    else o.mp4 = a;
  }
  if (!o.mp4) throw new Error("Uso: npm run fotogramas -- <mp4> [--n 120] [--ancho 1600] [--movil]");
  return o;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  fotogramas(leerArgumentos(process.argv.slice(2)))
    .then((r) => {
      console.log(`Fotogramas en ${r.carpeta}: ${r.escritorio.n} de ${r.escritorio.ancho}×${r.escritorio.alto} px (${r.escritorio.fps} fps de origen).`);
      if (r.movil) console.log(`Versión móvil: ${r.movil.n} de ${r.movil.ancho}×${r.movil.alto} px.`);
    })
    .catch((e) => {
      console.error(e instanceof Error ? e.message : e);
      process.exit(1);
    });
}
