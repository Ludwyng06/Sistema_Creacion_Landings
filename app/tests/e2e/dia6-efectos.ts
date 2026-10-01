// Aceptación de los efectos de nivel 3 (tarea 06-B) contra `npm run dev`: cada efecto hace lo suyo con el scroll,
// mide los fps al recorrerlo, toma capturas y comprueba el respaldo reduced-motion.
//
// Uso: PUERTO=3111 npx tsx tests/e2e/dia6-efectos.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright";

const BASE = `http://localhost:${process.env.PUERTO ?? "3000"}`;
const SALIDA = join(process.cwd(), "..", "docs", "bitacora", "capturas", "dia6B");
mkdirSync(SALIDA, { recursive: true });

const EFECTOS = ["video-scroll", "producto-explotado", "pin-coreografia", "horizontal", "shader-ondas", "antes-despues-scroll"] as const;

function comprobar(condicion: unknown, mensaje: string): asserts condicion {
  if (!condicion) throw new Error(`FALLA: ${mensaje}`);
  console.log(`ok · ${mensaje}`);
}

/** Lleva el scroll a la fracción `f` del recorrido del efecto (o de la sección si no se fija). */
async function irA(pagina: Page, id: string, f: number, espera = 900) {
  await pagina.evaluate(
    ([slug, fraccion]) => {
      const demo = document.querySelector<HTMLElement>(`#efecto-${slug}`)!;
      const fijado = demo.querySelector<HTMLElement>("[data-fijado]");
      const caja = (fijado ?? demo.querySelector<HTMLElement>("[data-seccion-id]") ?? demo).getBoundingClientRect();
      const top = caja.top + window.scrollY;
      const recorrido = Math.max(0, caja.height - window.innerHeight);
      window.scrollTo(0, top + recorrido * (fraccion as number));
    },
    [id, f] as const,
  );
  await pagina.waitForTimeout(espera);
}

/** Recorre el efecto con rAF (ida y vuelta) y mide el tiempo entre cuadros. */
async function medirFps(pagina: Page, id: string, duracionMs: number) {
  await irA(pagina, id, 0, 600);
  return pagina.evaluate(
    async ([slug, dur]) => {
      const demo = document.querySelector<HTMLElement>(`#efecto-${slug}`)!;
      const fijado = demo.querySelector<HTMLElement>("[data-fijado]");
      const caja = (fijado ?? demo.querySelector<HTMLElement>("[data-seccion-id]") ?? demo).getBoundingClientRect();
      const inicio = caja.top + window.scrollY;
      const recorrido = Math.max(200, caja.height - window.innerHeight);
      const deltas: number[] = [];
      let anterior = performance.now();
      const t0 = anterior;
      await new Promise<void>((resolver) => {
        const paso = (t: number) => {
          deltas.push(t - anterior);
          anterior = t;
          const f = Math.min(1, (t - t0) / (dur as number));
          const p = f < 0.5 ? f * 2 : 2 - f * 2;
          window.scrollTo(0, inicio + recorrido * p);
          if (t - t0 < (dur as number)) requestAnimationFrame(paso);
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
        lentos: deltas.filter((d) => d > 20).length,
      };
    },
    [id, duracionMs] as const,
  );
}

async function main() {
  const navegador = await chromium.launch({ channel: "msedge" });
  const informe: Record<string, unknown> = {};
  const errores: string[] = [];
  try {
    for (const [ancho, alto, etiqueta] of [
      [1280, 800, "1280"],
      [390, 844, "390"],
    ] as const) {
      const ctx = await navegador.newContext({ viewport: { width: ancho, height: alto }, deviceScaleFactor: ancho < 500 ? 2 : 1 });
      await ctx.addInitScript("window.__name = (f) => f;");
      const pagina = await ctx.newPage();
      pagina.on("pageerror", (e) => errores.push(`${etiqueta}: ${e.message}`));
      pagina.on("console", (m) => m.type() === "error" && errores.push(`${etiqueta}: ${m.text()}`));
      await pagina.goto(`${BASE}/dev/efectos`);
      await pagina.waitForSelector("#efecto-video-scroll");
      await pagina.waitForTimeout(1500);

      for (const id of EFECTOS) {
        const demo = pagina.locator(`#efecto-${id}`);
        await demo.scrollIntoViewIfNeeded();
        await pagina.waitForTimeout(800);

        // Comprobaciones propias de cada efecto.
        if (id === "video-scroll") {
          comprobar((await demo.locator("[data-fijado='video-scroll']").count()) === 1, `${etiqueta}: video-scroll fija la sección`);
          const v = await demo.locator("[data-video-scroll]").first().getAttribute("data-fuente");
          comprobar(v === "fotogramas" || v === "video", `${etiqueta}: video-scroll pinta el clip (fuente: ${v})`);
          if (v === "fotogramas") {
            await irA(pagina, id, 0.05);
            const a = Number(await demo.locator("canvas[data-fotograma]").first().getAttribute("data-fotograma"));
            await irA(pagina, id, 0.9);
            const b = Number(await demo.locator("canvas[data-fotograma]").first().getAttribute("data-fotograma"));
            await irA(pagina, id, 0.3);
            const c = Number(await demo.locator("canvas[data-fotograma]").first().getAttribute("data-fotograma"));
            comprobar(b > a && c < b, `${etiqueta}: el fotograma va ${a} → ${b} hacia delante y baja a ${c} hacia atrás`);
          }
        }
        if (id === "producto-explotado") {
          const capa = demo.locator(".media-slot, [data-marcador-slot]").first();
          await irA(pagina, id, 0.02);
          const inicio = await capa.evaluate((e) => getComputedStyle(e).transform);
          await irA(pagina, id, 0.5);
          const mitad = await capa.evaluate((e) => getComputedStyle(e).transform);
          comprobar(inicio !== mitad && mitad !== "none", `${etiqueta}: producto-explotado separa las capas a mitad del recorrido`);
        }
        if (id === "pin-coreografia") {
          const bloque = demo.locator("[data-fijado] li").nth(2);
          await irA(pagina, id, 0.02);
          const antes = Number(await bloque.evaluate((e) => getComputedStyle(e).opacity));
          await irA(pagina, id, 0.98);
          const despues = Number(await bloque.evaluate((e) => getComputedStyle(e).opacity));
          comprobar(antes < 0.5 && despues > 0.95, `${etiqueta}: pin-coreografia hace entrar los bloques (${antes.toFixed(2)} → ${despues.toFixed(2)})`);
        }
        if (id === "horizontal") {
          const pista = demo.locator("[data-fijado] ul").first();
          await irA(pagina, id, 0.02);
          const x0 = await pista.evaluate((e) => e.getBoundingClientRect().left);
          await irA(pagina, id, 0.98);
          const x1 = await pista.evaluate((e) => e.getBoundingClientRect().left);
          comprobar(x1 < x0 - 100, `${etiqueta}: horizontal corre la pista de lado (${Math.round(x0)} → ${Math.round(x1)} px)`);
          const desborde = await pagina.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
          comprobar(!desborde, `${etiqueta}: horizontal no crea desborde en la página`);
        }
        if (id === "shader-ondas") {
          await demo.locator("canvas[data-lienzo-ondas][data-listo='true']").first().waitFor({ timeout: 10_000 });
          comprobar(true, `${etiqueta}: shader-ondas dibuja el lienzo WebGL sobre la imagen`);
        }
        if (id === "antes-despues-scroll") {
          const divisor = demo.locator("[role='slider']").first();
          await irA(pagina, id, 0.02);
          const a = Number(await divisor.getAttribute("aria-valuenow"));
          await irA(pagina, id, 0.98);
          const b = Number(await divisor.getAttribute("aria-valuenow"));
          comprobar(a < 20 && b > 80, `${etiqueta}: el scroll mueve el divisor (${a} → ${b})`);
        }

        // Capturas: a mitad del recorrido (con la animación asentada) y medición de fps.
        await irA(pagina, id, 0.5, 1800);
        await pagina.screenshot({ path: join(SALIDA, `efecto-${id}-${etiqueta}-mitad-del-recorrido.png`) });
        const fps = await medirFps(pagina, id, 4000);
        informe[`${id}-${etiqueta}`] = fps;
        console.log(`fps ${id} ${etiqueta}:`, JSON.stringify(fps));
      }
      const desborde = await pagina.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      comprobar(!desborde, `${etiqueta}: /dev/efectos no se desborda en horizontal`);
      await ctx.close();
    }

    // Respaldo reduced-motion de cada efecto (preferencia del sistema).
    const ctx = await navegador.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
    await ctx.addInitScript("window.__name = (f) => f;");
    const pagina = await ctx.newPage();
    await pagina.goto(`${BASE}/dev/efectos`);
    await pagina.waitForSelector("#efecto-video-scroll");
    await pagina.waitForTimeout(1200);
    for (const id of EFECTOS) {
      const demo = pagina.locator(`#efecto-${id}`);
      comprobar((await demo.locator("[data-fijado]").count()) === 0, `reduced-motion: ${id} no fija ni envuelve nada`);
      comprobar((await demo.locator(`[data-efecto-estatico='${id}']`).count()) === 1, `reduced-motion: ${id} deja la sección estática`);
    }
    comprobar((await pagina.locator("canvas[data-lienzo-ondas]").count()) === 0, "reduced-motion: no hay lienzo WebGL");
    const alturaMax = await pagina.evaluate(() => Math.max(...[...document.querySelectorAll("[data-demo]")].map((e) => e.getBoundingClientRect().height)));
    comprobar(alturaMax < 4000, `reduced-motion: ningún demo reserva recorrido de scroll (${Math.round(alturaMax)} px)`);
    await ctx.close();
  } finally {
    await navegador.close();
  }
  writeFileSync(join(SALIDA, "medicion-fps.json"), JSON.stringify(informe, null, 2));
  const graves = errores.filter((e) => !/favicon|DevTools|Download the React/i.test(e));
  if (graves.length) console.log("Errores de consola:", graves);
  console.log("\nEfectos de nivel 3: OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
