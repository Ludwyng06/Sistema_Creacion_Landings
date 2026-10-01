// Aceptación 17-B §2: tamaños de letra en el editor (global en Tema, por sección en Diseño y por bloque con − y + en la
// edición en línea), con vista previa al instante, persistencia al recargar, deshacer, mínimo de 16 px en el cuerpo y sin
// desbordes a 390 px.
// Uso: PUERTO=3116 npx tsx tests/e2e/dia17-tamanos.ts   (capturas en docs/bitacora/capturas/dia17B/)
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type FrameLocator, type Page } from "playwright";
import { combinar } from "@/lib/tecnicas/combinador";
import { landingEjemplo } from "../fixtures/landing-ejemplo";
import { briefCorrector } from "../tecnicas/briefs";

const BASE = `http://localhost:${process.env.PUERTO ?? "3000"}`;
const SALIDA = join(process.cwd(), "..", "docs", "bitacora", "capturas", "dia17B");
mkdirSync(SALIDA, { recursive: true });

function comprobar(condicion: unknown, mensaje: string): asserts condicion {
  if (!condicion) throw new Error(`FALLA: ${mensaje}`);
  console.log(`ok · ${mensaje}`);
}

type Doc = { secciones: { id: string; tipo: string; ajustes: { presentacion?: Record<string, unknown> } }[] };
const leerDoc = async (id: string) => ((await (await fetch(`${BASE}/api/landings/${id}`)).json()) as { doc: Doc }).doc;

async function abrir(p: Page, id: string): Promise<FrameLocator> {
  await p.goto(`${BASE}/editor/${id}`, { waitUntil: "domcontentloaded" });
  const marco = p.frameLocator("iframe[title^='Vista previa']");
  await marco.locator("[data-seccion-id]").first().waitFor({ timeout: 60_000 });
  await p.waitForTimeout(1200);
  return marco;
}

const tamano = (marco: FrameLocator, selector: string) => marco.locator(selector).first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
const guardado = (p: Page) => p.locator('[data-guardado="guardado"]').waitFor({ timeout: 15_000 });

async function main() {
  const doc = structuredClone(landingEjemplo);
  doc.meta.slug = `e2e17-${Date.now()}`;
  doc.meta.nombre = "Tamaños 17-B";
  const r = await fetch(`${BASE}/api/landings`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brief: briefCorrector, tecnicas: ["semilla"], prompt: combinar(briefCorrector, []), doc, proveedor: "manual" }) });
  comprobar(r.status === 201, "landing de prueba creada");
  const { id, slug } = (await r.json()) as { id: string; slug: string };

  const navegador = await chromium.launch({ channel: process.env.E2E_CANAL ?? "msedge" });
  const errores: string[] = [];
  try {
    const ctx = await navegador.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript("window.__name = (f) => f;");
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errores.push(e.message));
    p.on("console", (m) => m.type() === "error" && errores.push(m.text()));
    let marco = await abrir(p, id);

    // ── Global, en el panel Tema ──
    await p.locator("[data-abrir-tema]").click();
    const antesTitulo = await tamano(marco, "h1");
    const antesFaq = await tamano(marco, "[data-tipo='faq'] h2");
    await p.locator("[data-tamano='global-titulos'] [data-paso='XL']").click();
    await p.waitForFunction(() => document.querySelector("iframe") !== null);
    await p.waitForTimeout(600);
    const despuesTitulo = await tamano(marco, "h1");
    const despuesFaq = await tamano(marco, "[data-tipo='faq'] h2");
    comprobar(despuesTitulo > antesTitulo * 1.15 && despuesFaq > antesFaq * 1.15, `el tamaño global de títulos crece en toda la vista (${antesTitulo.toFixed(0)} → ${despuesTitulo.toFixed(0)} px el h1)`);
    await guardado(p);
    await p.waitForTimeout(1500);
    let d = await leerDoc(id);
    comprobar(JSON.stringify(d.secciones[0].ajustes.presentacion).includes('"titulos":"XL"'), "el tamaño global quedó guardado");
    marco = await abrir(p, id);
    comprobar(Math.abs((await tamano(marco, "h1")) - despuesTitulo) < 1, "y persiste al recargar");
    await p.locator("[data-abrir-tema]").click();
    comprobar((await p.locator("[data-tamano='global-titulos'] [data-paso='XL']").getAttribute("aria-pressed")) === "true", "el selector recuerda el paso elegido");
    await p.screenshot({ path: join(SALIDA, "editor-tamano-global-1440.png") });

    // ── Por sección, en Diseño ──
    await p.locator("[data-fila-seccion]", { hasText: "Preguntas" }).getByRole("button", { name: /^Preguntas/ }).click();
    await p.locator("[data-grupo-inspector='diseno'] summary").click();
    const faqAntes = await tamano(marco, "[data-tipo='faq'] h2");
    const ofertaAntes = await tamano(marco, "[data-tipo='oferta'] h2");
    await p.locator("[data-tamanos-seccion] [data-tamano='titular'] [data-paso='XS']").click();
    await p.waitForTimeout(600);
    const faqDespues = await tamano(marco, "[data-tipo='faq'] h2");
    comprobar(faqDespues < faqAntes * 0.75, `el titular de esa sección baja a XS (${faqAntes.toFixed(0)} → ${faqDespues.toFixed(0)} px)`);
    comprobar(Math.abs((await tamano(marco, "[data-tipo='oferta'] h2")) - ofertaAntes) < 1, "las demás secciones no cambian");
    await p.locator("[data-tamanos-seccion] [data-tamano='titular'] [data-paso='heredado']").click();
    await p.waitForTimeout(500);
    comprobar(Math.abs((await tamano(marco, "[data-tipo='faq'] h2")) - faqAntes) < 1, "«Heredado» devuelve el tamaño de la landing");
    await p.getByRole("button", { name: "Seminegrita" }).click();
    await p.waitForTimeout(400);
    comprobar((await marco.locator("[data-tipo='faq'] h2").first().evaluate((el) => getComputedStyle(el).fontWeight)) === "600", "el peso del titular se aplica (600)");

    // ── Por bloque, con − y + en la edición en línea ──
    const h1 = marco.locator("[data-seccion-id] h1").first();
    await h1.scrollIntoViewIfNeeded();
    const base = await tamano(marco, "h1");
    await h1.dblclick();
    await marco.locator("[contenteditable]").first().waitFor({ timeout: 8000 });
    await marco.locator("[data-barra-tamano]").waitFor({ timeout: 5000 });
    comprobar(true, "con el texto en edición aparece la mini barra − y +");
    await marco.locator("[data-tam-mas]").click();
    await marco.locator("[data-tam-mas]").click();
    const subido = await tamano(marco, "h1");
    comprobar(subido > base * 1.15, `«+» agranda ese texto al instante (${base.toFixed(0)} → ${subido.toFixed(0)} px)`);
    comprobar((await marco.locator("[data-tam-mas]").evaluate(() => document.querySelector("[data-editando]") !== null)), "sigue editando (la barra no le quita el foco)");
    await p.keyboard.press("Enter");
    await guardado(p);
    await p.waitForTimeout(1500);
    d = await leerDoc(id);
    comprobar(JSON.stringify(d.secciones[0].ajustes.presentacion).includes('"ajustes.titular":2'), "el paso del bloque quedó guardado (+2)");
    marco = await abrir(p, id);
    comprobar(Math.abs((await tamano(marco, "h1")) - subido) < 1.5, "y persiste al recargar");
    await p.screenshot({ path: join(SALIDA, "editor-tamano-bloque-1440.png") });

    // Deshacer devuelve el tamaño (historial de esta sesión: un paso más y se deshace).
    await marco.locator("[data-seccion-id] h1").first().dblclick();
    await marco.locator("[data-barra-tamano]").waitFor({ timeout: 5000 });
    await marco.locator("[data-tam-mas]").click();
    const otroPaso = await tamano(marco, "h1");
    comprobar(otroPaso > subido * 1.05, "un «+» más agranda otra vez");
    await p.keyboard.press("Enter");
    await p.waitForTimeout(800);
    await p.locator("body").click({ position: { x: 700, y: 5 } });
    await p.keyboard.press("Control+z");
    await p.waitForTimeout(900);
    comprobar(Math.abs((await tamano(marco, "h1")) - subido) < 1.5, "Ctrl+Z deshace el cambio de tamaño");
    await ctx.close();

    // ── Móvil: cuerpo ≥ 16 px y sin desbordes con todo al máximo ──
    const movil = await navegador.newContext({ viewport: { width: 390, height: 844 } });
    await movil.addInitScript("window.__name = (f) => f;");
    const pm = await movil.newPage();
    await pm.goto(`${BASE}/l/${slug}`, { waitUntil: "networkidle" });
    const resumen = await pm.evaluate(() => {
      const raiz = document.querySelector(".landing") as HTMLElement;
      const desbordes = [...document.querySelectorAll("h1, h2, h3")].filter((el) => el.scrollWidth > el.clientWidth + 1 || el.getBoundingClientRect().right > window.innerWidth + 1).map((el) => el.textContent?.slice(0, 40));
      return { cuerpo: parseFloat(getComputedStyle(raiz).fontSize), desbordes, ancho: document.documentElement.scrollWidth <= window.innerWidth };
    });
    comprobar(resumen.cuerpo >= 16, `a 390 px el cuerpo mide ${resumen.cuerpo} px (≥ 16)`);
    comprobar(resumen.desbordes.length === 0 && resumen.ancho, `a 390 px con títulos en XL ningún titular se sale de su contenedor (${resumen.desbordes.join(" | ") || "0"})`);
    await pm.screenshot({ path: join(SALIDA, "landing-tamano-xl-390.png"), fullPage: false });
    await movil.close();
  } finally {
    await navegador.close();
  }
  const graves = errores.filter((e) => !/favicon|Failed to load resource|React DevTools/i.test(e));
  comprobar(graves.length === 0, `sin errores de consola (${graves.slice(0, 1).map((x) => x.slice(0, 300)).join("") || "0"})`);
  console.log("dia17-tamanos: TODO OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
