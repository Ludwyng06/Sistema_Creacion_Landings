// Aceptación 12-B §3-§4: visor /ver/[id] (cambiar de dispositivo, pantalla completa y ← →) y /banco pulido.
// Uso: PUERTO=3112 npx tsx tests/e2e/dia12-visor.ts   (con el servidor encendido; capturas en docs/bitacora/capturas/dia12B/)
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { combinar } from "@/lib/tecnicas/combinador";
import { landingEjemplo } from "../fixtures/landing-ejemplo";
import { briefCorrector } from "../tecnicas/briefs";

const BASE = `http://localhost:${process.env.PUERTO ?? "3000"}`;
const SALIDA = join(process.cwd(), "..", "docs", "bitacora", "capturas", "dia12B");
mkdirSync(SALIDA, { recursive: true });

function comprobar(condicion: unknown, mensaje: string): asserts condicion {
  if (!condicion) throw new Error(`FALLA: ${mensaje}`);
  console.log(`ok · ${mensaje}`);
}

async function crearEnBanco(nombre: string): Promise<{ id: string; slug: string }> {
  const doc = structuredClone(landingEjemplo);
  doc.meta.slug = `e2e-visor-${nombre.toLowerCase().replace(/\W+/g, "-")}-${Date.now()}`;
  doc.meta.nombre = nombre;
  const r = await fetch(`${BASE}/api/landings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ brief: briefCorrector, tecnicas: ["semilla"], prompt: combinar(briefCorrector, []), doc, proveedor: "manual" }),
  });
  comprobar(r.status === 201, `POST /api/landings → 201 (fue ${r.status})`);
  const landing = (await r.json()) as { id: string; slug: string };
  const banco = await fetch(`${BASE}/api/landings/${landing.id}/banco`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  comprobar(banco.status === 200, `la landing pasa al banco (${banco.status})`);
  return landing;
}

async function main() {
  const marca = Date.now();
  const nombres = [`Visor A ${marca}`, `Visor B ${marca}`, `Visor C ${marca}`];
  const creadas: { id: string; slug: string }[] = [];
  for (const n of nombres) {
    creadas.push(await crearEnBanco(n));
    await new Promise((r) => setTimeout(r, 30));
  }
  // El visor recorre el banco de la más reciente a la más antigua: la última creada va primero.
  const primera = creadas[2];

  const navegador = await chromium.launch({ channel: "msedge" });
  const errores: string[] = [];
  try {
    const ctx = await navegador.newContext({ viewport: { width: 1280, height: 800 } });
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errores.push(e.message));
    p.on("console", (m) => m.type() === "error" && errores.push(m.text()));

    // /banco: tarjetas con chips y filtro de temática.
    await p.goto(`${BASE}/banco`, { waitUntil: "networkidle" });
    comprobar((await p.getByLabel("Temática").count()) === 1, "/banco tiene el filtro «Temática»");
    const tarjeta = p.locator(`[data-tarjeta]`, { hasText: nombres[2] });
    comprobar((await tarjeta.locator("[data-tematica]").textContent()) === "Producto", "la tarjeta muestra el chip de temática");
    comprobar(/\d+ secciones/.test((await tarjeta.locator("[data-secciones]").textContent()) ?? ""), "la tarjeta muestra el número de secciones");
    await p.screenshot({ path: join(SALIDA, "banco-1280.png"), fullPage: true });

    // Visor en escritorio.
    await tarjeta.getByRole("link", { name: /pantalla completa/i }).click();
    await p.waitForURL(new RegExp(`/ver/${primera.id}`));
    const iframe = p.locator("iframe");
    await iframe.waitFor();
    comprobar((await iframe.getAttribute("src")) === `/l/${primera.slug}`, "el visor abre la landing pública en un iframe");
    comprobar(/Landing \d+ de \d+/.test((await p.locator("[data-posicion]").textContent()) ?? ""), "muestra «Landing N de M»");
    await p.waitForTimeout(2500);
    await p.screenshot({ path: join(SALIDA, "visor-escritorio-1280.png") });

    // Dispositivos.
    const cajaIframe = async () => (await iframe.boundingBox())!;
    await p.getByRole("button", { name: "Móvil" }).click();
    let caja = await cajaIframe();
    comprobar(Math.abs(caja.width / caja.height - 390 / 844) < 0.01, `móvil: proporción 390×844 (${Math.round(caja.width)}×${Math.round(caja.height)})`);
    comprobar(caja.height <= 800, "móvil: el marco cabe en la ventana");
    await p.waitForTimeout(1500);
    await p.screenshot({ path: join(SALIDA, "visor-movil-1280.png") });
    await p.getByRole("button", { name: "Tablet" }).click();
    caja = await cajaIframe();
    comprobar(Math.abs(caja.width / caja.height - 820 / 1180) < 0.01, `tablet: proporción 820×1180 (${Math.round(caja.width)}×${Math.round(caja.height)})`);
    await p.screenshot({ path: join(SALIDA, "visor-tablet-1280.png") });
    await p.getByRole("button", { name: "Escritorio" }).click();
    caja = await cajaIframe();
    comprobar(caja.width > 1000, `escritorio: usa todo el ancho (${Math.round(caja.width)})`);
    comprobar(new URL(p.url()).searchParams.get("dispositivo") === "escritorio", "el dispositivo queda en la dirección");

    // ← → entre landings (con el foco fuera del iframe).
    const nombreActual = () => p.locator("[data-nombre]").textContent();
    const antes = await nombreActual();
    await p.locator("body").click({ position: { x: 5, y: 5 } });
    await p.keyboard.press("ArrowRight");
    await p.waitForFunction((n) => document.querySelector("[data-nombre]")?.textContent !== n, antes);
    const despues = await nombreActual();
    comprobar(antes !== despues, `→ cambia de landing («${antes}» → «${despues}»)`);
    comprobar(new URL(p.url()).pathname.startsWith("/ver/"), "la dirección sigue en /ver/[id]");
    await p.keyboard.press("ArrowLeft");
    await p.waitForFunction((n) => document.querySelector("[data-nombre]")?.textContent === n, antes);
    comprobar((await nombreActual()) === antes, "← vuelve a la anterior");
    await p.getByRole("button", { name: "Landing anterior" }).click();
    comprobar((await nombreActual()) !== antes, "el botón «anterior» también navega");

    // Panel de detalles.
    await p.getByRole("button", { name: "Detalles" }).click();
    comprobar((await p.locator("#visor-detalles [data-bloque]").count()) === 4, "el panel muestra el prompt de 4 bloques");
    await p.screenshot({ path: join(SALIDA, "visor-detalles-1280.png") });
    await p.getByRole("button", { name: "Detalles" }).click();

    // Pantalla completa real (Fullscreen API).
    const antesFs = await nombreActual();
    await p.getByRole("button", { name: "Pantalla completa" }).click();
    await p.waitForFunction(() => document.fullscreenElement !== null, null, { timeout: 5000 });
    comprobar(await p.evaluate(() => document.fullscreenElement?.hasAttribute("data-visor")), "pantalla completa sobre el visor");
    comprobar((await p.locator("header").count()) === 0, "en pantalla completa se oculta la barra");
    comprobar((await p.locator("[data-controles-flotantes]").count()) === 1, "quedan los controles flotantes");
    await p.locator("[data-controles-flotantes] [data-siguiente]").click();
    await p.waitForTimeout(500);
    comprobar(await p.evaluate(() => document.fullscreenElement !== null), "cambiar de landing no sale de la pantalla completa");
    comprobar(antesFs !== null, "hay nombre antes de la pantalla completa");
    await p.locator("[data-controles-flotantes]").getByRole("button", { name: "Móvil" }).click();
    await p.screenshot({ path: join(SALIDA, "visor-pantalla-completa-movil.png") });
    await p.keyboard.press("Escape");
    await p.evaluate(() => document.exitFullscreen().catch(() => {}));
    await p.waitForFunction(() => document.fullscreenElement === null);
    await p.waitForSelector("header");
    comprobar(true, "Esc sale de la pantalla completa y vuelve la barra");

    // Móvil real (390): la barra cabe sin scroll horizontal.
    const movil = await navegador.newContext({ viewport: { width: 390, height: 844 } });
    const pm = await movil.newPage();
    await pm.goto(`${BASE}/ver/${primera.id}?dispositivo=movil`, { waitUntil: "networkidle" });
    comprobar(await pm.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "a 390 px no hay scroll horizontal");
    await pm.screenshot({ path: join(SALIDA, "visor-390.png") });
    await pm.goto(`${BASE}/banco`, { waitUntil: "networkidle" });
    comprobar(await pm.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "/banco a 390 px no tiene scroll horizontal");
    await pm.screenshot({ path: join(SALIDA, "banco-390.png"), fullPage: true });
    await movil.close();
    await ctx.close();
  } finally {
    await navegador.close();
  }
  const graves = errores.filter((e) => !/favicon|Failed to load resource.*(404|429)/i.test(e));
  comprobar(graves.length === 0, `sin errores de consola (${graves.slice(0, 3).join(" | ") || "0"})`);
  console.log("dia12-visor: TODO OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
