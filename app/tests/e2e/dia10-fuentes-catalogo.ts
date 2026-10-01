// 10-B con el catálogo real: cada opción del selector se ve con SU tipografía (font-family computado + FontFace cargada +
// document.fonts.check), la vista previa cambia con el cursor y se capturan 3 tipografías distintas elegidas a 1280 px.
// Uso: PUERTO=3109 npx tsx tests/e2e/dia10-fuentes-catalogo.ts   (capturas en docs/bitacora/capturas/dia10B/)
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Locator, type Page } from "playwright";
import { combinar } from "@/lib/tecnicas/combinador";
import { landingEjemplo } from "../fixtures/landing-ejemplo";
import { briefCorrector } from "../tecnicas/briefs";

const BASE = `http://localhost:${process.env.PUERTO ?? "3000"}`;
const SALIDA = join(process.cwd(), "..", "docs", "bitacora", "capturas", "dia10B");
mkdirSync(SALIDA, { recursive: true });

function comprobar(condicion: unknown, mensaje: string): asserts condicion {
  if (!condicion) throw new Error(`FALLA: ${mensaje}`);
  console.log(`ok · ${mensaje}`);
}

async function crearLanding(): Promise<string> {
  const doc = structuredClone(landingEjemplo);
  doc.meta.slug = `e2e-fuentes-${Date.now()}`;
  doc.meta.nombre = "Prueba fuentes del catálogo";
  const r = await fetch(`${BASE}/api/landings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ brief: briefCorrector, tecnicas: ["semilla"], prompt: combinar(briefCorrector, []), doc, proveedor: "manual" }),
  });
  comprobar(r.status === 201, "POST /api/landings → 201");
  return ((await r.json()) as { id: string }).id;
}

/** La tipografía se ve de verdad: el font-family computado la nombra, hay una FontFace cargada y `document.fonts.check` da true. */
async function seVeConSuFuente(p: Page, elemento: Locator, familia: string) {
  await elemento.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
  await p.waitForFunction((f) => document.querySelector(`link[data-fuente-previa="${f}"]`), familia, { timeout: 10_000 });
  await p.waitForFunction((f) => [...document.fonts].some((c) => c.family.replace(/"/g, "") === f), familia, { timeout: 15_000 }).catch(() => {});
  await p.evaluate((f) => document.fonts.load(`16px "${f}"`), familia);
  const computado = await elemento.evaluate((e) => getComputedStyle(e).fontFamily);
  const estado = await p.evaluate((f) => {
    const caras = [...document.fonts].filter((c) => c.family.replace(/"/g, "") === f);
    return { caras: caras.length, cargada: caras.some((c) => c.status === "loaded"), check: document.fonts.check(`16px "${f}"`) };
  }, familia);
  return { ok: computado.replace(/"/g, "").startsWith(familia) && estado.caras > 0 && estado.cargada && estado.check, computado, estado };
}

async function main() {
  const id = await crearLanding();
  const navegador = await chromium.launch({ channel: "msedge" });
  const errores: string[] = [];
  try {
    const ctx = await navegador.newContext({ viewport: { width: 1280, height: 900 } });
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errores.push(e.message));
    await p.goto(`${BASE}/editor/${id}`);
    await p.locator("[data-tipografias]").scrollIntoViewIfNeeded();
    const titulos = p.locator("[data-selector-tipografia='titulos']");
    const cuerpo = p.locator("[data-selector-tipografia='cuerpo']");
    await titulos.getByRole("button", { name: /Cambiar/ }).click({ timeout: 30_000 });

    // 1) Filas visibles: cada una ya se ve con su letra sin haber pasado el cursor por encima.
    const visibles = await titulos.locator("[data-fuente]").evaluateAll((els) => els.slice(0, 6).map((e) => e.getAttribute("data-fuente")!));
    comprobar(visibles.length === 6, `la lista trae filas (${visibles.join(", ")})`);
    for (const familia of visibles) {
      const fila = titulos.locator(`[data-fuente='${familia}'] span.text-lg`);
      const r = await seVeConSuFuente(p, fila, familia);
      comprobar(r.ok, `fila «${familia}» se ve con su tipografía (${r.computado.slice(0, 40)}, ${JSON.stringify(r.estado)})`);
    }

    // 2) Familias con las que antes fallaba: se buscan, se pasa el cursor y la vista previa las usa.
    for (const familia of ["Cormorant Garamond", "Playfair Display", "Oswald", "Pacifico", "Libre Baskerville"]) {
      await titulos.getByLabel("Buscar por nombre").fill(familia);
      const fila = titulos.locator(`[data-fuente='${familia}']`);
      await p.mouse.move(5, 5);
      await fila.hover();
      const vista = titulos.locator("[data-vista-tipografia] p.text-2xl");
      const r = await seVeConSuFuente(p, vista, familia);
      comprobar(r.ok, `la vista previa muestra «${familia}» con su letra (${r.computado.slice(0, 40)})`);
      comprobar((await titulos.locator("[data-vista-familia]").textContent()) === familia, `la vista previa nombra «${familia}»`);
      const deFila = await seVeConSuFuente(p, fila.locator("span.text-lg"), familia);
      comprobar(deFila.ok, `la fila «${familia}» también`);
    }
    const opciones = await p.locator("#tema-tipografia option").allTextContents();
    comprobar(!opciones.some((t) => /DM Serif Display|Instrument Serif/.test(t)), "los pares sugeridos no usan DM Serif Display ni Instrument Serif");
    comprobar(opciones.length >= 6 && opciones.length <= 9, `pares sugeridos: ${opciones.length} opciones`);
    await titulos.getByLabel("Buscar por nombre").fill("");
    await titulos.getByRole("button", { name: /Cerrar/ }).click();

    // 3) Tres tipografías distintas elegidas, con captura del panel Tema a 1280.
    const elecciones: [string, string][] = [["Playfair Display", "Lato"], ["Cormorant Garamond", "Source Sans 3"], ["Oswald", "Lora"]];
    for (const [i, [t, c]] of elecciones.entries()) {
      await titulos.getByRole("button", { name: /Cambiar/ }).click();
      await titulos.getByLabel("Buscar por nombre").fill(t);
      await titulos.locator(`[data-fuente='${t}']`).click();
      await titulos.getByRole("button", { name: /Cerrar/ }).click();
      await cuerpo.getByRole("button", { name: /Cambiar/ }).click();
      await cuerpo.getByLabel("Buscar por nombre").fill(c);
      await cuerpo.locator(`[data-fuente='${c}']`).click();
      const enPanel = await seVeConSuFuente(p, p.locator("[data-familia-actual='titulos']"), t);
      comprobar(enPanel.ok, `el token de títulos «${t}» se ve en el panel`);
      await p.waitForTimeout(2500);
      await p.locator("[data-tipografias]").scrollIntoViewIfNeeded();
      await p.screenshot({ path: join(SALIDA, `panel-tema-eleccion-${i + 1}-${t.toLowerCase().replace(/\s+/g, "-")}-1280.png`) });
      await cuerpo.getByRole("button", { name: /Cerrar/ }).click();
      const enVista = await p.frameLocator("iframe").locator("link[href*='fonts.googleapis.com/css2']").first().getAttribute("href");
      const param = (n: string) => encodeURIComponent(n).replace(/%20/g, "+");
      comprobar(enVista?.includes(param(t)) && enVista.includes(param(c)), `la vista previa del editor carga ${t} + ${c}`);
    }
  } finally {
    await navegador.close();
  }
  comprobar(errores.length === 0, `sin errores de página ${errores.join(" | ")}`);
  console.log("Fuentes del catálogo 10-B: OK");
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
