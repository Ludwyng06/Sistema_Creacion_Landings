// Visor: el marco del celular/tablet aprovecha el alto disponible (≥ 60 % del alto visible) con el panel de entrega abierto o plegado.
// Uso: PUERTO=3115 npx tsx tests/e2e/dia21-visor.ts   (capturas en capturas/dia21B/despues/)
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const BASE = `http://localhost:${process.env.PUERTO ?? "3000"}`;
const SALIDA = join(process.cwd(), "..", "docs", "bitacora", "capturas", "dia21B", "despues");
mkdirSync(SALIDA, { recursive: true });

async function main() {
  const lista = ((await (await fetch(`${BASE}/api/landings`)).json()) as { landings: { id: string; slug: string }[] }).landings;
  const id = (lista.find((l) => l.slug === "kit-cohete-educativo") ?? lista[0]).id;
  const navegador = await chromium.launch({ channel: process.env.E2E_CANAL ?? "msedge" });
  let fallas = 0;
  try {
    for (const [ancho, alto] of [[1440, 900], [1280, 720], [390, 844]] as const) {
      const ctx = await navegador.newContext({ viewport: { width: ancho, height: alto } });
      await ctx.addInitScript("window.__name = (f) => f;");
      const p = await ctx.newPage();
      for (const dispositivo of ["movil", "tablet"] as const) {
        for (const abierto of [false, true]) {
          await p.goto(`${BASE}/ver/${id}?dispositivo=${dispositivo}${abierto ? "&entrega=1" : ""}`, { waitUntil: "load" });
          await p.locator("[data-marco]").waitFor();
          await p.waitForTimeout(1500);
          const m = await p.evaluate(() => ({ marco: document.querySelector("[data-marco-caja]")!.getBoundingClientRect().height, visible: window.innerHeight }));
          const pct = (100 * m.marco) / m.visible;
          const ok = pct >= 60 || ancho < 768;
          if (!ok) fallas++;
          console.log(`${ok ? "ok" : "FALLA"} · @${ancho} ${dispositivo} panel ${abierto ? "abierto" : "plegado"}: marco ${m.marco.toFixed(0)} px = ${pct.toFixed(0)} % del alto visible`);
          await p.screenshot({ path: join(SALIDA, `visor-${dispositivo}-${abierto ? "abierto" : "plegado"}-${ancho}.png`) });
        }
      }
      await ctx.close();
    }
  } finally {
    await navegador.close();
  }
  if (fallas) process.exit(1);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
