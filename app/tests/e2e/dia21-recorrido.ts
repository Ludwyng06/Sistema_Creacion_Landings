// Recorrido de la demo (docs/demo.md) contra `next start`, como lo haría Jenser, a 1440 y a 390 px:
// home, crear (rápido y experto), editor, visor, banco, detalle del banco, técnicas, ajustes y la landing pública.
// Por cada pantalla guarda una captura y revisa: desborde horizontal, textos cortados, imágenes rotas, errores de consola,
// foco visible al tabular y botones o enlaces sin nombre. Imprime una tabla de hallazgos.
// Uso: PUERTO=3115 ETAPA=antes npx tsx tests/e2e/dia21-recorrido.ts   (capturas en capturas/dia21B/<etapa>/)
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright";

const BASE = `http://localhost:${process.env.PUERTO ?? "3000"}`;
const ETAPA = process.env.ETAPA ?? "antes";
const SALIDA = join(process.cwd(), "..", "docs", "bitacora", "capturas", "dia21B", ETAPA);
mkdirSync(SALIDA, { recursive: true });

interface Hallazgo {
  pantalla: string;
  ancho: number;
  problema: string;
}
const hallazgos: Hallazgo[] = [];

async function revisar(p: Page, pantalla: string, ancho: number) {
  const r = await p.evaluate(() => {
    const visible = (e: Element) => {
      const c = e.getBoundingClientRect();
      const s = getComputedStyle(e);
      return c.width > 0 && c.height > 0 && s.visibility !== "hidden" && s.display !== "none";
    };
    const desborde = document.documentElement.scrollWidth > window.innerWidth + 1 ? `scroll horizontal (${document.documentElement.scrollWidth} px > ${window.innerWidth} px)` : null;
    // Texto cortado: elementos con overflow oculto cuyo contenido es más ancho o alto que la caja (sin `truncate` a propósito).
    const cortados = [...document.querySelectorAll<HTMLElement>("h1, h2, h3, p, button, a, label, span, li")]
      .filter((e) => visible(e) && e.getBoundingClientRect().width > 1 && !e.closest(".sr-only, [hidden]") && e.children.length === 0 && (e.textContent ?? "").trim().length > 2)
      .filter((e) => {
        const s = getComputedStyle(e);
        const oculto = s.overflowX === "hidden" || s.overflowY === "hidden";
        const intencional = s.textOverflow === "ellipsis" || s.webkitLineClamp !== "none" && s.webkitLineClamp !== "";
        return oculto && !intencional && (e.scrollWidth > e.clientWidth + 2 || e.scrollHeight > e.clientHeight + 2);
      })
      .slice(0, 5)
      .map((e) => (e.textContent ?? "").trim().slice(0, 40));
    const fueraDePantalla = [...document.querySelectorAll<HTMLElement>("h1, h2, button, a")]
      .filter((e) => visible(e) && !e.closest("[hidden], [aria-hidden='true'], .sr-only, iframe") && e.getBoundingClientRect().right > window.innerWidth + 2)
      .slice(0, 4)
      .map((e) => (e.textContent ?? "").trim().slice(0, 30));
    const imagenesRotas = [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.currentSrc).map((i) => i.currentSrc.slice(-50));
    const sinNombre = [...document.querySelectorAll<HTMLElement>("button, a[href], input, select, textarea")]
      .filter((e) => visible(e) && !e.closest("[aria-hidden='true']"))
      .filter((e) => {
        const nombre = (e.getAttribute("aria-label") ?? "") + (e.getAttribute("aria-labelledby") ? "x" : "") + (e.textContent ?? "").trim() + ((e as HTMLInputElement).labels?.[0]?.textContent ?? "") + (e.getAttribute("title") ?? "") + ((e as HTMLInputElement).placeholder ?? "") + (e.querySelector("img[alt]:not([alt=''])") ? "x" : "");
        return nombre.trim().length === 0;
      })
      .slice(0, 4)
      .map((e) => e.outerHTML.slice(0, 70));
    const pequenos = [...document.querySelectorAll<HTMLElement>("button, a[href], [role=button]")]
      .filter((e) => visible(e) && !e.closest("[aria-hidden='true'], iframe, .sr-only") && e.getBoundingClientRect().height < 24 && e.getBoundingClientRect().width < 24)
      .slice(0, 3)
      .map((e) => e.outerHTML.slice(0, 60));
    return { desborde, cortados, fueraDePantalla, imagenesRotas, sinNombre, pequenos };
  });
  const anota = (problema: string) => hallazgos.push({ pantalla, ancho, problema });
  if (r.desborde) anota(r.desborde);
  if (r.cortados.length) anota(`texto cortado: ${r.cortados.join(" | ")}`);
  if (r.fueraDePantalla.length) anota(`fuera de pantalla: ${r.fueraDePantalla.join(" | ")}`);
  if (r.imagenesRotas.length) anota(`imagen rota: ${r.imagenesRotas.join(" | ")}`);
  if (r.sinNombre.length) anota(`sin nombre accesible: ${r.sinNombre.join(" | ")}`);
  if (r.pequenos.length) anota(`objetivo táctil menor de 24 px: ${r.pequenos.join(" | ")}`);

  // Foco visible: se tabula unas veces y cada elemento enfocado debe mostrar un contorno o anillo.
  const sinFoco: string[] = [];
  await p.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  for (let i = 0; i < 8; i++) {
    await p.keyboard.press("Tab");
    const f = await p.evaluate(() => {
      const e = document.activeElement as HTMLElement | null;
      if (!e || e === document.body) return null;
      const s = getComputedStyle(e);
      const contorno = s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0;
      const sombra = s.boxShadow !== "none";
      return { tag: e.tagName.toLowerCase(), texto: (e.getAttribute("aria-label") ?? e.textContent ?? "").trim().slice(0, 30), ok: contorno || sombra };
    });
    if (f && !f.ok) sinFoco.push(`${f.tag} «${f.texto}»`);
  }
  if (sinFoco.length) anota(`sin foco visible: ${[...new Set(sinFoco)].join(" | ")}`);
}

async function main() {
  const lista = ((await (await fetch(`${BASE}/api/landings`)).json()) as { landings: { id: string; slug: string; estado: string; nombre: string }[] }).landings;
  const banco = lista.find((l) => l.slug === "kit-cohete-educativo") ?? lista.find((l) => l.estado === "en-banco")!;
  console.log(`landing de prueba: ${banco.slug} (${banco.id})`);

  const navegador = await chromium.launch({ channel: process.env.E2E_CANAL ?? "msedge" });
  const errores: { pantalla: string; texto: string }[] = [];
  try {
    for (const [ancho, alto] of [[1440, 900], [390, 844]] as const) {
      const ctx = await navegador.newContext({ viewport: { width: ancho, height: alto } });
      await ctx.addInitScript("window.__name = (f) => f;");
      const p = await ctx.newPage();
      let actual = "";
      p.on("pageerror", (e) => errores.push({ pantalla: `${actual}@${ancho}`, texto: e.message }));
      p.on("console", (m) => m.type() === "error" && !/favicon|Failed to load resource/i.test(m.text()) && errores.push({ pantalla: `${actual}@${ancho}`, texto: m.text().slice(0, 160) }));

      const ir = async (nombre: string, ruta: string, preparar?: () => Promise<void>, espera = 1500) => {
        actual = nombre;
        await p.goto(`${BASE}${ruta}`, { waitUntil: "load", timeout: 90_000 });
        await p.waitForTimeout(espera);
        if (preparar) await preparar();
        await p.screenshot({ path: join(SALIDA, `${nombre}-${ancho}.png`), fullPage: nombre === "home" || nombre === "tecnicas" ? false : false });
        await revisar(p, nombre, ancho);
      };

      await ir("home", "/");
      await ir("crear", "/crear");
      await ir("crear-error", "/crear", async () => {
        await p.getByRole("button", { name: "Crear mi landing" }).click();
        await p.waitForTimeout(500);
      });
      await ir("crear-experto", "/crear?modo=experto");
      await ir("tecnicas", "/tecnicas");
      await ir("ajustes", "/ajustes", undefined, 2500);
      await ir("banco", "/banco", undefined, 2500);
      await ir("banco-detalle", `/banco/${banco.id}`, undefined, 2500);
      await ir("visor", `/ver/${banco.id}`, undefined, 3000);
      await ir("visor-entrega", `/ver/${banco.id}?entrega=1`, undefined, 3000);
      await ir("editor", `/editor/${banco.id}`, undefined, 4000);
      await ir("landing", `/l/${banco.slug}`, undefined, 2500);
      await ir("no-existe", "/ver/no-existe");
      await ir("banco-no-existe", "/banco/no-existe");
      await ctx.close();
    }
  } finally {
    await navegador.close();
  }
  console.log("\n── Hallazgos ──");
  if (hallazgos.length === 0) console.log("ninguno");
  for (const h of hallazgos) console.log(`${h.pantalla} @${h.ancho}: ${h.problema}`);
  console.log("\n── Errores de consola ──");
  if (errores.length === 0) console.log("ninguno");
  for (const e of errores) console.log(`${e.pantalla}: ${e.texto}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
