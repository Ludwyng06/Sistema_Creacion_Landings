// Aceptación 16-B: /crear de un solo campo contra POST /api/generar.
//  · Por defecto el generador va con proveedores simulados: dentro de la página, `fetch("/api/generar")` responde un flujo
//    NDJSON con la forma real de A (copiada de una corrida verdadera), con pausas, y al final entrega el id de una landing
//    de evento o de divulgación guardada antes con la API real de landings. Así se prueba todo sin gastar cuota.
//  · `REAL=1` usa la API de verdad (hace falta cuota de IA; con la cuota agotada el flujo llega hasta los faltantes y
//    muestra el error del proveedor, y la prueba lo comprueba).
// Uso: PUERTO=3116 npx tsx tests/e2e/dia16-crear.ts   (capturas en docs/bitacora/capturas/dia16B/)
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright";
import type { LandingDoc, Seccion } from "@/lib/contratos";
import { combinar } from "@/lib/tecnicas/combinador";
import { ejemplo as agenda } from "@/secciones/agenda/ejemplo";
import { ejemplos as datosEnVivo } from "@/secciones/dato-en-vivo/ejemplo";
import { ejemplo as lineaTiempo, assets as aLinea } from "@/secciones/linea-tiempo/ejemplo";
import { landingEjemplo } from "../fixtures/landing-ejemplo";
import { briefCorrector } from "../tecnicas/briefs";

const BASE = `http://localhost:${process.env.PUERTO ?? "3000"}`;
const REAL = process.env.REAL === "1";
const SALIDA = join(process.cwd(), "..", "docs", "bitacora", "capturas", "dia16B");
mkdirSync(SALIDA, { recursive: true });

function comprobar(condicion: unknown, mensaje: string): asserts condicion {
  if (!condicion) throw new Error(`FALLA: ${mensaje}`);
  console.log(`ok · ${mensaje}`);
}

async function guardar(nombre: string, extra: Seccion[]): Promise<string> {
  const doc = structuredClone(landingEjemplo) as LandingDoc;
  doc.meta.slug = `e2e16-${nombre}-${Date.now()}`;
  doc.meta.nombre = nombre;
  doc.secciones = [doc.secciones[0], ...extra, ...doc.secciones.slice(1)].map((s, i) => ({ ...s, id: `s${i}`, efectos: [] }));
  doc.assets = [...doc.assets, ...aLinea];
  const r = await fetch(`${BASE}/api/landings`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brief: briefCorrector, tecnicas: ["semilla"], prompt: combinar(briefCorrector, []), doc, proveedor: "manual" }) });
  comprobar(r.status === 201, `landing de prueba «${nombre}» guardada`);
  return ((await r.json()) as { id: string }).id;
}

/** Simula el generador dentro de la página: mismas líneas que emite A, con pausas para poder ver y llenar los faltantes. */
async function simularGenerador(ctx: BrowserContext, guion: { faltantes: { clave: string; pregunta: string }[]; tipo: string; ids: string[] }) {
  await ctx.addInitScript((g) => {
    const original = window.fetch.bind(window);
    let llamadas = 0;
    (window as unknown as { __encargos: unknown[] }).__encargos = [];
    window.fetch = async (url, init) => {
      if (String(url) !== "/api/generar") return original(url, init);
      (window as unknown as { __encargos: unknown[] }).__encargos.push(JSON.parse(String(init?.body)));
      const id = g.ids[Math.min(llamadas++, g.ids.length - 1)];
      const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));
      const c = new TextEncoder();
      return new Response(
        new ReadableStream({
          async start(ctl) {
            const linea = (e: unknown) => ctl.enqueue(c.encode(`${JSON.stringify(e)}\n`));
            linea({ tipo: "etapa", etapa: "intake", mensaje: "Entendiendo tu idea…" });
            await pausa(500);
            if (llamadas === 1) linea({ tipo: "faltantes", faltantes: g.faltantes, detectado: { tipo: g.tipo, tematica: "espacio" } });
            linea({ tipo: "etapa", etapa: "fuentes", mensaje: "Buscando datos e imágenes…" });
            await pausa(600);
            linea({ tipo: "etapa", etapa: "estrategia", mensaje: "Definiendo la estrategia…" });
            await pausa(600);
            for (let n = 1; n <= 9; n++) {
              linea({ tipo: "etapa", etapa: "redaccion", mensaje: `Escribiendo sección ${n}/9…`, n, total: 9 });
              await pausa(llamadas === 1 ? 700 : 100);
            }
            linea({ tipo: "etapa", etapa: "critico", mensaje: "Revisando como director creativo…" });
            await pausa(500);
            linea({ tipo: "listo", id });
            ctl.close();
          },
        }),
        { headers: { "Content-Type": "application/x-ndjson" } },
      );
    };
  }, guion);
}

async function crear(p: Page, ejemplo: string, ancho: number, llenar?: { clave: string; valor: string }) {
  await p.goto(`${BASE}/crear`, { waitUntil: "networkidle" });
  await p.locator(`[data-ejemplo='${ejemplo}']`).click();
  if (ancho === 1440 && ejemplo === "meteoros") await p.screenshot({ path: join(SALIDA, `crear-${ancho}.png`), fullPage: true });
  await p.getByRole("button", { name: "Crear mi landing" }).click();
  await p.locator("[data-progreso]").waitFor();
  comprobar(true, `${ejemplo}: aparece el progreso narrado`);
  await p.locator("[data-etapa='intake']").waitFor();
  if (llenar) {
    const campo = REAL ? p.locator("[data-faltante]").first() : p.locator(`[data-faltante='${llenar.clave}']`);
    // Con la API real, si el intake ya falló por cuota no hay chips: sale el error (se comprueba abajo).
    const hayChip = await Promise.race([campo.waitFor({ timeout: 90_000 }).then(() => true), p.locator("[data-progreso] [role=alert]").first().waitFor({ timeout: 90_000 }).then(() => false)]);
    if (REAL && !hayChip) {
      comprobar(await p.getByRole("button", { name: "Volver y reintentar" }).isVisible(), `${ejemplo}: sin cuota el error se muestra con salida`);
      return null;
    }
    comprobar(true, `${ejemplo}: el faltante sale como chip`);
    if (!REAL) {
      await p.locator("[data-mensaje]", { hasText: /Escribiendo sección/ }).waitFor({ timeout: 15_000 });
      comprobar(true, `${ejemplo}: se narra «Escribiendo sección x/n…»`);
    }
    await campo.fill(llenar.valor);
    await p.screenshot({ path: join(SALIDA, `progreso-${ancho}.png`) });
  }
  if (REAL) {
    // Con cuota agotada el flujo termina en un error legible con salida; con cuota abre el visor.
    await Promise.race([p.waitForURL(/\/ver\/[^/]+/, { timeout: 240_000 }), p.locator("[data-progreso] [role=alert]").first().waitFor({ timeout: 240_000 })]);
    if (!/\/ver\//.test(p.url())) {
      comprobar(await p.getByRole("button", { name: "Volver y reintentar" }).isVisible(), `${ejemplo}: sin cuota, el error se muestra con salida (${(await p.locator("[data-progreso] [role=alert]").first().textContent())?.slice(0, 80)})`);
      return null;
    }
  } else {
    await p.waitForURL(/\/ver\/[^/]+/, { timeout: 90_000 });
  }
  comprobar(true, `${ejemplo}: al terminar abre el visor`);
  await p.locator("iframe").waitFor();
  return p.url().split("/ver/")[1].split("?")[0];
}

async function main() {
  const idEvento = REAL ? "" : await guardar("evento", [agenda, datosEnVivo["cuenta-regresiva-lanzamiento"]]);
  const idEventoConDato = REAL ? "" : await guardar("evento-con-dato", [agenda, datosEnVivo["cuenta-regresiva-lanzamiento"]]);
  const idDivulgacion = REAL ? "" : await guardar("divulgacion", [datosEnVivo.iss, lineaTiempo]);
  const navegador = await chromium.launch({ channel: process.env.E2E_CANAL ?? "msedge" });
  const errores: string[] = [];
  try {
    for (const [ancho, alto] of [[1440, 900], [390, 844]] as const) {
      const ctx = await navegador.newContext({ viewport: { width: ancho, height: alto } });
      await ctx.addInitScript("window.__name = (f) => f;");
      const p = await ctx.newPage();
      p.on("pageerror", (e) => errores.push(e.message));
      p.on("console", (m) => m.type() === "error" && errores.push(m.text()));

      await p.goto(`${BASE}/crear`, { waitUntil: "networkidle" });
      comprobar((await p.locator("[data-ejemplo]").count()) === 6, `@${ancho} hay 6 ejemplos pulsables`);
      comprobar((await p.getByRole("group", { name: "Tipo" }).getByRole("button", { name: "Auto" }).getAttribute("aria-pressed")) === "true", `@${ancho} el tipo está en Auto`);
      comprobar(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `@${ancho} sin scroll horizontal`);
      await p.getByText("Ajustes avanzados").click();
      comprobar(await p.locator("[data-avanzados]").evaluate((el) => (el as HTMLDetailsElement).open), `@${ancho} los ajustes avanzados se despliegan`);

      if (!REAL) await simularGenerador(ctx, { faltantes: [{ clave: "fecha", pregunta: "¿Qué fecha?" }, { clave: "whatsapp", pregunta: "¿Cuál es tu WhatsApp?" }], tipo: "evento", ids: [idEvento, idEventoConDato] });
      const id1 = await crear(p, "meteoros", ancho, { clave: "fecha", valor: "14 de octubre" });
      if (id1) {
        if (!REAL) {
          const encargos = await p.evaluate(() => (window as unknown as { __encargos: { datos?: Record<string, string> }[] }).__encargos);
          comprobar(encargos.length === 2 && encargos[1].datos?.fecha === "14 de octubre", `@${ancho} el dato llenado se mandó en un segundo encargo`);
          comprobar(id1 === idEventoConDato, `@${ancho} se abre la landing regenerada con ese dato`);
        }
        if (ancho === 1440) await p.screenshot({ path: join(SALIDA, `visor-evento-${ancho}.png`) });
        comprobar((await p.getByRole("link", { name: /Editar/ }).getAttribute("href")) === `/editor/${id1}`, `@${ancho} el visor ofrece Editar`);
      }

      if (!REAL) {
        await ctx.close();
        const ctx2 = await navegador.newContext({ viewport: { width: ancho, height: alto } });
        await ctx2.addInitScript("window.__name = (f) => f;");
        await simularGenerador(ctx2, { faltantes: [{ clave: "fuente", pregunta: "¿Quieres citar una fuente propia?" }], tipo: "divulgacion", ids: [idDivulgacion] });
        const p2 = await ctx2.newPage();
        p2.on("pageerror", (e) => errores.push(e.message));
        const id2 = await crear(p2, "iss", ancho);
        const div = (await (await fetch(`${BASE}/api/landings/${id2}`)).json()) as { doc: { secciones: { tipo: string; variante?: string }[] } };
        comprobar(div.doc.secciones.some((s) => s.tipo === "dato-en-vivo" && s.variante === "iss"), `@${ancho} la divulgación trae la ISS en vivo`);
        comprobar(div.doc.secciones.some((s) => s.tipo === "linea-tiempo"), `@${ancho} y una línea de tiempo`);
        await ctx2.close();
      } else {
        await ctx.close();
      }
    }
  } finally {
    await navegador.close();
  }
  const graves = errores.filter((e) => !/favicon|Failed to load resource|React DevTools|api\/vivo/i.test(e));
  comprobar(graves.length === 0, `sin errores de consola (${graves.slice(0, 1).map((x) => x.slice(0, 300)).join("") || "0"})`);
  console.log("dia16-crear: TODO OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
