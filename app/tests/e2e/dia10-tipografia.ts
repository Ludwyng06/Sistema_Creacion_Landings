// Aceptación 10-B: selector de tipografía del panel Tema (elegir → PATCH → persiste al recargar) y landing pública con solo 2 familias.
// Uso: PUERTO=3109 npx tsx tests/e2e/dia10-tipografia.ts   (con el servidor encendido; capturas en docs/bitacora/capturas/dia10B/)
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright";
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

async function crearLanding(): Promise<{ id: string; slug: string }> {
  const doc = structuredClone(landingEjemplo);
  doc.meta.slug = `e2e-tipo-${Date.now()}`;
  doc.meta.nombre = "Prueba tipografía 10-B";
  const r = await fetch(`${BASE}/api/landings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ brief: briefCorrector, tecnicas: ["semilla"], prompt: combinar(briefCorrector, []), doc, proveedor: "manual" }),
  });
  comprobar(r.status === 201, `POST /api/landings → 201 (fue ${r.status})`);
  return (await r.json()) as { id: string; slug: string };
}

const esperarGuardado = (p: Page) => p.locator('[data-guardado="guardado"]').waitFor({ timeout: 10_000 });

async function abrirTema(p: Page, movil: boolean) {
  await p.goto(`${BASE}/editor/${(globalThis as { ID?: string }).ID}`);
  if (movil) await p.getByRole("tab", { name: "Secciones" }).click();
  await p.locator("[data-tipografias]").scrollIntoViewIfNeeded();
}

async function main() {
  const { id, slug } = await crearLanding();
  (globalThis as { ID?: string }).ID = id;
  const navegador = await chromium.launch({ channel: "msedge" });
  const errores: string[] = [];
  try {
    for (const [ancho, alto, movil] of [[1280, 900, false], [390, 844, true]] as const) {
      const ctx = await navegador.newContext({ viewport: { width: ancho, height: alto } });
      const p = await ctx.newPage();
      p.on("pageerror", (e) => errores.push(e.message));
      await abrirTema(p, movil);

      const titulos = p.locator("[data-selector-tipografia='titulos']");
      await titulos.getByRole("button", { name: /Cambiar/ }).click({ timeout: 30_000 });
      await titulos.getByLabel("Buscar por nombre").fill("playfair display");
      await p.waitForFunction(() => document.querySelectorAll("[data-selector-tipografia=titulos] [data-fuente]").length === 1, null, { timeout: 5000 }).catch(() => {});
      comprobar((await titulos.locator("[data-fuente]").count()) === 1, `@${ancho} la búsqueda deja una sola fuente`);
      await titulos.getByLabel("Buscar por nombre").fill("");
      await titulos.getByRole("button", { name: "Serif", exact: true }).click();
      await titulos.locator("[data-fuente='Playfair Display']").hover();
      comprobar((await titulos.locator("[data-vista-familia]").textContent()) === "Playfair Display", `@${ancho} la vista previa sigue al cursor`);
      comprobar(((await titulos.locator("[data-vista-tipografia]").textContent()) ?? "").includes("Ñandú"), `@${ancho} la vista previa trae la frase con ñ`);
      await p.waitForFunction(() => document.fonts.check('16px "Playfair Display"'), null, { timeout: 15_000 }).catch(() => {});
      await titulos.scrollIntoViewIfNeeded();
      await p.screenshot({ path: join(SALIDA, `panel-tema-${ancho}.png`) });

      await titulos.locator("[data-fuente='Playfair Display']").click();
      await p.waitForTimeout(1500);
      const cuerpo = p.locator("[data-selector-tipografia='cuerpo']");
      await cuerpo.getByRole("button", { name: /Cambiar/ }).click();
      await cuerpo.locator("[data-fuente='Lato']").click();
      await esperarGuardado(p);
      type Guardado = { doc: { tokens: { tipografia: { titulos: string; cuerpo: string } } } };
      let guardado = (await (await fetch(`${BASE}/api/landings/${id}`)).json()) as Guardado;
      for (let i = 0; i < 20 && guardado.doc.tokens.tipografia.cuerpo !== "Lato"; i++) {
        await p.waitForTimeout(500);
        guardado = (await (await fetch(`${BASE}/api/landings/${id}`)).json()) as Guardado;
      }
      comprobar(guardado.doc.tokens.tipografia.titulos === "Playfair Display" && guardado.doc.tokens.tipografia.cuerpo === "Lato", `@${ancho} el PATCH guardó Playfair Display + Lato`);

      await abrirTema(p, movil);
      comprobar(((await p.locator("[data-familia-actual='titulos']").textContent()) ?? "").includes("Playfair Display"), `@${ancho} la elección persiste al recargar`);
      const enVista = await p.frameLocator("iframe").locator("link[href*='fonts.googleapis.com/css2']").first().getAttribute("href");
      comprobar(enVista?.includes("Playfair+Display") && enVista.includes("Lato"), `@${ancho} la vista previa del editor carga las dos familias`);

      // Volver a la semilla.
      const volver = p.getByRole("button", { name: "Volver a la tipografía de la semilla" });
      comprobar(await volver.isEnabled(), `@${ancho} «Volver a la tipografía de la semilla» se activa`);
      await volver.click();
      await p.waitForTimeout(2500);
      comprobar(((await p.locator("[data-familia-actual='titulos']").textContent()) ?? "").includes("Space Grotesk"), `@${ancho} volver a la semilla restaura Space Grotesk`);
      await ctx.close();

      // Para el siguiente ancho y la landing pública, se deja elegida otra vez.
      if (ancho === 1280) {
        const doc = structuredClone(landingEjemplo);
        doc.meta.slug = slug;
        doc.tokens.tipografia = { ...doc.tokens.tipografia, titulos: "Playfair Display", cuerpo: "Lato" };
        const r = await fetch(`${BASE}/api/landings/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ doc }) });
        comprobar(r.ok, "PATCH deja Playfair Display + Lato para la página pública");
        const publico = await navegador.newContext({ viewport: { width: 390, height: 844 } });
        const pp = await publico.newPage();
        const peticiones: string[] = [];
        pp.on("request", (q) => q.url().includes("fonts.googleapis.com") && peticiones.push(q.url()));
        await pp.goto(`${BASE}/l/${slug}`, { waitUntil: "load" });
        const hojas = await pp.locator("link[href*='fonts.googleapis.com/css2']").evaluateAll((els) => els.map((e) => e.getAttribute("href") ?? ""));
        comprobar(hojas.length === 1, `/l pide una sola hoja de Google Fonts (fueron ${hojas.length})`);
        comprobar((hojas[0].match(/family=/g) ?? []).length === 2, "esa hoja trae solo 2 familias");
        comprobar(hojas[0].includes("display=swap"), "con display=swap");
        comprobar((await pp.locator("link[rel=preconnect][href*='fonts.gstatic.com']").count()) >= 1, "con preconnect a fonts.gstatic.com");
        await publico.close();
      }
    }
  } finally {
    await navegador.close();
  }
  comprobar(errores.length === 0, `sin errores de página ${errores.join(" | ")}`);
  console.log("Tipografía 10-B: OK");
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
