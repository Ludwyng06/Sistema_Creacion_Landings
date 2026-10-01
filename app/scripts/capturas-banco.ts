// npm run capturas:banco -- --url http://localhost:3000 [--salida ../docs/bitacora/capturas/dia8]
// Capturas de /banco y /banco/[id] (390 y 1280 px). Espera a que carguen todas las imágenes y avisa si el indicador
// de errores de Next aparece o hay errores de consola. Para capturas limpias usa `next build` + `next start`.
import "./_env";
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { Page } from "playwright";

const argumento = (n: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

async function imagenesCargadas(p: Page) {
  // Desplaza para activar cualquier carga diferida y espera a que cada <img> termine; luego vuelve arriba.
  await p.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 80));
    }
    await Promise.all(
      [...document.images].map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = () => r(null); }))),
    );
    window.scrollTo(0, 0);
  });
  await p.waitForTimeout(500);
}

async function main() {
  const base = (argumento("url") ?? "http://localhost:3000").replace(/\/+$/, "");
  const salida = resolve(argumento("salida") ?? "../docs/bitacora/capturas/dia8");
  await mkdir(salida, { recursive: true });
  const { chromium } = await import("playwright");
  const canal = process.env.E2E_CANAL;
  const navegador = await chromium.launch(canal ? { channel: canal } : {});
  const problemas: string[] = [];
  try {
    const { landings } = (await (await fetch(`${base}/api/landings?estado=en-banco`)).json()) as { landings: { id: string }[] };
    if (landings.length === 0) throw new Error("El banco está vacío: ejecuta npm run db:semilla primero.");
    for (const [ancho, alto, sufijo] of [[390, 844, "390"], [1280, 900, "1280"]] as const) {
      const p = await navegador.newPage({ viewport: { width: ancho, height: alto } });
      p.on("console", (m) => m.type() === "error" && problemas.push(`${sufijo} consola: ${m.text().slice(0, 200)}`));
      p.on("pageerror", (e) => problemas.push(`${sufijo} excepción: ${e.message.slice(0, 200)}`));
      await p.goto(`${base}/banco`, { waitUntil: "networkidle" });
      await imagenesCargadas(p);
      await p.screenshot({ path: join(salida, `banco-${sufijo}.png`), fullPage: true });
      if (ancho === 1280) {
        await p.getByRole("button", { name: /Ver el prompt de/ }).first().click();
        await p.waitForTimeout(900);
        await p.screenshot({ path: join(salida, "banco-volteada-1280.png") });
      }
      await p.goto(`${base}/banco/${landings[0].id}`, { waitUntil: "networkidle" });
      await p.waitForTimeout(1800);
      await p.screenshot({ path: join(salida, `banco-detalle-${sufijo}.png`) });
      const indicador = await p.evaluate(() => (document.querySelector("nextjs-portal")?.shadowRoot?.textContent ?? "").match(/\d+ Issues?/g)?.[0]);
      if (indicador) problemas.push(`${sufijo}: el indicador de Next muestra «${indicador}»`);
      await p.close();
    }
  } finally {
    await navegador.close();
  }
  console.log(problemas.length ? `Avisos:\n${problemas.join("\n")}` : "Capturas listas, sin errores de consola ni indicador de Next.");
  process.exit(problemas.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
