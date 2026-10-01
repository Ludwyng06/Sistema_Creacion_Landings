// Medición del home liviano (17-B urgente): póster visible, primer cuadro, memoria de bitmaps, tareas largas durante la carga
// y p95 del cuadro adelante y atrás, en Edge con CPU x4. Imprime una tabla (para pegar antes y después).
// Uso: PUERTO=3115 ETIQUETA=antes npx tsx tests/e2e/home-liviano.ts   (con `next start`)
import { chromium } from "playwright";

const BASE = `http://localhost:${process.env.PUERTO ?? "3000"}`;
const ETIQUETA = process.env.ETIQUETA ?? "medicion";

interface Resultado {
  poster: number;
  primerCuadro: number;
  mbBitmaps: number;
  bitmaps: number;
  tareasLargasMs: number;
  tareasLargas: number;
  p95Carga: number;
  p95Adelante: number;
  p95Atras: number;
  cuadrosCargados: number;
}

async function medir(ancho: number, alto: number): Promise<Resultado> {
  const navegador = await chromium.launch({ channel: process.env.E2E_CANAL ?? "msedge" });
  try {
    const ctx = await navegador.newContext({ viewport: { width: ancho, height: alto } });
    await ctx.addInitScript("window.__name = (f) => f;");
    await ctx.addInitScript(() => {
      const w = window as unknown as { __largas: number[]; __inicios: number[] };
      w.__largas = [];
      w.__inicios = [];
      new PerformanceObserver((l) =>
        l.getEntries().forEach((e) => {
          w.__largas.push(e.duration);
          w.__inicios.push(Math.round(e.startTime));
        }),
      ).observe({ type: "longtask", buffered: true });
    });
    const p = await ctx.newPage();
    const cdp = await ctx.newCDPSession(p);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    const t0 = Date.now();
    await p.goto(BASE, { waitUntil: "commit" });
    await p.waitForFunction(() => {
      const img = document.querySelector<HTMLImageElement>("[data-video-scroll] img");
      return Boolean(img && img.complete && img.naturalWidth > 0);
    }, null, { timeout: 60_000 });
    const poster = Date.now() - t0;
    await p.waitForSelector("[data-lienzo-fotogramas][data-listo]", { state: "attached", timeout: 60_000 });
    const primerCuadro = Date.now() - t0;

    // Titular y letras durante la carga: deltas de rAF en los 3 s siguientes.
    const deltasCarga = await p.evaluate(
      () =>
        new Promise<number[]>((res) => {
          const d: number[] = [];
          let anterior = performance.now();
          const t = anterior;
          const paso = (ahora: number) => {
            d.push(ahora - anterior);
            anterior = ahora;
            if (ahora - t < 3000) requestAnimationFrame(paso);
            else res(d);
          };
          requestAnimationFrame(paso);
        }),
    );
    await p.waitForTimeout(6000); // deja que termine la precarga
    const estado = await p.evaluate(async () => {
      const c = document.querySelector<HTMLCanvasElement>("[data-lienzo-fotogramas]")!;
      const manifiesto = await (await fetch(`${document.querySelector<HTMLElement>("[data-video-scroll]") ? "/media/home/home-loop-frames/manifest.json" : ""}`)).json();
      const cargados = Number(c.dataset.cargados ?? 0);
      // Versión nueva: la página informa los bytes de bitmaps vivos. Versión vieja: todos los cuadros cargados quedan decodificados.
      const bytes = c.dataset.bytesBitmaps ? Number(c.dataset.bytesBitmaps) : cargados * manifiesto.ancho * manifiesto.alto * 4;
      const bitmaps = c.dataset.bitmaps ? Number(c.dataset.bitmaps) : cargados;
      const w = window as unknown as { __largas: number[] };
      return { bytes, bitmaps, cargados, largas: w.__largas, inicios: (w as unknown as { __inicios?: number[] }).__inicios ?? [] };
    });

    const p95 = (xs: number[]) => Number([...xs].sort((a, b) => a - b)[Math.floor(xs.length * 0.95)].toFixed(1));
    const recorrer = async (sentido: "adelante" | "atras") =>
      p.evaluate(async (s) => {
        const el = document.querySelector<HTMLElement>('[data-capitulo="0"]')!;
        const inicio = el.getBoundingClientRect().top + window.scrollY;
        const recorrido = el.offsetHeight - window.innerHeight;
        window.scrollTo(0, s === "adelante" ? inicio : inicio + recorrido);
        await new Promise((r) => setTimeout(r, 800));
        const deltas: number[] = [];
        let anterior = performance.now();
        const t0 = anterior;
        await new Promise<void>((res) => {
          const paso = (t: number) => {
            deltas.push(t - anterior);
            anterior = t;
            const f = Math.min(1, (t - t0) / 5000);
            window.scrollTo(0, inicio + recorrido * (s === "adelante" ? f : 1 - f));
            if (t - t0 < 5000) requestAnimationFrame(paso);
            else res();
          };
          requestAnimationFrame(paso);
        });
        return deltas;
      }, sentido);
    const adelante = await recorrer("adelante");
    const atras = await recorrer("atras");
    const finales = await p.evaluate(() => {
      const c = document.querySelector<HTMLCanvasElement>("[data-lienzo-fotogramas]")!;
      return { bytes: c.dataset.bytesBitmaps ? Number(c.dataset.bytesBitmaps) : null };
    });
    const largas = estado.largas.filter((d) => d > 50);
    console.log("largas", estado.largas.map((d, i) => `${Math.round(d)}ms@${estado.inicios[i]}`).join(" "));
    return {
      poster,
      primerCuadro,
      mbBitmaps: Number((Math.max(estado.bytes, finales.bytes ?? 0) / 1048576).toFixed(0)),
      bitmaps: estado.bitmaps,
      tareasLargasMs: Math.round(largas.reduce((s, d) => s + (d - 50), 0)),
      tareasLargas: largas.length,
      p95Carga: p95(deltasCarga),
      p95Adelante: p95(adelante),
      p95Atras: p95(atras),
      cuadrosCargados: estado.cargados,
    };
  } finally {
    await navegador.close();
  }
}

async function main() {
  const filas: Record<string, Resultado> = {};
  for (const [ancho, alto] of [[1440, 900], [390, 844]] as const) filas[`${ETIQUETA} @${ancho}`] = await medir(ancho, alto);
  console.table(filas);
  console.log(JSON.stringify(filas));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
