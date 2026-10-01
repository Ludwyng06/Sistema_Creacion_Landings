// npm run capturas [-- --url http://localhost:3000] [-- --vitrina]
// Miniaturas de las landings en `en-banco` (640 px de ancho, WebP) en public/media/<id>/miniatura.webp.
// Con --vitrina guarda además capturas de página completa a 390 y 1280 px en public/media/vitrina/.
// Sin --url levanta `next dev` en un puerto libre. Si /l/<slug> responde 404 lo dice y termina con código 0.
import { explicarError } from "./_env";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import { actualizarMiniatura, listarLandings } from "../src/lib/landings";

sharp.cache(false); // en Windows deja los archivos bloqueados

export interface OpcionesCapturas {
  url: string;
  vitrina?: boolean;
  mediaRaiz?: string;
  log?: (linea: string) => void;
}

export interface ResultadoCapturas {
  miniaturas: string[];
  vitrina: string[];
  /** Slug cuya ruta respondió 404 (la captura se detiene ahí). */
  noEncontrada?: string;
}

/** Navegador de Playwright, con un mensaje claro si falta descargar Chromium. `E2E_CANAL=msedge` (o chrome) usa el ya instalado. */
export async function abrirNavegador() {
  const { chromium } = await import("playwright");
  const canal = process.env.E2E_CANAL;
  if (canal) return chromium.launch({ channel: canal });
  if (!existsSync(chromium.executablePath())) {
    throw new Error("Falta el navegador de Playwright. Ejecuta una vez:  npx playwright install chromium");
  }
  return chromium.launch();
}

export async function capturar(o: OpcionesCapturas): Promise<ResultadoCapturas> {
  const log = o.log ?? console.log;
  const media = resolve(o.mediaRaiz ?? join(process.cwd(), "public", "media"));
  const base = o.url.replace(/\/+$/, "");
  const resultado: ResultadoCapturas = { miniaturas: [], vitrina: [] };
  const landings = await listarLandings({ estado: "en-banco" });
  if (landings.length === 0) {
    log("No hay landings en el banco todavía.");
    return resultado;
  }

  const navegador = await abrirNavegador();
  try {
    for (const l of landings) {
      const destino = `${base}/l/${l.slug}`;
      const pagina = await navegador.newPage({ viewport: { width: 1280, height: 800 } });
      const respuesta = await pagina.goto(destino, { waitUntil: "networkidle", timeout: 60_000 });
      if (!respuesta || respuesta.status() === 404) {
        log(`La ruta ${destino} responde 404: la página /l/[slug] aún no existe. No se capturó nada más.`);
        resultado.noEncontrada = l.slug;
        await pagina.close();
        break;
      }
      await pagina.waitForTimeout(800); // deja terminar las animaciones de entrada
      const carpeta = join(media, l.id);
      await mkdir(carpeta, { recursive: true });
      await sharp(await pagina.screenshot()).resize({ width: 640 }).webp({ quality: 82 }).toFile(join(carpeta, "miniatura.webp"));
      await actualizarMiniatura(l.id, `/media/${l.id}/miniatura.webp`);
      resultado.miniaturas.push(l.slug);
      log(`Miniatura: ${l.slug}`);

      if (o.vitrina) {
        const vitrina = join(media, "vitrina");
        await mkdir(vitrina, { recursive: true });
        for (const ancho of [390, 1280]) {
          await pagina.setViewportSize({ width: ancho, height: 800 });
          await pagina.waitForTimeout(400);
          const archivo = join(vitrina, `${l.slug}-${ancho}.webp`);
          await sharp(await pagina.screenshot({ fullPage: true })).webp({ quality: 82 }).toFile(archivo);
          resultado.vitrina.push(`/media/vitrina/${l.slug}-${ancho}.webp`);
        }
        log(`Vitrina: ${l.slug} (390 y 1280)`);
      }
      await pagina.close();
    }
  } finally {
    await navegador.close();
  }
  return resultado;
}

// ---------- Servidor ----------

function puertoLibre(): Promise<number> {
  return new Promise((resolver, rechazar) => {
    const s = createServer();
    s.once("error", rechazar);
    s.listen(0, () => {
      const { port } = s.address() as { port: number };
      s.close(() => resolver(port));
    });
  });
}

async function esperar(url: string, ms: number): Promise<void> {
  const limite = Date.now() + ms;
  while (Date.now() < limite) {
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error(`El servidor no respondió en ${Math.round(ms / 1000)} s (${url}).`);
}

export async function levantarServidor(): Promise<{ url: string; proceso: ChildProcess }> {
  const puerto = await puertoLibre();
  const next = join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
  const proceso = spawn(process.execPath, [next, "dev", "-p", String(puerto)], { stdio: "ignore" });
  const url = `http://localhost:${puerto}`;
  await esperar(url, 90_000);
  return { url, proceso };
}

async function principal(argv: string[]): Promise<void> {
  const iUrl = argv.indexOf("--url");
  const vitrina = argv.includes("--vitrina");
  let servidor: { url: string; proceso: ChildProcess } | undefined;
  try {
    const url = iUrl !== -1 && argv[iUrl + 1] ? argv[iUrl + 1] : (servidor = await levantarServidor()).url;
    const r = await capturar({ url, vitrina });
    console.log(`Miniaturas: ${r.miniaturas.length} · Vitrina: ${r.vitrina.length}`);
  } finally {
    servidor?.proceso.kill();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal(process.argv.slice(2))
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(explicarError(e));
      process.exit(1);
    });
}
