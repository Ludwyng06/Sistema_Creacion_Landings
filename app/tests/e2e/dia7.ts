// Aceptación de los capítulos 5–7 del home y del rendimiento del home completo (tarea 07-B) contra `next start`.
// Capturas en docs/bitacora/capturas/dia7B/, fps y CLS del recorrido completo en medicion.json.
//
// Uso: PUERTO=3107 npx tsx tests/e2e/dia7.ts   (con `npm run build` y `npx next start -p 3107` encendidos)
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright";

const BASE = `http://localhost:${process.env.PUERTO ?? "3000"}`;
const SALIDA = join(process.cwd(), "..", "docs", "bitacora", "capturas", "dia7B");
mkdirSync(SALIDA, { recursive: true });

function comprobar(condicion: unknown, mensaje: string): asserts condicion {
  if (!condicion) throw new Error(`FALLA: ${mensaje}`);
  console.log(`ok · ${mensaje}`);
}

const ID_DE: Record<number, string> = { 5: "semilla", 6: "critico", 7: "banco" };

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
  await pagina.waitForTimeout(2000);
}

const desborde = (pagina: Page) => pagina.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

/** Recorre toda la página de arriba abajo con rAF midiendo cuadros y saltos de diseño. */
async function medirRecorrido(pagina: Page, duracionMs: number) {
  return pagina.evaluate(async (dur) => {
    let cls = 0;
    new PerformanceObserver((lista) => {
      for (const e of lista.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) cls += e.value;
    }).observe({ type: "layout-shift", buffered: true });
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 500));
    const total = document.documentElement.scrollHeight - window.innerHeight;
    const deltas: number[] = [];
    let anterior = performance.now();
    const t0 = anterior;
    await new Promise<void>((resolver) => {
      const paso = (t: number) => {
        deltas.push(t - anterior);
        anterior = t;
        window.scrollTo(0, total * Math.min(1, (t - t0) / dur));
        if (t - t0 < dur) requestAnimationFrame(paso);
        else resolver();
      };
      requestAnimationFrame(paso);
    });
    await new Promise((r) => setTimeout(r, 800));
    const orden = [...deltas].sort((a, b) => a - b);
    const media = deltas.reduce((s, d) => s + d, 0) / deltas.length;
    return {
      cuadros: deltas.length,
      fpsMedio: Math.round(1000 / media),
      p95Ms: Number(orden[Math.floor(orden.length * 0.95)].toFixed(1)),
      peorMs: Number(orden[orden.length - 1].toFixed(1)),
      cuadrosLentos: deltas.filter((d) => d > 20).length,
      cls: Number(cls.toFixed(4)),
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
      const contexto = await navegador.newContext({ viewport: { width: ancho, height: alto } });
      await contexto.addInitScript("window.__name = (f) => f;");
      const pagina = await contexto.newPage();
      pagina.on("console", (m) => m.type() === "error" && !m.text().includes("404") && errores.push(`${etiqueta}: ${m.text()}`));
      pagina.on("pageerror", (e) => errores.push(`${etiqueta}: ${e.message}`));
      // /banco, /tecnicas y /ajustes son de A y aún no existen en esta rama: sus precargas dan 404 y no cuentan.
      pagina.on("response", (r) => r.status() >= 400 && !/\/(banco|tecnicas|ajustes)\?_rsc/.test(r.url()) && errores.push(`${r.status()} ${r.url()}`));
      await pagina.goto(BASE, { waitUntil: "load" });
      await pagina.waitForTimeout(4000);

      // Capítulo 5 · la semilla en tres momentos (cada semilla asentada).
      const nombres: string[] = [];
      for (const [i, f] of [[1, 0.05], [2, 0.5], [3, 0.95]] as const) {
        await irA(pagina, 5, f);
        await pagina.screenshot({ path: join(SALIDA, `cap5-semilla-${i}-${etiqueta}.png`) });
        nombres.push((await pagina.locator("#semilla p", { hasText: /^Semilla \d de 3/ }).textContent()) ?? "");
      }
      comprobar(new Set(nombres).size === 3, `cap. 5 (${etiqueta}): las 3 semillas se ven distintas (${nombres.join(" | ")})`);

      // Capítulo 6 · el crítico: el radar se dibuja y el puntaje sube.
      await irA(pagina, 6, 0.1);
      const puntajeInicial = await pagina.locator("[data-puntaje]").textContent();
      await pagina.screenshot({ path: join(SALIDA, `cap6-critico-inicio-${etiqueta}.png`) });
      await irA(pagina, 6, 0.95);
      const puntajeFinal = await pagina.locator("[data-puntaje]").textContent();
      await pagina.screenshot({ path: join(SALIDA, `cap6-critico-final-${etiqueta}.png`) });
      comprobar(Number(puntajeInicial?.replace(",", ".")) < 7 && puntajeFinal?.trim() === "9,1", `cap. 6 (${etiqueta}): el puntaje sube de ${puntajeInicial} a ${puntajeFinal}`);
      comprobar((await pagina.locator("[data-eje]").count()) === 8, `cap. 6 (${etiqueta}): 8 ejes`);

      // Capítulo 7 · el banco: scroll-snap y volteo.
      await irA(pagina, 7, 0);
      await pagina.locator("#banco").scrollIntoViewIfNeeded();
      await pagina.waitForTimeout(800);
      const snap = await pagina.locator("[data-pista-banco]").evaluate((el) => getComputedStyle(el).scrollSnapType);
      comprobar(snap.includes("x"), `cap. 7 (${etiqueta}): scroll-snap nativo (${snap})`);
      await pagina.screenshot({ path: join(SALIDA, `cap7-banco-${etiqueta}.png`) });
      await pagina.getByRole("button", { name: "Ver el prompt" }).first().click();
      await pagina.waitForTimeout(1000);
      comprobar((await pagina.locator("[data-volteada='true']").count()) === 1, `cap. 7 (${etiqueta}): una tarjeta volteada`);
      await pagina.screenshot({ path: join(SALIDA, `cap7-banco-volteada-${etiqueta}.png`) });
      comprobar((await desborde(pagina)) <= 0, `home (${etiqueta}): sin desborde horizontal`);

      // Recorrido completo: fps y CLS (página recién cargada, sin caché de los capítulos diferidos).
      const fresca = await contexto.newPage();
      await fresca.goto(BASE, { waitUntil: "load" });
      const medicion = await medirRecorrido(fresca, 24_000);
      informe[`recorrido-${etiqueta}`] = medicion;
      console.log(etiqueta, JSON.stringify(medicion));
      comprobar(medicion.cls < 0.05, `home (${etiqueta}): CLS ${medicion.cls} < 0,05`);
      await contexto.close();
    }

    // reduced-motion
    for (const [ancho, alto, etiqueta] of [
      [1280, 800, "1280"],
      [390, 844, "390"],
    ] as const) {
      const contexto = await navegador.newContext({ viewport: { width: ancho, height: alto }, reducedMotion: "reduce" });
      await contexto.addInitScript("window.__name = (f) => f;");
      const pagina = await contexto.newPage();
      pagina.on("pageerror", (e) => errores.push(`rm ${etiqueta}: ${e.message}`));
      await pagina.goto(BASE, { waitUntil: "load" });
      for (const [n, nombre] of [[5, "cap5-semilla"], [6, "cap6-critico"], [7, "cap7-banco"]] as const) {
        await irA(pagina, n, 0);
        await pagina.locator(`#${ID_DE[n]}`).scrollIntoViewIfNeeded();
        await pagina.waitForTimeout(800);
        await pagina.screenshot({ path: join(SALIDA, `reduced-motion-${nombre}-${etiqueta}.png`) });
      }
      const puntaje = await pagina.locator("[data-puntaje]").textContent();
      comprobar(puntaje?.trim() === "9,1", `reduced-motion (${etiqueta}): el radar ya está dibujado (${puntaje})`);
      comprobar((await desborde(pagina)) <= 0, `reduced-motion (${etiqueta}): sin desborde horizontal`);
      await contexto.close();
    }
    comprobar(errores.length === 0, `sin errores de consola (${errores.join(" / ") || "ninguno"})`);
  } finally {
    writeFileSync(join(SALIDA, "medicion.json"), JSON.stringify(informe, null, 2));
    await navegador.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
