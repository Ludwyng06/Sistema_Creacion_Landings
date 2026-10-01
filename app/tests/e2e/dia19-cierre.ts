// Aceptación 19-B · cierre con video vertical: el sendero avanza con el scroll mientras aparecen el titular, la frase y el botón.
// Comprueba el primer cuadro, el avance adelante y atrás, la memoria de bitmaps (≤ 16 y ≤ 80 MB), el contraste AA del texto claro
// sobre el velo en el peor fotograma, que el botón se ve, el marco 9:16 en escritorio, reduced-motion y el p95 del cuadro con CPU x4.
// Uso: PUERTO=3115 npx tsx tests/e2e/dia19-cierre.ts   (capturas en docs/bitacora/capturas/dia19B/)
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright";

const BASE = `http://localhost:${process.env.PUERTO ?? "3000"}`;
const SALIDA = join(process.cwd(), "..", "docs", "bitacora", "capturas", "dia19B");
mkdirSync(SALIDA, { recursive: true });

function comprobar(condicion: unknown, mensaje: string): asserts condicion {
  if (!condicion) throw new Error(`FALLA: ${mensaje}`);
  console.log(`ok · ${mensaje}`);
}

async function irA(p: Page, fraccion: number, espera = 1500) {
  await p.evaluate((f) => {
    const el = document.getElementById("cierre")!;
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY + (el.offsetHeight - window.innerHeight) * f);
  }, fraccion);
  await p.waitForTimeout(espera);
}

async function abrir(p: Page) {
  await p.goto(BASE, { waitUntil: "load" });
  await p.evaluate(() => {
    const el = document.querySelector<HTMLElement>('[data-diferido][data-capitulo="8"]')!;
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - window.innerHeight * 1.2);
  });
  await p.waitForSelector("#cierre [data-lienzo-fotogramas][data-listo]", { state: "attached", timeout: 30_000 });
}

const fotograma = (p: Page) => p.locator("#cierre [data-lienzo-fotogramas]").evaluate((c) => Number((c as HTMLCanvasElement).dataset.fotograma));
const opacidad = (p: Page, sel: string) => p.locator(sel).first().evaluate((e) => Number(getComputedStyle(e).opacity));

/** Contraste del texto claro sobre el velo en el peor fotograma (p99 de luminancia de cada región). */
async function medirContraste(p: Page) {
  return p.evaluate(async () => {
    const rgb = (t: string) => (t.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
    const luz = (r: number, g: number, b: number) => [r, g, b].map((v) => v / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)).reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i], 0);
    const velo = document.querySelector<HTMLElement>("[data-velo-cierre]")!;
    const alfa = Math.min(...[...getComputedStyle(velo).backgroundImage.matchAll(/\/\s*([\d.]+)\)/g)].map((m) => Number(m[1])));
    const sonda = document.createElement("div");
    sonda.style.color = "var(--tinta)";
    document.body.appendChild(sonda);
    const tinta = rgb(getComputedStyle(sonda).color);
    sonda.remove();
    const regiones = { titular: [0.15, 0.3, 0.85, 0.55], apoyo: [0.2, 0.55, 0.8, 0.65], boton: [0.2, 0.66, 0.8, 0.8] } as const;
    const peor: Record<string, number> = { titular: 0, apoyo: 0, boton: 0 };
    const manifiesto = await (await fetch("/media/home/home-cierre-frames/manifest.json")).json();
    const lienzo = document.createElement("canvas");
    const ctx = lienzo.getContext("2d", { willReadFrequently: true })!;
    for (let i = 1; i <= manifiesto.n; i++) {
      const img = new Image();
      img.src = `/media/home/home-cierre-frames/${String(i).padStart(4, "0")}.webp`;
      await img.decode();
      lienzo.width = img.width;
      lienzo.height = img.height;
      ctx.drawImage(img, 0, 0);
      for (const [nombre, [x0, y0, x1, y1]] of Object.entries(regiones)) {
        const d = ctx.getImageData(Math.round(x0 * img.width), Math.round(y0 * img.height), Math.round((x1 - x0) * img.width), Math.round((y1 - y0) * img.height)).data;
        const ls: number[] = [];
        for (let k = 0; k < d.length; k += 16) ls.push(luz(...([0, 1, 2].map((j) => (1 - alfa) * d[k + j] + alfa * tinta[j]) as [number, number, number])));
        ls.sort((a, b) => a - b);
        peor[nombre] = Math.max(peor[nombre], ls[Math.floor(ls.length * 0.99)]);
      }
    }
    const color = (sel: string) => rgb(getComputedStyle(document.querySelector(sel)!).color) as [number, number, number];
    const boton = document.querySelector<HTMLElement>("#cierre a[href='/crear']")!;
    const cb = getComputedStyle(boton);
    return {
      alfa,
      peor,
      luzTitular: luz(...color("#cierre h2")),
      luzApoyo: luz(...color("#cierre p")),
      luzBoton: [luz(...(rgb(cb.backgroundColor) as [number, number, number])), luz(...(rgb(cb.color) as [number, number, number]))],
    };
  });
}

const lum2 = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const p95 = (xs: number[]) => Number([...xs].sort((a, b) => a - b)[Math.floor(xs.length * 0.95)].toFixed(1));

async function main() {
  const navegador = await chromium.launch({ channel: process.env.E2E_CANAL ?? "msedge" });
  const errores: string[] = [];
  try {
    for (const [ancho, alto] of [[1440, 900], [390, 844]] as const) {
      const movil = ancho < 768;
      const ctx = await navegador.newContext({ viewport: { width: ancho, height: alto } });
      await ctx.addInitScript("window.__name = (f) => f;");
      const p = await ctx.newPage();
      p.on("pageerror", (e) => errores.push(e.message));
      const t0 = Date.now();
      await abrir(p);
      comprobar(Date.now() - t0 < 6000, `@${ancho} el primer cuadro del cierre se ve (${Date.now() - t0} ms con la navegación incluida)`);
      const meta = await (await p.request.get(`${BASE}/media/home/home-cierre-frames/manifest.json`)).json();
      comprobar(meta.ancho === 720 && meta.alto === 1280 && meta.formato === "webp", `@${ancho} fotogramas WebP a 720×1280 nativos (${meta.n} cuadros, q${meta.calidad})`);

      await irA(p, 0.02);
      await p.screenshot({ path: join(SALIDA, `cierre-inicio-${ancho}.png`) });
      const f0 = await fotograma(p);
      comprobar((await opacidad(p, "#cierre h2")) < 0.2, `@${ancho} al inicio todavía no aparece el titular`);
      await irA(p, 0.5);
      await p.screenshot({ path: join(SALIDA, `cierre-mitad-${ancho}.png`) });
      const f1 = await fotograma(p);
      comprobar((await opacidad(p, "#cierre h2")) > 0.95 && (await opacidad(p, "#cierre p")) > 0.95, `@${ancho} a la mitad ya están el titular y la frase`);
      await irA(p, 0.92);
      await p.screenshot({ path: join(SALIDA, `cierre-final-${ancho}.png`) });
      const f2 = await fotograma(p);
      comprobar((await opacidad(p, "#cierre a[href='/crear']")) > 0.95, `@${ancho} al final se ve el botón «Construir mi landing»`);
      comprobar(f0 < f1 && f1 < f2, `@${ancho} el sendero avanza con el scroll (${f0} → ${f1} → ${f2})`);
      await irA(p, 0.5);
      comprobar((await fotograma(p)) === f1, `@${ancho} y al volver atrás regresa al mismo cuadro`);

      const vivos = await p.locator("#cierre [data-lienzo-fotogramas]").evaluate((c) => ({ n: Number((c as HTMLCanvasElement).dataset.bitmaps), mb: Number((c as HTMLCanvasElement).dataset.bytesBitmaps) / 1048576, cargados: Number((c as HTMLCanvasElement).dataset.cargados) }));
      comprobar(vivos.n <= 16 && vivos.mb <= 80, `@${ancho} en memoria ${vivos.n} bitmaps (${vivos.mb.toFixed(0)} MB ≤ 80 MB), ${vivos.cargados} cuadros descargados`);

      const geo = await p.evaluate(() => {
        const m = document.querySelector<HTMLElement>("[data-marco-cierre]")!.getBoundingClientRect();
        return { w: m.width, h: m.height, desborde: document.documentElement.scrollWidth > window.innerWidth, botonDentro: (() => { const b = document.querySelector("#cierre a[href='/crear']")!.getBoundingClientRect(); return b.left >= m.left && b.right <= m.right; })() };
      });
      if (movil) comprobar(geo.w >= ancho - 1 && geo.h >= alto - 1, `@${ancho} el fondo ocupa toda la pantalla`);
      else comprobar(Math.abs(geo.h / geo.w - 16 / 9) < 0.05 && geo.w >= 350 && geo.w <= 480, `@${ancho} ventana vertical 9:16 de ${geo.w.toFixed(0)}×${geo.h.toFixed(0)} px (420–480 px; menos si la altura no da)`);
      comprobar(geo.botonDentro && !geo.desborde, `@${ancho} el botón cabe dentro del marco y no hay desborde horizontal`);

      const c = await medirContraste(p);
      console.log(`   velo ${c.alfa.toFixed(2)} · titular ${lum2(c.luzTitular, c.peor.titular).toFixed(1)}:1 · frase ${lum2(c.luzApoyo, c.peor.apoyo).toFixed(1)}:1 · botón ${lum2(c.luzBoton[0], c.luzBoton[1]).toFixed(1)}:1`);
      comprobar(lum2(c.luzTitular, c.peor.titular) >= 4.5, `@${ancho} titular claro ≥ 4,5:1 sobre el peor fotograma`);
      comprobar(lum2(c.luzApoyo, c.peor.apoyo) >= 4.5, `@${ancho} frase ≥ 4,5:1`);
      comprobar(lum2(c.luzBoton[0], c.luzBoton[1]) >= 4.5, `@${ancho} «Construir mi landing» ≥ 4,5:1`);

      // Rendimiento con CPU x4: p95 del cuadro al recorrer el cierre hacia adelante y hacia atrás.
      const cdp = await ctx.newCDPSession(p);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      for (const sentido of ["adelante", "atras"] as const) {
        const deltas = await p.evaluate(async (s) => {
          const el = document.getElementById("cierre")!;
          const inicio = el.getBoundingClientRect().top + window.scrollY;
          const recorrido = el.offsetHeight - window.innerHeight;
          window.scrollTo(0, s === "adelante" ? inicio : inicio + recorrido);
          await new Promise((r) => setTimeout(r, 800));
          const ds: number[] = [];
          let anterior = performance.now();
          const t0 = anterior;
          await new Promise<void>((res) => {
            const paso = (t: number) => {
              ds.push(t - anterior);
              anterior = t;
              const f = Math.min(1, (t - t0) / 5000);
              window.scrollTo(0, inicio + recorrido * (s === "adelante" ? f : 1 - f));
              if (t - t0 < 5000) requestAnimationFrame(paso);
              else res();
            };
            requestAnimationFrame(paso);
          });
          return ds;
        }, sentido);
        comprobar(p95(deltas) <= 16.7, `@${ancho} CPU x4 ${sentido}: p95 ${p95(deltas)} ms ≤ 16,7 ms`);
      }
      await ctx.close();

      // Movimiento reducido: póster fijo y todo el texto a la vista.
      const r = await (await navegador.newContext({ viewport: { width: ancho, height: alto }, reducedMotion: "reduce" })).newPage();
      await r.goto(BASE, { waitUntil: "load" });
      await r.evaluate(() => window.scrollTo(0, document.querySelector<HTMLElement>('[data-diferido][data-capitulo="8"]')!.getBoundingClientRect().top + window.scrollY - window.innerHeight));
      await r.waitForSelector("#cierre [data-video-scroll][data-fuente='poster']", { timeout: 30_000 });
      await r.evaluate(() => document.getElementById("cierre")?.scrollIntoView());
      await r.waitForTimeout(800);
      await r.screenshot({ path: join(SALIDA, `cierre-reducido-${ancho}.png`) });
      comprobar((await r.locator("#cierre canvas").count()) === 0, `@${ancho} reduced-motion: póster fijo, sin canvas`);
      comprobar((await opacidad(r, "#cierre h2")) === 1 && (await opacidad(r, "#cierre a[href='/crear']")) === 1, `@${ancho} reduced-motion: titular y botón a la vista`);
      await r.context().close();
    }
  } finally {
    await navegador.close();
  }
  const graves = errores.filter((e) => !/favicon|Failed to load resource/i.test(e));
  comprobar(graves.length === 0, `sin errores de página (${graves.slice(0, 1).join("") || "0"})`);
  console.log("dia19-cierre: TODO OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
