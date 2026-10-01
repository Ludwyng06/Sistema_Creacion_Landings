// Fluidez del video del capítulo 0 (tarea 07-B, prioridad): tiempo de cuadro al recorrer el capítulo hacia delante y
// hacia atrás con la CPU al cuarto de velocidad. Uso: PUERTO=3107 ETIQUETA=despues npx tsx tests/e2e/dia8-video.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const BASE = `http://localhost:${process.env.PUERTO ?? "3000"}`;
const ETIQUETA = process.env.ETIQUETA ?? "medicion";
const SALIDA = join(process.cwd(), "..", "docs", "bitacora", "capturas", "dia8B");
mkdirSync(SALIDA, { recursive: true });

async function main() {
  const navegador = await chromium.launch({ channel: "msedge" });
  const informe: Record<string, unknown> = {};
  try {
    for (const [ancho, alto] of [[1280, 800], [390, 844]] as const) {
      const contexto = await navegador.newContext({ viewport: { width: ancho, height: alto } });
      await contexto.addInitScript("window.__name = (f) => f;");
      const pagina = await contexto.newPage();
      const cdp = await contexto.newCDPSession(pagina);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      await pagina.goto(BASE, { waitUntil: "load" });
      await pagina.waitForSelector("[data-video-scroll]:not([data-fuente='cargando'])", { timeout: 30_000 });
      await pagina.waitForTimeout(8000); // deja terminar la precarga
      const fuente = await pagina.locator("[data-video-scroll]").first().getAttribute("data-fuente");
      for (const sentido of ["adelante", "atras"] as const) {
        const r = await pagina.evaluate(async (s) => {
          const el = document.querySelector<HTMLElement>('[data-capitulo="0"]')!;
          const inicio = el.getBoundingClientRect().top + window.scrollY;
          const recorrido = el.offsetHeight - window.innerHeight;
          window.scrollTo(0, s === "adelante" ? inicio : inicio + recorrido);
          await new Promise((res) => setTimeout(res, 600));
          const deltas: number[] = [];
          const errores: number[] = [];
          const lienzo = document.querySelector<HTMLCanvasElement>("[data-lienzo-fotogramas]");
          const clip = document.querySelector<HTMLVideoElement>("[data-video-tiempo]");
          let anterior = performance.now();
          const t0 = anterior;
          const dur = 5000;
          await new Promise<void>((res) => {
            const paso = (t: number) => {
              deltas.push(t - anterior);
              anterior = t;
              const f = Math.min(1, (t - t0) / dur);
              const objetivo = s === "adelante" ? f : 1 - f;
              // Qué tan lejos está lo que se ve de lo que pide el scroll (0–1 del recorrido).
              const visto = lienzo ? Number(lienzo.dataset.fotograma ?? 1) / 120 : clip && clip.duration ? clip.currentTime / clip.duration : 0;
              if (t - t0 > 600) errores.push(Math.abs(visto - objetivo));
              window.scrollTo(0, inicio + recorrido * objetivo);
              if (t - t0 < dur) requestAnimationFrame(paso);
              else res();
            };
            requestAnimationFrame(paso);
          });
          const o = [...deltas].sort((a, b) => a - b);
          const e = [...errores].sort((a, b) => a - b);
          return {
            errorP95: Number(e[Math.floor(e.length * 0.95)].toFixed(3)),
            cuadros: deltas.length,
            p50Ms: Number(o[Math.floor(o.length * 0.5)].toFixed(1)),
            p95Ms: Number(o[Math.floor(o.length * 0.95)].toFixed(1)),
            peorMs: Number(o[o.length - 1].toFixed(1)),
            cuadrosLentos: deltas.filter((d) => d > 20).length,
          };
        }, sentido);
        informe[`${ancho}-${sentido}`] = { fuente, ...r };
        console.log(ETIQUETA, ancho, sentido, fuente, JSON.stringify(r));
      }
      await contexto.close();
    }
  } finally {
    writeFileSync(join(SALIDA, `video-${ETIQUETA}.json`), JSON.stringify(informe, null, 2));
    await navegador.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
