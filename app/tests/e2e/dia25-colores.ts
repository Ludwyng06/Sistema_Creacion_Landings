// Aceptación tarea 25: cada «Otra semilla» se nota (colores, tipografía, estilo), «Otra paleta» deja la tipografía,
// la marca se puede mantener y todo se deshace. Telescopio (oscuro, con marca) y colágeno (claro).
// Uso: PUERTO=3200 npx tsx tests/e2e/dia25-colores.ts
import { mkdirSync } from "node:fs";
import { chromium, type Page } from "playwright";
import { combinar } from "@/lib/tecnicas/combinador";
import { PALETAS, aplicarColoresMarca, deltaE } from "@/lib/tecnicas/semillas";
import { landingEjemplo } from "../fixtures/landing-ejemplo";
import { briefCorrector } from "../tecnicas/briefs";

const BASE = `http://localhost:${process.env.PUERTO ?? "3200"}`;
const CAPTURAS = "../docs/bitacora/capturas/dia25";
const CLAVES = ["fondo", "superficie", "texto", "textoSuave", "acento", "acentoTexto", "borde"] as const;
type Colores = Record<(typeof CLAVES)[number], string>;

function comprobar(condicion: unknown, mensaje: string): asserts condicion {
  if (!condicion) throw new Error(`FALLA: ${mensaje}`);
  console.log(`ok · ${mensaje}`);
}

async function crear(nombre: string, coloresMarca?: string[]) {
  const brief = { ...briefCorrector, ...(coloresMarca ? { coloresMarca } : {}) };
  const doc = structuredClone(landingEjemplo);
  doc.meta.slug = `e2e-25-${nombre}-${Date.now()}`;
  doc.meta.nombre = nombre;
  if (coloresMarca) doc.tokens = aplicarColoresMarca(doc.tokens, coloresMarca);
  const r = await fetch(`${BASE}/api/landings`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brief, tecnicas: ["semilla"], prompt: combinar(brief, []), doc, proveedor: "manual" }) });
  comprobar(r.status === 201, `${nombre}: landing creada`);
  return ((await r.json()) as { id: string }).id;
}

async function abrirTema(p: Page) {
  const tema = p.locator("[data-panel-tema]");
  if (!(await tema.isVisible())) await p.locator("[data-abrir-tema]").first().click();
  await tema.waitFor({ timeout: 15_000 });
  return tema;
}

async function estado(p: Page) {
  const tema = await abrirTema(p);
  const colores = Object.fromEntries(await Promise.all(CLAVES.map(async (c) => [c, (await tema.locator(`#hex-${c}`).inputValue()).toUpperCase()]))) as Colores;
  const tipografia = ((await tema.locator("[data-tipografias]").textContent()) ?? "").replace(/\s+/g, " ");
  const estilo = ((await tema.locator("[data-semilla-actual]").textContent()) ?? "").trim();
  const contrastes = (await tema.locator("[data-contraste]").allTextContents()).join("|");
  return { colores, tipografia, estilo, contrastes };
}

const tonoDeFondo = (hex: string) => PALETAS.find((x) => x.colores.fondo.toUpperCase() === hex)?.tono;

async function correr(nombre: string, coloresMarca?: string[]) {
  const id = await crear(nombre, coloresMarca);
  const navegador = await chromium.launch({ channel: "msedge" });
  const errores: string[] = [];
  try {
    const ctx = await navegador.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript("window.__name = (f) => f;");
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errores.push(e.message));
    await p.goto(`${BASE}/editor/${id}`, { waitUntil: "domcontentloaded" });
    await p.frameLocator("iframe[title^='Vista previa']").locator("[data-seccion-id]").first().waitFor({ timeout: 60_000 });
    const tema = await abrirTema(p);
    const vistos = [await estado(p)];
    const fotos: Buffer[] = [await p.screenshot()];
    await p.screenshot({ path: `${CAPTURAS}/${nombre}-antes.png` });

    for (let i = 1; i <= 5; i++) {
      await (await abrirTema(p)).getByRole("button", { name: "Otra semilla" }).click();
      await p.waitForTimeout(450);
      const antes = vistos[i - 1];
      const ahora = await estado(p);
      const n = CLAVES.filter((c) => ahora.colores[c] !== antes.colores[c]).length;
      comprobar(n === 7, `${nombre} clic ${i}: cambian los 7 colores (${n})`);
      comprobar(deltaE(ahora.colores.fondo, antes.colores.fondo) >= 20, `${nombre} clic ${i}: fondo con ΔE ≥ 20 (${ahora.colores.fondo})`);
      comprobar(deltaE(ahora.colores.acento, antes.colores.acento) >= 20, `${nombre} clic ${i}: acento con ΔE ≥ 20 (${ahora.colores.acento})`);
      comprobar(ahora.tipografia !== antes.tipografia, `${nombre} clic ${i}: otra tipografía`);
      comprobar(ahora.estilo !== antes.estilo, `${nombre} clic ${i}: otro estilo (${ahora.estilo})`);
      comprobar(/Cumple AA/.test(ahora.contrastes), `${nombre} clic ${i}: el contraste se actualiza (${ahora.contrastes})`);
      vistos.push(ahora);
      fotos.push(await p.screenshot());
    }
    const tonos = vistos.slice(1).map((v) => tonoDeFondo(v.colores.fondo));
    const repetidos = tonos.slice(1).filter((t, i) => t === tonos[i]).length;
    comprobar(repetidos <= 2, `${nombre}: el tono repite ${repetidos} de 4 veces (máximo 2)`);

    // Los 6 estados (antes + 5 clics) lado a lado.
    const hoja = await ctx.newPage();
    await hoja.setViewportSize({ width: 3000, height: 560 });
    await hoja.setContent(`<body style="margin:0;display:flex;gap:6px;background:#888">${fotos.map((f) => `<img style="width:496px" src="data:image/png;base64,${f.toString("base64")}">`).join("")}</body>`);
    await hoja.screenshot({ path: `${CAPTURAS}/${nombre}-5-clics.png` });
    await hoja.close();

    // Deshacer / rehacer: una entrada del historial por clic.
    await p.getByRole("button", { name: /Deshacer/ }).click();
    await p.waitForTimeout(300);
    comprobar(JSON.stringify((await estado(p)).colores) === JSON.stringify(vistos[4].colores), `${nombre}: deshacer devuelve la paleta anterior`);
    await p.getByRole("button", { name: /Rehacer/ }).click();
    await p.waitForTimeout(300);
    comprobar(JSON.stringify((await estado(p)).colores) === JSON.stringify(vistos[5].colores), `${nombre}: rehacer vuelve a la última`);

    // «Otra paleta» no toca la tipografía.
    const t0 = await estado(p);
    await (await abrirTema(p)).getByRole("button", { name: "Otra paleta" }).click();
    await p.waitForTimeout(300);
    const t1 = await estado(p);
    comprobar(t1.colores.fondo !== t0.colores.fondo && t1.tipografia === t0.tipografia, `${nombre}: «Otra paleta» cambia colores y no la tipografía`);

    comprobar((await tema.locator("[data-paleta]").count()) >= 30, `${nombre}: el selector muestra 30 o más paletas`);
    await tema.locator("[data-paleta='noche-ambar']").click();
    await p.waitForTimeout(300);
    const noche = await estado(p);
    comprobar(noche.colores.fondo === "#0B1020" && noche.colores.acento === "#FFB454", `${nombre}: elegir «Noche y ámbar» aplica sus colores`);

    if (coloresMarca) {
      await tema.locator("[data-mantener-marca] input").check();
      await tema.locator("[data-paleta='aurora-verde']").click();
      await p.waitForTimeout(300);
      comprobar((await estado(p)).colores.acento === "#FFB454", `${nombre}: con «Mantener mis colores de marca» el acento sigue en #FFB454`);
      await tema.getByRole("button", { name: "Otra semilla" }).click();
      await p.waitForTimeout(300);
      comprobar((await estado(p)).colores.acento === "#FFB454", `${nombre}: «Otra semilla» con la marca conserva el acento`);
      await p.screenshot({ path: `${CAPTURAS}/${nombre}-con-marca.png` });
    } else {
      comprobar((await tema.locator("[data-mantener-marca]").count()) === 0, `${nombre}: sin colores de marca no hay interruptor`);
    }
    comprobar(errores.length === 0, `${nombre}: sin errores de página ${errores.join(" | ")}`);
    await ctx.close();
  } finally {
    await navegador.close();
  }
}

async function main() {
  mkdirSync(CAPTURAS, { recursive: true });
  await correr("telescopio", ["#ffb454", "#0b1020"]);
  await correr("colageno");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
