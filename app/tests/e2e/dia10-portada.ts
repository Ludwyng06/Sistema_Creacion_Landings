// Aceptación 10-B y 17-B · portada con el clip de la fábrica: el scroll mueve el fotograma (adelante y atrás), fps con CPU x4,
// contraste AA del texto claro sobre los fotogramas más claros, reduced-motion con póster fijo y transición al capítulo 1.
// Uso: PUERTO=3109 npx tsx tests/e2e/dia10-portada.ts   (con `next start`; capturas en docs/bitacora/capturas/dia17B/)
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright";

const BASE = `http://localhost:${process.env.PUERTO ?? "3000"}`;
const SALIDA = join(process.cwd(), "..", "docs", "bitacora", "capturas", "dia17B");
mkdirSync(SALIDA, { recursive: true });

function comprobar(condicion: unknown, mensaje: string): asserts condicion {
  if (!condicion) throw new Error(`FALLA: ${mensaje}`);
  console.log(`ok · ${mensaje}`);
}

async function irA(p: Page, fraccion: number, espera = 1200) {
  await p.evaluate((f) => {
    const el = document.querySelector<HTMLElement>('[data-capitulo="0"]')!;
    const recorrido = Math.max(0, el.offsetHeight - window.innerHeight);
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY + recorrido * f);
  }, fraccion);
  await p.waitForTimeout(espera);
}

const fotograma = (p: Page) => p.locator("[data-lienzo-fotogramas]").evaluate((c) => Number((c as HTMLCanvasElement).dataset.fotograma));

/** Luminancia relativa WCAG de un color sRGB 0–255. */
const lum = (r: number, g: number, b: number) => [r, g, b].map((v) => v / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)).reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i], 0);
const contraste = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/** Contraste del texto claro sobre el velo en los fotogramas más claros (p99 de luminancia de cada región). */
async function medirContraste(p: Page) {
  return p.evaluate(async () => {
    const css = (sel: string, prop: string) => getComputedStyle(document.querySelector(sel)!).getPropertyValue(prop);
    const rgb = (t: string) => (t.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number) as [number, number, number];
    const velo = document.querySelector<HTMLElement>("[data-velo-portada]")!;
    const alfas = [...getComputedStyle(velo).backgroundImage.matchAll(/\/\s*([\d.]+)\)/g)].map((m) => Number(m[1]));
    const alfa = Math.min(...alfas) * Number(getComputedStyle(velo).opacity);
    const sonda = document.createElement("div");
    sonda.style.color = "var(--tinta)";
    document.body.appendChild(sonda);
    const tinta = rgb(getComputedStyle(sonda).color);
    sonda.remove();
    const luz = (r: number, g: number, b: number) => [r, g, b].map((v) => v / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)).reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i], 0);
    const regiones = { titular: [0.1, 0.3, 0.9, 0.62], apoyo: [0.2, 0.55, 0.8, 0.72], aviso: [0.2, 0.86, 0.8, 0.97] } as const;
    const peor: Record<string, number> = { titular: 0, apoyo: 0, aviso: 0 };
    const lienzo = document.createElement("canvas");
    const ctx = lienzo.getContext("2d", { willReadFrequently: true })!;
    const manifiesto = await (await fetch("/media/home/home-loop-frames/manifest.json")).json();
    for (let i = 1; i <= manifiesto.n; i += 1) {
      const img = new Image();
      img.src = `/media/home/home-loop-frames/${String(i).padStart(4, "0")}.${manifiesto.formato ?? "webp"}`;
      await img.decode();
      lienzo.width = img.width;
      lienzo.height = img.height;
      ctx.drawImage(img, 0, 0);
      for (const [nombre, [x0, y0, x1, y1]] of Object.entries(regiones)) {
        const d = ctx.getImageData(Math.round(x0 * img.width), Math.round(y0 * img.height), Math.round((x1 - x0) * img.width), Math.round((y1 - y0) * img.height)).data;
        const ls: number[] = [];
        for (let k = 0; k < d.length; k += 16) {
          const c = [0, 1, 2].map((j) => (1 - alfa) * d[k + j] + alfa * tinta[j]);
          ls.push(luz(c[0], c[1], c[2]));
        }
        ls.sort((a, b) => a - b);
        peor[nombre] = Math.max(peor[nombre], ls[Math.floor(ls.length * 0.99)]);
      }
    }
    const luzTexto = (sel: string) => { const c = rgb(getComputedStyle(document.querySelector(sel)!).color); return luz(c[0], c[1], c[2]); };
    const boton = document.querySelector<HTMLElement>("#portada a[href='/crear']")!;
    const cb = getComputedStyle(boton);
    const fondo = rgb(cb.backgroundColor);
    const textoBoton = rgb(cb.color);
    return {
      alfa,
      peor,
      luzTitular: luzTexto("#portada [data-titular-cinetico]"),
      luzApoyo: luzTexto("#portada p"),
      luzBoton: [luz(fondo[0], fondo[1], fondo[2]), luz(textoBoton[0], textoBoton[1], textoBoton[2])],
      luzAviso: luzTexto("#portada p:last-of-type"),
    };
  });
}

async function main() {
  const navegador = await chromium.launch({ channel: "msedge" });
  const errores: string[] = [];
  try {
    for (const [ancho, alto] of [[1440, 900], [1920, 1080], [390, 844]] as const) {
      const ctx = await navegador.newContext({ viewport: { width: ancho, height: alto } });
      await ctx.addInitScript("window.__name = (f) => f;");
      const p = await ctx.newPage();
      p.on("pageerror", (e) => errores.push(e.message));
      const movil = ancho < 768;
      const carpeta = movil ? "home-loop-frames-movil" : "home-loop-frames";
      const salida = Date.now();
      await p.goto(BASE, { waitUntil: "load" });
      await p.waitForSelector("[data-video-scroll][data-fuente='fotogramas']", { timeout: 30_000 });
      await p.waitForSelector("[data-lienzo-fotogramas][data-listo]", { state: "attached", timeout: 30_000 });
      const primero = Date.now() - salida;
      comprobar(primero < 1500, `@${ancho} el primer cuadro se ve en ${primero} ms (< 1500 ms)`);
      const meta = await (await p.request.get(`${BASE}/media/home/${carpeta}/manifest.json`)).json();
      comprobar(meta.n >= (movil ? 80 : 100), `@${ancho} el juego ${movil ? "móvil" : "de escritorio"} trae ${meta.n} cuadros (${meta.formato}, ${meta.ancho}×${meta.alto})`);
      comprobar(movil ? meta.ancho <= 720 : meta.ancho === 1280 && meta.alto === 720, `@${ancho} a resolución nativa, sin reescalar`);
      const primeras = Math.ceil(meta.n / 8) + 1;
      await p.waitForFunction((k) => Number(document.querySelector<HTMLCanvasElement>("[data-lienzo-fotogramas]")?.dataset.cargados ?? 0) >= k, primeras, { timeout: 30_000 });
      comprobar(true, `@${ancho} la primera pasada (1 de cada 8) está cargada`);
      const pedidos = await p.evaluate(() => performance.getEntriesByType("resource").map((r) => r.name).filter((n) => /home-loop-frames[^?]*.(avif|webp)$/.test(n)));
      comprobar(pedidos.every((n) => (movil ? n.includes("home-loop-frames-movil") : !n.includes("-movil"))), `@${ancho} el navegador pide solo el juego que le toca`);
      await p.waitForFunction((n) => Number(document.querySelector<HTMLCanvasElement>("[data-lienzo-fotogramas]")?.dataset.cargados ?? 0) >= n, meta.n, { timeout: 60_000 });
      comprobar(true, `@${ancho} después se cargó el resto en segundo plano`);
      comprobar((await p.locator("[data-lienzo-fotogramas]").evaluate((c) => (c as HTMLCanvasElement).width)) >= ancho, `@${ancho} el canvas se dibuja a la densidad de la pantalla`);

      // Home liviano: solo viven pocos bitmaps decodificados (≤ 16 y ≤ 80 MB), no toda la secuencia.
      const vivos = await p.locator("[data-lienzo-fotogramas]").evaluate((c) => ({ n: Number((c as HTMLCanvasElement).dataset.bitmaps), mb: Number((c as HTMLCanvasElement).dataset.bytesBitmaps) / 1048576 }));
      comprobar(vivos.n <= 16 && vivos.mb <= 80, `@${ancho} en memoria hay ${vivos.n} bitmaps (${vivos.mb.toFixed(0)} MB ≤ 80 MB)`);

      // El scroll cambia el fotograma, adelante y atrás.
      await irA(p, 0);
      const inicio = await fotograma(p);
      await p.screenshot({ path: join(SALIDA, `portada-inicio-${ancho}.png`) });
      await irA(p, 0.5);
      const mitad = await fotograma(p);
      await p.screenshot({ path: join(SALIDA, `portada-mitad-${ancho}.png`) });
      await irA(p, 0.95);
      const final = await fotograma(p);
      await irA(p, 0.5);
      const atras = await fotograma(p);
      comprobar(inicio < mitad && mitad < final, `@${ancho} el scroll avanza el fotograma (${inicio} → ${mitad} → ${final})`);
      comprobar(atras === mitad, `@${ancho} al volver atrás regresa al mismo fotograma (${atras})`);

      // Transición al capítulo 1: se funde al papel, sin corte.
      await irA(p, 0.9, 1500);
      await p.screenshot({ path: join(SALIDA, `portada-transicion-a-cap1-${ancho}.png`) });
      const fundido = await p.locator("[data-fundido-portada]").evaluate((e) => Number(getComputedStyle(e).opacity));
      comprobar(fundido > 0.5, `@${ancho} al final de la portada el fundido al papel está en ${fundido.toFixed(2)}`);
      await p.evaluate(() => document.querySelector("#problema")!.scrollIntoView());
      await p.waitForTimeout(800);
      await p.evaluate(() => window.scrollBy(0, -window.innerHeight * 0.45));
      await p.waitForTimeout(800);
      await p.screenshot({ path: join(SALIDA, `portada-al-capitulo-1-${ancho}.png`) });

      // Contraste AA sobre los fotogramas más claros (velo a su opacidad con el texto visible).
      await irA(p, 0);
      const c = await medirContraste(p);
      const claro = (l: number, lp: number) => contraste(lp, l);
      const titular = claro(c.peor.titular, c.luzTitular);
      const apoyo = claro(c.peor.apoyo, c.luzApoyo);
      const aviso = claro(c.peor.aviso, c.luzAviso);
      console.log(`   velo ${c.alfa.toFixed(2)} · titular ${titular.toFixed(1)}:1 · apoyo ${apoyo.toFixed(1)}:1 · aviso ${aviso.toFixed(1)}:1`);
      comprobar(titular >= 4.5, `@${ancho} titular claro ≥ 4,5:1 sobre el fotograma más claro (${titular.toFixed(1)})`);
      comprobar(apoyo >= 4.5, `@${ancho} texto de apoyo ≥ 4,5:1 (${apoyo.toFixed(1)})`);
      comprobar(aviso >= 4.5, `@${ancho} aviso de scroll ≥ 4,5:1 (${aviso.toFixed(1)})`);
      const boton = contraste(c.luzBoton[0], c.luzBoton[1]);
      comprobar(boton >= 4.5, `@${ancho} «Crear la mía» ≥ 4,5:1 (${boton.toFixed(1)})`);
      comprobar(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `@${ancho} sin desborde horizontal`);

      // fps con la CPU x4, adelante y atrás.
      const cdp = await ctx.newCDPSession(p);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      for (const sentido of ["adelante", "atras"] as const) {
        const r = await p.evaluate(async (s) => {
          const el = document.querySelector<HTMLElement>('[data-capitulo="0"]')!;
          const inicio = el.getBoundingClientRect().top + window.scrollY;
          const recorrido = el.offsetHeight - window.innerHeight;
          window.scrollTo(0, s === "adelante" ? inicio : inicio + recorrido);
          await new Promise((res) => setTimeout(res, 600));
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
          const o = [...deltas].sort((a, b) => a - b);
          return { cuadros: deltas.length, p95: Number(o[Math.floor(o.length * 0.95)].toFixed(1)), peor: Number(o.at(-1)!.toFixed(1)) };
        }, sentido);
        console.log(`   CPU x4 ${ancho} ${sentido}: ${JSON.stringify(r)}`);
        comprobar(r.p95 <= 16.7, `@${ancho} CPU x4 ${sentido}: p95 ${r.p95} ms ≤ 16,7 ms`);
      }
      await ctx.close();

      // reduced-motion: póster fijo, mismo velo y texto legible.
      const rm = await navegador.newContext({ viewport: { width: ancho, height: alto }, reducedMotion: "reduce" });
      const q = await rm.newPage();
      await q.goto(BASE, { waitUntil: "load" });
      await q.waitForSelector("[data-video-scroll][data-fuente='poster']", { timeout: 20_000 });
      comprobar(true, `@${ancho} reduced-motion: la portada usa el póster fijo`);
      comprobar((await q.locator("[data-velo-portada]").evaluate((e) => Number(getComputedStyle(e).opacity))) === 1, `@${ancho} reduced-motion: el velo está completo`);
      comprobar(await q.getByRole("link", { name: "Crear la mía" }).isVisible(), `@${ancho} reduced-motion: el botón se ve`);
      await q.screenshot({ path: join(SALIDA, `portada-reduced-motion-${ancho}.png`) });
      await rm.close();
    }
  } finally {
    await navegador.close();
  }
  comprobar(errores.length === 0, `sin errores de página ${errores.join(" | ")}`);
  console.log("Portada 10-B: OK");
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
