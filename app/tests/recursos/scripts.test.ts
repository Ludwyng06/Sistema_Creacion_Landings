import { existsSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";

sharp.cache(false); // evita que Windows deje bloqueados los archivos de prueba
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { argsCompresion, comprimirVideo, presupuestoDe } from "../../scripts/comprimir";
import { ffmpeg, infoVideo } from "../../scripts/ffmpeg";
import { fotogramas } from "../../scripts/fotogramas";
import { procesarMedia, type AssetRegistro } from "../../scripts/media";

let dir: string;
let mp4: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "recursos-"));
  await mkdir(join(dir, "clips"), { recursive: true });
  mp4 = join(dir, "clips", "demo.mp4");
  // MP4 sintético de 2 s generado con ffmpeg-static
  await ffmpeg(["-f", "lavfi", "-i", "testsrc=duration=2:size=320x180:rate=10", "-pix_fmt", "yuv420p", mp4]);
}, 60_000);

afterAll(async () => {
  await rm(dir, { recursive: true, force: true, maxRetries: 3 }).catch(() => {});
}, 60_000);

describe("npm run fotogramas", () => {
  it("--n 10 produce 10 WebP numerados y un manifest correcto", async () => {
    const r = await fotogramas({ mp4, n: 10, ancho: 160 });
    const carpeta = join(dir, "clips", "demo-frames");
    expect(r.carpeta).toBe(carpeta);
    const archivos = (await readdir(carpeta)).sort();
    expect(archivos.filter((f) => f.endsWith(".webp"))).toEqual(Array.from({ length: 10 }, (_, i) => `${String(i + 1).padStart(4, "0")}.webp`));
    const manifest = JSON.parse(await readFile(join(carpeta, "manifest.json"), "utf8"));
    expect(manifest).toEqual({ n: 10, ancho: 160, alto: 90, fps: 10 });
    const meta = await sharp(join(carpeta, "0001.webp")).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["webp", 160, 90]);
    // repartidos de forma uniforme: el primero y el último fotograma no son iguales
    expect((await readFile(join(carpeta, "0001.webp"))).equals(await readFile(join(carpeta, "0010.webp")))).toBe(false);
    expect(r.movil).toBeUndefined();
  }, 60_000);

  it("no amplía el ancho del video y con --movil crea también -frames-movil", async () => {
    const r = await fotogramas({ mp4, n: 6, ancho: 1600, movil: true });
    expect(r.escritorio.ancho).toBe(320); // el video mide 320 px
    expect(r.movil).toMatchObject({ n: 72, ancho: 320 }); // 900 px pedidos, limitado al ancho real
    const movil = join(dir, "clips", "demo-frames-movil");
    expect((await readdir(movil)).filter((f) => f.endsWith(".webp"))).toHaveLength(72);
    expect(JSON.parse(await readFile(join(movil, "manifest.json"), "utf8")).n).toBe(72);
  }, 120_000);

  it("falla con un mensaje claro si el video no existe", async () => {
    await expect(fotogramas({ mp4: join(dir, "no-existe.mp4"), n: 2 })).rejects.toThrow();
  });
});

describe("npm run media", () => {
  it("sin archivos termina sin error y sin registrar nada", async () => {
    const vacio = await mkdtemp(join(tmpdir(), "media-vacia-"));
    const registrados: AssetRegistro[] = [];
    const r = await procesarMedia({ raiz: vacio, registrar: async (a) => void registrados.push(a) });
    expect(r).toEqual({ convertidas: [], posters: [], registrados: 0, omitidas: 0, comprimidos: [] });
    expect(await procesarMedia({ raiz: join(vacio, "no-existe") })).toMatchObject({ registrados: 0 });
    await rm(vacio, { recursive: true, force: true });
  });

  it("convierte imágenes a WebP sin borrar el original, crea el póster y registra los assets; es idempotente", async () => {
    const raiz = await mkdtemp(join(tmpdir(), "media-"));
    await mkdir(join(raiz, "abc123"), { recursive: true });
    await mkdir(join(raiz, "ejemplos", "x"), { recursive: true });
    await sharp({ create: { width: 200, height: 100, channels: 3, background: "#336699" } }).png().toFile(join(raiz, "abc123", "hero.png"));
    await copyFile(mp4, join(raiz, "ejemplos", "x", "clip.mp4"));
    await mkdir(join(raiz, "ejemplos", "x", "clip-frames"), { recursive: true });
    await sharp({ create: { width: 10, height: 10, channels: 3, background: "#fff" } }).png().toFile(join(raiz, "ejemplos", "x", "clip-frames", "0001.png"));

    const registrados: AssetRegistro[] = [];
    const opciones = { raiz, registrar: async (a: AssetRegistro) => void registrados.push(a) };
    const r1 = await procesarMedia(opciones);
    expect(r1.convertidas).toEqual(["/media/abc123/hero.webp"]);
    expect(r1.posters).toEqual(["/media/ejemplos/x/clip-poster.webp"]);
    expect(existsSync(join(raiz, "abc123", "hero.png"))).toBe(true); // el original se conserva
    expect((await sharp(join(raiz, "abc123", "hero.webp")).metadata()).format).toBe("webp");
    const poster = await sharp(join(raiz, "ejemplos", "x", "clip-poster.webp")).metadata();
    expect([poster.format, poster.width, poster.height]).toEqual(["webp", 320, 180]);
    expect(registrados).toEqual([
      { landingId: "abc123", slot: "hero", tipo: "imagen", ruta: "/media/abc123/hero.webp" },
      { landingId: null, slot: "clip", tipo: "video", ruta: "/media/ejemplos/x/clip.mp4" },
    ]); // no se registran los fotogramas de -frames

    registrados.length = 0;
    const r2 = await procesarMedia(opciones);
    expect(r2.convertidas).toEqual([]);
    expect(r2.posters).toEqual([]);
    expect(r2.omitidas).toBe(2);
    expect(registrados).toHaveLength(2); // el registro se actualiza, sin duplicar trabajo de archivos

    const r3 = await procesarMedia({ ...opciones, forzar: true });
    expect(r3.convertidas).toHaveLength(1);
    expect(r3.posters).toHaveLength(1);
    await rm(raiz, { recursive: true, force: true, maxRetries: 3 }).catch(() => {});
  }, 60_000);
});

describe("npm run media -- --comprimir", () => {
  it("presupuestos de docs/06: 16:9 hasta 4 MB, 9:16 hasta 3 MB y alternativas de 1,5 MB", () => {
    const MB = 1024 * 1024;
    expect(presupuestoDe("home/home-loop.mp4", 1920, 1080)).toBe(4 * MB);
    expect(presupuestoDe("home/home-loop-9x16.mp4", 1080, 1920)).toBe(3 * MB);
    expect(presupuestoDe("home/home-loop-alt-liquido.mp4", 944, 944)).toBe(1.5 * MB);
  });

  it("los argumentos piden H.264 sin audio, faststart y un fotograma clave cada 5", () => {
    const a = argsCompresion("in.mp4", "out.mp4", { crf: 30, escala: 0.7 });
    expect(a).toEqual(expect.arrayContaining(["-an", "libx264", "+faststart"]));
    expect(a[a.indexOf("-g") + 1]).toBe("5");
    expect(a[a.indexOf("-crf") + 1]).toBe("30");
    expect(a[a.indexOf("-vf") + 1]).toContain("0.7");
    expect(argsCompresion("in.mp4", "out.mp4", { crf: 30, escala: 1 })).not.toContain("-vf");
  });

  it("baja la calidad hasta cumplir el presupuesto, conserva la duración y quita el audio", async () => {
    const pesado = join(dir, "clips", "pesado.mp4");
    await ffmpeg(["-f", "lavfi", "-i", "testsrc2=duration=3:size=640x360:rate=24", "-f", "lavfi", "-i", "sine=duration=3", "-vf", "noise=alls=30:allf=t", "-c:v", "libx264", "-crf", "12", "-c:a", "aac", "-shortest", pesado]);
    const antes = await infoVideo(pesado);
    const presupuesto = 300 * 1024;
    const r = await comprimirVideo(pesado, { presupuesto });
    expect(r.omitido).toBe(false);
    expect(r.cabe).toBe(true);
    expect(r.despues).toBeLessThanOrEqual(presupuesto);
    expect(r.despues).toBeLessThan(r.antes);
    const despues = await infoVideo(pesado);
    expect(Math.abs(despues.duracion - antes.duracion)).toBeLessThan(0.3);
    expect((await ffmpeg(["-i", pesado], true)).stderr).not.toMatch(/Audio:/);
    // ya cabe: la segunda vez no lo toca
    expect((await comprimirVideo(pesado, { presupuesto })).omitido).toBe(true);
  }, 120_000);

  it("procesarMedia con comprimir recodifica los .mp4 y crea home-poster.webp desde home-loop.mp4", async () => {
    const raiz = await mkdtemp(join(tmpdir(), "media-comprimir-"));
    await mkdir(join(raiz, "home"), { recursive: true });
    await copyFile(mp4, join(raiz, "home", "home-loop.mp4"));
    const r = await procesarMedia({ raiz, comprimir: true, registrar: async () => {} });
    expect(r.comprimidos).toHaveLength(1);
    expect(existsSync(join(raiz, "home", "home-poster.webp"))).toBe(true);
    expect(existsSync(join(raiz, "home", "home-loop-poster.webp"))).toBe(true);
    await rm(raiz, { recursive: true, force: true });
  }, 120_000);
});
