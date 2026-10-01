// Capturas de página completa a 390 y 1280 de las landings del banco (la vitrina de 8), en docs/bitacora/capturas/dia12B/.
// Uso: PUERTO=3112 npx tsx tests/e2e/dia12-capturas-vitrina.ts   (servidor encendido con la vitrina sembrada)
// Comprueba además: sin scroll horizontal, sin marcadores visibles en el primer viewport y sin errores de consola.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const BASE = `http://localhost:${process.env.PUERTO ?? "3000"}`;
const SALIDA = join(process.cwd(), "..", "docs", "bitacora", "capturas", "dia12B");
mkdirSync(SALIDA, { recursive: true });

async function main() {
  const { landings } = (await (await fetch(`${BASE}/api/landings?estado=en-banco`)).json()) as { landings: { id: string; slug: string; nombre: string }[] };
  if (landings.length === 0) throw new Error("El banco está vacío: siembra la vitrina primero.");
  const navegador = await chromium.launch({ channel: process.env.E2E_CANAL ?? "msedge" });
  const problemas: string[] = [];
  try {
    for (const l of landings) {
      for (const [ancho, alto] of [[390, 844], [1280, 800]] as const) {
        const ctx = await navegador.newContext({ viewport: { width: ancho, height: alto } });
        const p = await ctx.newPage();
        p.on("console", (m) => m.type() === "error" && problemas.push(`${l.slug} @${ancho} consola: ${m.text().slice(0, 160)}`));
        p.on("pageerror", (e) => problemas.push(`${l.slug} @${ancho} excepción: ${e.message.slice(0, 160)}`));
        await p.goto(`${BASE}/l/${l.slug}`, { waitUntil: "networkidle" });
        // Las secciones de abajo usan content-visibility: se pintan todas para la captura completa.
        await p.addStyleTag({ content: ".seccion-diferida{content-visibility:visible!important}" });
        await p.evaluate(async () => {
          for (let y = 0; y < document.body.scrollHeight; y += 500) {
            window.scrollTo(0, y);
            await new Promise((r) => setTimeout(r, 100));
          }
          await Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = () => r(null); }))));
          window.scrollTo(0, 0);
        });
        await p.waitForTimeout(600);
        if (await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) problemas.push(`${l.slug} @${ancho}: scroll horizontal`);
        const marcadores = await p.evaluate((alto) => [...document.querySelectorAll("[data-marcador-slot]")].filter((el) => el.getBoundingClientRect().top < alto).length, alto);
        if (marcadores > 0) problemas.push(`${l.slug} @${ancho}: ${marcadores} marcador(es) de recurso en el primer viewport`);
        await p.screenshot({ path: join(SALIDA, `${l.slug}-${ancho}.png`), fullPage: true });
        await ctx.close();
      }
      console.log(`ok · ${l.slug}`);
    }
  } finally {
    await navegador.close();
  }
  console.log(problemas.length ? `Avisos:\n${problemas.join("\n")}` : `${landings.length} landings capturadas a 390 y 1280, sin avisos.`);
  process.exit(problemas.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
