// Aceptación del home (tarea 05-B) contra `npm run dev`: el scroll recorre el capítulo 0 hacia delante y hacia
// atrás y el fotograma pintado cambia en ambos sentidos; capturas por capítulo; sin desborde; reduced-motion;
// y medición de fps del scroll del capítulo 0.
//
// Uso: PUERTO=3111 npx tsx tests/e2e/dia5.ts   (con el servidor de desarrollo encendido y los fotogramas generados)
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright";

const BASE = `http://localhost:${process.env.PUERTO ?? "3000"}`;
const SALIDA = join(process.cwd(), "..", "docs", "bitacora", "capturas", "dia5B");
mkdirSync(SALIDA, { recursive: true });

function comprobar(condicion: unknown, mensaje: string): asserts condicion {
  if (!condicion) throw new Error(`FALLA: ${mensaje}`);
  console.log(`ok · ${mensaje}`);
}

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Posición de scroll (px) que deja el capítulo `n` al `fraccion` de su recorrido. */
async function irA(pagina: Page, n: number, fraccion: number) {
  const y = await pagina.evaluate(
    ([numero, f]) => {
      const el = document.querySelector<HTMLElement>(`[data-capitulo="${numero}"]`)!;
      const recorrido = Math.max(0, el.offsetHeight - window.innerHeight);
      return el.getBoundingClientRect().top + window.scrollY + recorrido * f;
    },
    [n, fraccion] as const,
  );
  await pagina.evaluate((valor) => window.scrollTo(0, valor), y);
  await pagina.waitForTimeout(1800); // deja terminar el suavizado del scroll y las animaciones
}

const fotogramaActual = (pagina: Page) => pagina.evaluate(() => Number(document.querySelector<HTMLCanvasElement>("[data-lienzo-fotogramas]")?.dataset.fotograma ?? 0));

async function esperarCanvas(pagina: Page) {
  await pagina.waitForSelector("[data-lienzo-fotogramas][data-listo='true']", { timeout: 30_000 });
  // Deja terminar la precarga progresiva.
  await pagina.waitForFunction(
    () => Number(document.querySelector<HTMLCanvasElement>("[data-lienzo-fotogramas]")?.dataset.cargados ?? 0) >= 100,
    undefined,
    { timeout: 30_000 },
  ).catch(() => {});
}

/** Recorre el capítulo 0 con rAF y mide el tiempo entre cuadros. */
async function medirFps(pagina: Page, duracionMs: number) {
  return pagina.evaluate(async (dur) => {
    const el = document.querySelector<HTMLElement>('[data-capitulo="0"]')!;
    const inicio = el.getBoundingClientRect().top + window.scrollY;
    const recorrido = el.offsetHeight - window.innerHeight;
    window.scrollTo(0, inicio);
    await new Promise((r) => setTimeout(r, 400));
    const deltas: number[] = [];
    let anterior = performance.now();
    const t0 = anterior;
    await new Promise<void>((resolver) => {
      const paso = (t: number) => {
        deltas.push(t - anterior);
        anterior = t;
        const f = Math.min(1, (t - t0) / dur);
        // Ida y vuelta: baja durante la primera mitad y sube durante la segunda.
        const p = f < 0.5 ? f * 2 : 2 - f * 2;
        window.scrollTo(0, inicio + recorrido * p);
        if (t - t0 < dur) requestAnimationFrame(paso);
        else resolver();
      };
      requestAnimationFrame(paso);
    });
    const orden = [...deltas].sort((a, b) => a - b);
    const media = deltas.reduce((s, d) => s + d, 0) / deltas.length;
    return {
      cuadros: deltas.length,
      fpsMedio: Math.round(1000 / media),
      p95Ms: Number(orden[Math.floor(orden.length * 0.95)].toFixed(1)),
      peorMs: Number(orden[orden.length - 1].toFixed(1)),
      cuadrosLentos: deltas.filter((d) => d > 20).length,
    };
  }, duracionMs);
}

async function main() {
  const navegador = await chromium.launch({ channel: "msedge" });
  const errores: string[] = [];
  const informe: Record<string, unknown> = {};
  try {
    for (const [ancho, alto, etiqueta] of [
      [1280, 800, "1280"],
      [390, 844, "390"],
    ] as const) {
      const ctx = await navegador.newContext({ viewport: { width: ancho, height: alto }, deviceScaleFactor: ancho < 500 ? 2 : 1 });
      await ctx.addInitScript("window.__name = (f) => f;"); // esbuild inyecta __name en las funciones de evaluate
      const pagina = await ctx.newPage();
      pagina.on("pageerror", (e) => errores.push(`${etiqueta}: ${e.message}`));
      pagina.on("console", (m) => m.type() === "error" && errores.push(`${etiqueta}: ${m.text()}`));
      await pagina.goto(BASE);
      await pagina.waitForSelector("[data-capitulo='0']");
      await esperarCanvas(pagina);
      const fuente = await pagina.getAttribute("[data-video-scroll]", "data-fuente");
      comprobar(fuente === "fotogramas", `${etiqueta}: el capítulo 0 usa la secuencia de fotogramas (fuente: ${fuente})`);
      await pagina.waitForTimeout(2500); // el titular cinético termina de subir
      await pagina.screenshot({ path: join(SALIDA, `home-cap0-${etiqueta}.png`) });

      // Recorrido hacia delante y hacia atrás: el fotograma cambia en ambos sentidos.
      const ida: number[] = [];
      for (const f of [0, 0.25, 0.5, 0.75, 1]) {
        await irA(pagina, 0, f);
        ida.push(await fotogramaActual(pagina));
        if (f === 0.5 && ancho === 1280) await pagina.screenshot({ path: join(SALIDA, "home-cap0-mitad-1280.png") });
      }
      const vuelta: number[] = [];
      for (const f of [0.75, 0.5, 0.25, 0]) {
        await irA(pagina, 0, f);
        vuelta.push(await fotogramaActual(pagina));
      }
      comprobar(ida.every((v, i) => i === 0 || v > ida[i - 1]), `${etiqueta}: hacia delante el fotograma sube ${ida.join(" → ")}`);
      comprobar(vuelta.every((v, i) => i === 0 || v < vuelta[i - 1]), `${etiqueta}: hacia atrás el fotograma baja ${vuelta.join(" → ")}`);
      comprobar(vuelta.at(-1)! <= 2, `${etiqueta}: al volver al inicio se repinta el primer fotograma (${vuelta.at(-1)})`);
      informe[`fotogramas-${etiqueta}`] = { ida, vuelta };

      // Una captura por capítulo, a media altura de su recorrido.
      for (let n = 1; n <= 8; n++) {
        if (n === 4) {
          await irA(pagina, 4, 0.3);
          await pagina.screenshot({ path: join(SALIDA, `home-cap4-explosion-${etiqueta}.png`) });
        }
        await irA(pagina, n, ({ 1: 0.48, 2: 0.7, 3: 0.95, 4: 0.97 } as Record<number, number>)[n] ?? 0.1);
        await pagina.waitForTimeout(800);
        const marcado = await pagina.getAttribute("[data-indicador-capitulo]", "data-indicador-capitulo");
        if (n <= 4) comprobar(Number(marcado) === n, `${etiqueta}: el indicador marca el capítulo ${n} (marca ${marcado})`);
        await pagina.screenshot({ path: join(SALIDA, `home-cap${n}-${etiqueta}.png`) });
      }
      const desborde = await pagina.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      comprobar(!desborde, `${etiqueta}: sin desborde horizontal en toda la página`);

      if (ancho === 1280) {
        await pagina.evaluate(() => window.scrollTo(0, 0));
        await pagina.waitForTimeout(500);
        informe.fps = await medirFps(pagina, 5000);
        console.log("fps del capítulo 0 (1280):", informe.fps);
      } else {
        await pagina.evaluate(() => window.scrollTo(0, 0));
        await pagina.waitForTimeout(500);
        informe.fpsMovil = await medirFps(pagina, 5000);
        console.log("fps del capítulo 0 (390):", informe.fpsMovil);
      }
      await ctx.close();
    }

    // reduced-motion: todo estático, legible y sin desborde.
    for (const [ancho, alto] of [
      [390, 844],
      [1280, 800],
    ] as const) {
      const ctx = await navegador.newContext({ viewport: { width: ancho, height: alto }, reducedMotion: "reduce" });
      const pagina = await ctx.newPage();
      await pagina.goto(BASE);
      await pagina.waitForSelector("h1[data-titular-cinetico]");
      await pagina.waitForTimeout(800);
      const fuente = await pagina.getAttribute("[data-video-scroll]", "data-fuente");
      comprobar(fuente === "poster", `reduced-motion ${ancho}: el capítulo 0 muestra el póster fijo (fuente: ${fuente})`);
      const canvas = await pagina.locator("[data-lienzo-fotogramas]").count();
      comprobar(canvas === 0, `reduced-motion ${ancho}: no hay canvas de fotogramas`);
      const titular = await pagina.locator("h1[data-titular-cinetico]").getAttribute("data-titular-cinetico");
      comprobar(titular === "quieto", `reduced-motion ${ancho}: el titular no se anima`);
      const alturaPagina = await pagina.evaluate(() => document.documentElement.scrollHeight / window.innerHeight);
      comprobar(alturaPagina < 20, `reduced-motion ${ancho}: sin recorridos largos de scroll (${alturaPagina.toFixed(1)} pantallas)`);
      const fijos = await pagina.evaluate(() => [...document.querySelectorAll("main section > div")].filter((e) => getComputedStyle(e).position === "sticky").length);
      comprobar(fijos === 0, `reduced-motion ${ancho}: ningún contenido queda fijo`);
      const desborde = await pagina.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      comprobar(!desborde, `reduced-motion ${ancho}: sin desborde horizontal`);
      const texto = await pagina.locator('[data-capitulo="2"]').innerText();
      comprobar(texto.includes("Corrector de postura"), `reduced-motion ${ancho}: el brief aparece escrito completo`);
      if (ancho === 390) await pagina.screenshot({ path: join(SALIDA, "home-reduced-motion-390.png"), fullPage: false });
      await ctx.close();
    }
  } finally {
    await navegador.close();
  }
  writeFileSync(join(SALIDA, "medicion.json"), JSON.stringify(informe, null, 2));
  const graves = errores.filter((e) => !/favicon|DevTools|Download the React/i.test(e));
  if (graves.length) console.log("Errores de consola:", graves);
  console.log(`\nAceptación del home: OK · capturas en ${SALIDA}`);
}

void espera;
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
