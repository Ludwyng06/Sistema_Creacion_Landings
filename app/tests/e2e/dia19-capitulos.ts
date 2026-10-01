// Aceptación 19-B: capítulo 4 (ensamblaje con capturas reales en un celular 390×844) y capítulo 5 (semilla en un marco grande).
// Comprueba que las secciones no quedan cortadas (cada imagen conserva su proporción y cabe entera en su tarjeta), el tamaño
// del marco, que las 3 semillas cambian y que no hay desborde. Capturas en capturas/dia19B/.
// Uso: PUERTO=3115 npx tsx tests/e2e/dia19-capitulos.ts
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

async function irA(p: Page, id: string, fraccion: number, espera = 1400) {
  await p.evaluate(
    ([i, f]) => {
      const el = document.getElementById(i as string);
      if (!el) return;
      const arriba = el.getBoundingClientRect().top + window.scrollY;
      window.scrollTo(0, arriba + (el.offsetHeight - window.innerHeight) * (f as number));
    },
    [id, fraccion],
  );
  await p.waitForTimeout(espera);
}

/** Baja hasta el capítulo (los de abajo se montan al acercarse) y espera a que esté. */
const NUMERO: Record<string, number> = { ensamblaje: 4, semilla: 5 };
const bajarHasta = (p: Page, id: string) =>
  p.evaluate(
    ([n]) => {
      const el = document.querySelector<HTMLElement>(`[data-diferido][data-capitulo="${n}"]`)!;
      window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - window.innerHeight * 1.2);
    },
    [NUMERO[id]],
  );

async function preparar(p: Page, id: string) {
  await p.goto(BASE, { waitUntil: "load" });
  await bajarHasta(p, id);
  await p.waitForSelector(`#${id} img`, { timeout: 30_000 });
  await p.waitForTimeout(500);
  await irA(p, id, 0, 1500);
}

async function main() {
  const navegador = await chromium.launch({ channel: process.env.E2E_CANAL ?? "msedge" });
  const errores: string[] = [];
  try {
    for (const [ancho, alto] of [[1280, 720], [1440, 900], [390, 844]] as const) {
      const movil = ancho < 768;
      const ctx = await navegador.newContext({ viewport: { width: ancho, height: alto } });
      await ctx.addInitScript("window.__name = (f) => f;");
      const p = await ctx.newPage();
      p.on("pageerror", (e) => errores.push(e.message));

      // ── Capítulo 4 ──
      await preparar(p, "ensamblaje");
      await p.evaluate(() => Promise.all([...document.querySelectorAll<HTMLImageElement>("#ensamblaje img")].map((i) => i.decode().catch(() => null))));
      await irA(p, "ensamblaje", 0.05);
      await p.screenshot({ path: join(SALIDA, `ensamblaje-apilado-${ancho}.png`) });
      await irA(p, "ensamblaje", 0.3);
      await p.screenshot({ path: join(SALIDA, `ensamblaje-explotado-${ancho}.png`) });
      await irA(p, "ensamblaje", 0.72);
      await p.screenshot({ path: join(SALIDA, `ensamblaje-armado-${ancho}.png`) });
      await irA(p, "ensamblaje", 0.92);
      await p.screenshot({ path: join(SALIDA, `ensamblaje-celular-${ancho}.png`) });
      const e4 = await p.evaluate(() => {
        const marco = document.querySelector<HTMLElement>("#ensamblaje [data-ventana]")!.getBoundingClientRect();
        const tarjetas = [...document.querySelectorAll<HTMLElement>("#ensamblaje [data-tarjeta-seccion]")].map((t) => {
          const img = t.querySelector("img")!;
          return { tipo: t.dataset.tarjetaSeccion, cocienteImagen: img.naturalWidth / img.naturalHeight, cociente: t.offsetWidth / t.offsetHeight, imgAltoDeTarjeta: img.offsetHeight / t.offsetHeight };
        });
        return { anchoMarco: marco.width, altoMarco: marco.height, tarjetas, desborde: document.documentElement.scrollWidth > window.innerWidth };
      });
      comprobar(Math.abs(e4.altoMarco / e4.anchoMarco - 844 / 390) < 0.02, `@${ancho} el marco del celular tiene proporción 390×844 (${e4.anchoMarco.toFixed(0)}×${e4.altoMarco.toFixed(0)} px)`);
      if (!movil) comprobar(e4.anchoMarco >= 240 && e4.anchoMarco <= 341, `@${ancho} el marco mide entre 240 y 340 px de ancho (${e4.anchoMarco.toFixed(0)})`);
      comprobar(e4.tarjetas.length === 6, `@${ancho} las 6 secciones están`);
      for (const t of e4.tarjetas) {
        comprobar(Math.abs(t.cocienteImagen - t.cociente) / t.cociente < 0.02 && Math.abs(t.imgAltoDeTarjeta - 1) < 0.02, `@${ancho} «${t.tipo}» se muestra entera, sin recortes ni estiramientos`);
      }
      comprobar(!e4.desborde, `@${ancho} sin desborde horizontal en el capítulo 4`);

      // ── Capítulo 5 ──
      await preparar(p, "semilla");
      await p.evaluate(() => Promise.all([...document.querySelectorAll<HTMLImageElement>("#semilla img")].map((i) => i.decode().catch(() => null))));
      const etiquetas: string[] = [];
      for (const [i, f] of [0.05, 0.5, 0.95].entries()) {
        await irA(p, "semilla", f, 1600);
        await p.screenshot({ path: join(SALIDA, `semilla-${i + 1}-${ancho}.png`) });
        etiquetas.push(await p.evaluate(() => document.querySelector("#semilla p[aria-live]")?.textContent ?? ""));
      }
      comprobar(new Set(etiquetas).size === 3, `@${ancho} la etiqueta cambia con las 3 semillas (${etiquetas.map((x) => x.slice(0, 26)).join(" / ")})`);
      const e5 = await p.evaluate(() => {
        const v = document.querySelector<HTMLElement>("#semilla [role=img]")!.getBoundingClientRect();
        return { ancho: v.width, capas: document.querySelectorAll("#semilla [role=img] img").length, desborde: document.documentElement.scrollWidth > window.innerWidth, cabe: v.bottom <= window.innerHeight + 1 && v.top >= 0 };
      });
      if (!movil) comprobar(e5.ancho / ancho >= 0.8 && e5.ancho / ancho <= 0.9, `@${ancho} el marco ocupa ${((100 * e5.ancho) / ancho).toFixed(0)} % del ancho (80–90 %)`);
      comprobar(e5.capas === 3, `@${ancho} hay 3 versiones de la landing (una por semilla)`);
      comprobar(e5.cabe, `@${ancho} el marco cabe entero en la pantalla`);
      comprobar(!e5.desborde, `@${ancho} sin desborde horizontal en el capítulo 5`);
      await ctx.close();

      // ── Movimiento reducido ──
      const ctxR = await navegador.newContext({ viewport: { width: ancho, height: alto }, reducedMotion: "reduce" });
      await ctxR.addInitScript("window.__name = (f) => f;");
      const r = await ctxR.newPage();
      await r.goto(BASE, { waitUntil: "load" });
      await bajarHasta(r, "ensamblaje");
      await r.waitForSelector("#ensamblaje [data-tarjeta-seccion]", { timeout: 30_000 });
      await r.evaluate(() => document.getElementById("ensamblaje")?.scrollIntoView());
      await r.waitForTimeout(900);
      await r.screenshot({ path: join(SALIDA, `ensamblaje-reducido-${ancho}.png`) });
      const dentro = await r.evaluate(() => {
        const v = document.querySelector<HTMLElement>("#ensamblaje [data-ventana]")!.getBoundingClientRect();
        return [...document.querySelectorAll<HTMLElement>("#ensamblaje [data-tarjeta-seccion]")].every((t) => {
          const c = t.getBoundingClientRect();
          return c.top >= v.top - 1 && c.bottom <= v.bottom + 1;
        });
      });
      comprobar(dentro, `@${ancho} con movimiento reducido la landing completa cabe quieta dentro del celular`);
      await bajarHasta(r, "semilla");
      await r.waitForSelector("#semilla img", { timeout: 30_000 });
      await r.evaluate(() => document.getElementById("semilla")?.scrollIntoView());
      await r.waitForTimeout(900);
      await r.screenshot({ path: join(SALIDA, `semilla-reducido-${ancho}.png`) });
      comprobar((await r.locator("#semilla img").count()) === 3, `@${ancho} con movimiento reducido se ven las 3 semillas lado a lado`);
      await ctxR.close();
    }
  } finally {
    await navegador.close();
  }
  const graves = errores.filter((e) => !/favicon|Failed to load resource/i.test(e));
  comprobar(graves.length === 0, `sin errores de página (${graves.slice(0, 1).join("") || "0"})`);
  console.log("dia19-capitulos: TODO OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
