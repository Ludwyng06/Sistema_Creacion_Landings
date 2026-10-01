// Aceptación 20-B · entrega: visor con panel inferior (copiar link, descargar HTML, qué mejoró el revisor, datos por completar),
// lista de revisión que bloquea solo lo crítico y acciones de IA del inspector (con la IA simulada en el navegador).
//  · Descargar HTML: se baja el archivo y se abre con file:// sin JavaScript y con todas las peticiones de red abortadas
//    (como sin servidor): debe verse la landing con su CSS en línea.
//  · IA simulada: `regenerar-seccion` se intercepta y responde con la forma del contrato de A (la landing completa con solo
//    esa sección cambiada, conservando lo editado a mano).
// Uso: PUERTO=3115 npx tsx tests/e2e/dia20-entrega.ts   (capturas en docs/bitacora/capturas/dia20B/)
import { mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Page } from "playwright";
import { combinar } from "@/lib/tecnicas/combinador";
import type { LandingDoc } from "@/lib/contratos";
import { landingEjemplo } from "../fixtures/landing-ejemplo";
import { briefCorrector } from "../tecnicas/briefs";

const BASE = `http://localhost:${process.env.PUERTO ?? "3000"}`;
const SALIDA = join(process.cwd(), "..", "docs", "bitacora", "capturas", "dia20B");
mkdirSync(SALIDA, { recursive: true });

function comprobar(condicion: unknown, mensaje: string): asserts condicion {
  if (!condicion) throw new Error(`FALLA: ${mensaje}`);
  console.log(`ok · ${mensaje}`);
}

async function crear(nombre: string, cambiar?: (doc: LandingDoc) => void): Promise<{ id: string; slug: string; doc: LandingDoc }> {
  const doc = structuredClone(landingEjemplo);
  doc.meta.slug = `e2e20-${nombre}-${Date.now()}`;
  doc.meta.nombre = `Entrega ${nombre}`;
  doc.critica = { puntaje: 8.4, porCriterio: [{ criterio: "Claridad", puntaje: 8.5, evidencia: "El titular dice qué es." }], problemas: ["El pie era largo"], correcciones: ["Se acortó el pie de página", "El botón ahora empieza con un verbo"] };
  cambiar?.(doc);
  const r = await fetch(`${BASE}/api/landings`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brief: briefCorrector, tecnicas: ["semilla"], prompt: combinar(briefCorrector, []), doc, proveedor: "manual" }) });
  comprobar(r.status === 201, `landing «${nombre}» creada`);
  const { id, slug } = (await r.json()) as { id: string; slug: string };
  return { id, slug, doc };
}

const estadoDe = async (id: string) => ((await (await fetch(`${BASE}/api/landings/${id}`)).json()) as { estado: string }).estado;

async function abrirVisor(p: Page, id: string, extra = "") {
  await p.goto(`${BASE}/ver/${id}?dispositivo=movil${extra}`, { waitUntil: "load" });
  await p.locator("[data-panel-entrega]").waitFor({ timeout: 30_000 });
  await p.waitForTimeout(1200); // hidratación
}

async function main() {
  const buena = await crear("buena");
  const bloqueada = await crear("bloqueada", (d) => {
    d.secciones[0].ajustes.titular = "[COMPLETAR]";
  });
  const navegador = await chromium.launch({ channel: process.env.E2E_CANAL ?? "msedge" });
  const errores: string[] = [];
  try {
    // ── Visor: panel inferior ──
    const ctx = await navegador.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, permissions: ["clipboard-read", "clipboard-write"] });
    await ctx.addInitScript("window.__name = (f) => f;");
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errores.push(e.message));
    await abrirVisor(p, buena.id);
    comprobar((await p.locator("#panel-entrega-detalles").count()) === 0, "el panel arranca plegado: solo las acciones");
    await p.getByRole("button", { name: "Copiar link" }).click();
    await p.locator("[data-aviso-entrega]", { hasText: "Link copiado" }).waitFor();
    comprobar((await p.evaluate(() => navigator.clipboard.readText())) === `${BASE}/l/${buena.slug}`, "Copiar link deja /l/slug en el portapapeles");

    await p.locator("[data-entrega-alternar]").click();
    await p.locator("[data-mejoras]").waitFor();
    comprobar((await p.locator("[data-mejoras] li").count()) === 2, "Qué mejoró el revisor muestra las 2 correcciones del informe");
    const enlaces = await p.locator("[data-por-completar] a").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
    comprobar(enlaces.length === 3 && enlaces.every((h) => h === `/editor/${buena.id}?seccion=sec-faq`), "Datos por completar lista los 3 [COMPLETAR] con enlace a su sección del editor");
    comprobar((await p.locator("[data-revision]").count()) === 6, "la lista de revisión trae sus 6 puntos");
    await p.screenshot({ path: join(SALIDA, "visor-entrega-1440.png") });

    // El enlace lleva al editor con la sección ya seleccionada.
    await p.locator("[data-por-completar] a").first().click();
    await p.waitForURL(/\/editor\//);
    await p.locator(`[data-inspector-seccion="sec-faq"]`).waitFor({ timeout: 30_000 });
    comprobar(true, "el enlace abre el editor con «Preguntas» seleccionada");

    // ── Descargar HTML ──
    await abrirVisor(p, buena.id);
    const [descarga] = await Promise.all([p.waitForEvent("download"), p.locator("[data-descargar-html]").click()]);
    comprobar(descarga.suggestedFilename() === `${buena.slug}.html`, `el archivo se llama ${descarga.suggestedFilename()}`);
    const ruta = join(tmpdir(), descarga.suggestedFilename());
    await descarga.saveAs(ruta);
    const html = readFileSync(ruta, "utf8");
    console.log(`   archivo: ${(Buffer.byteLength(html) / 1024).toFixed(0)} KB`);
    comprobar(!/<script/i.test(html), "el HTML no lleva JavaScript");
    comprobar(/<style>/.test(html) && !/<link[^>]+rel="stylesheet"[^>]+_next/.test(html), "el CSS va en línea");
    comprobar(/fonts\.googleapis\.com/.test(html), "las fuentes van por link a Google Fonts");
    comprobar(!/(src|href)="\/[^/]/.test(html) && !/_next\/image/.test(html), "no quedan rutas relativas ni del optimizador: todo es absoluto");
    comprobar(html.includes("¿Terminas el día con la espalda cargada?"), "trae el texto de la landing ya renderizado");

    // Se abre como archivo, sin JavaScript y sin red (como sin servidor): debe verse la landing con su CSS.
    const sinServidor = await navegador.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
    await sinServidor.route("**/*", (r) => (r.request().url().startsWith("file:") ? r.continue() : r.abort()));
    const f = await sinServidor.newPage();
    await f.goto(`file:///${ruta.replace(/\\/g, "/")}`, { waitUntil: "load" });
    const h1 = f.locator("h1").first();
    await h1.waitFor();
    const medidas = await f.evaluate(() => {
      const h = document.querySelector("h1")!;
      const r = h.getBoundingClientRect();
      return { tamano: parseFloat(getComputedStyle(h).fontSize), visible: r.width > 100 && r.height > 20, alto: document.body.scrollHeight, secciones: document.querySelectorAll("[data-seccion-id]").length, desborde: document.documentElement.scrollWidth > window.innerWidth };
    });
    comprobar(medidas.visible && medidas.tamano > 24, `sin servidor ni JavaScript se ve el titular con su estilo (${medidas.tamano.toFixed(0)} px)`);
    comprobar(medidas.secciones >= 5 && medidas.alto > 2000 && !medidas.desborde, `y la landing completa (${medidas.secciones} secciones, ${medidas.alto} px de alto, sin desborde)`);
    await f.waitForTimeout(2200); // deja terminar las animaciones de entrada de CSS
    comprobar((await h1.evaluate((e) => Number(getComputedStyle(e).opacity))) >= 0.99, "y al terminar la entrada el titular está opaco");
    await f.screenshot({ path: join(SALIDA, "html-descargado-sin-servidor-390.png") });
    await sinServidor.close();

    // ── Lista de revisión ──
    await abrirVisor(p, bloqueada.id);
    await p.locator("[data-guardar-banco]").click();
    const modal = p.locator("[data-modal-revision]");
    await modal.waitFor();
    comprobar(await p.locator("[data-confirmar-revision]").isDisabled(), "con [COMPLETAR] en el héroe el botón de guardar queda bloqueado");
    comprobar((await p.locator('[data-revision="completar"]').getAttribute("data-estado")) === "bloquea", "y el punto «Datos por completar» marca que bloquea");
    await p.screenshot({ path: join(SALIDA, "revision-bloqueada-1440.png") });
    comprobar((await estadoDe(bloqueada.id)) === "borrador", "la landing no pasó al banco");
    await p.locator('[data-corregir="completar"]').click();
    await p.waitForURL(/\/editor\//);
    await p.locator(`[data-inspector-seccion="sec-heroe"]`).waitFor({ timeout: 30_000 });
    comprobar(true, "«Corregir» lleva al héroe en el editor");

    // En el editor también aparece antes de guardar, y lo que solo avisa no bloquea.
    await p.getByRole("button", { name: "Guardar en banco" }).click();
    await modal.waitFor();
    comprobar(await p.locator("[data-confirmar-revision]").isDisabled(), "el editor muestra la misma lista y también bloquea");
    await p.keyboard.press("Escape");

    await abrirVisor(p, buena.id);
    await p.locator("[data-guardar-banco]").click();
    await modal.waitFor();
    comprobar((await p.locator('[data-revision="completar"]').getAttribute("data-estado")) === "aviso", "el [COMPLETAR] de las preguntas solo avisa");
    comprobar(!(await p.locator("[data-confirmar-revision]").isDisabled()), "y deja guardar");
    await p.screenshot({ path: join(SALIDA, "revision-con-avisos-1440.png") });
    await p.locator("[data-confirmar-revision]").click();
    await p.locator("[data-aviso-entrega]", { hasText: "Guardada en el banco" }).waitFor();
    comprobar((await estadoDe(buena.id)) === "en-banco", "la landing pasó al banco");

    // ── Visor a 390 ──
    const movil = await navegador.newContext({ viewport: { width: 390, height: 844 } });
    await movil.addInitScript("window.__name = (f) => f;");
    const m = await movil.newPage();
    await abrirVisor(m, buena.id, "&entrega=1");
    await m.locator("[data-mejoras]").waitFor();
    comprobar(await m.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "el panel de entrega a 390 px no desborda");
    await m.screenshot({ path: join(SALIDA, "visor-entrega-390.png") });
    await movil.close();

    // ── Editor: acciones de IA (simuladas) ──
    const peticiones: { seccionId: string; instruccion?: string }[] = [];
    const titularOriginal = landingEjemplo.secciones[0].ajustes.titular as string;
    const titularCorto = "¿Espalda cargada?";
    await p.route("**/api/landings/*/regenerar-seccion", async (ruta) => {
      peticiones.push(JSON.parse(ruta.request().postData() ?? "{}"));
      await new Promise((r) => setTimeout(r, 900));
      const actual = (await (await fetch(`${BASE}/api/landings/${buena.id}`)).json()) as { doc: LandingDoc };
      // Como hace A: solo cambia esa sección, conserva `id`, `tipo` y lo editado a mano (aquí, el subtitular).
      const doc = structuredClone(actual.doc);
      const heroe = doc.secciones.find((s) => s.id === "sec-heroe")!;
      heroe.ajustes.titular = titularCorto;
      await ruta.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...actual, doc, proveedorRegeneracion: "simulado" }) });
    });
    await p.goto(`${BASE}/editor/${buena.id}`, { waitUntil: "domcontentloaded" });
    const marco = p.frameLocator("iframe[title^='Vista previa']");
    await marco.locator("h1").first().waitFor({ timeout: 60_000 });
    await p.waitForTimeout(1500);
    comprobar((await marco.locator("h1").first().innerText()).includes("espalda cargada"), "el editor arranca con el titular original");
    await p.locator("[data-grupo-inspector='ia'] summary").click();
    // Lo editado a mano se marca para que la IA no lo toque.
    const botonCorto = p.locator("[data-ia-rapida='Más corto']");
    await botonCorto.click();
    await p.locator("[data-ia-cargando]").waitFor();
    comprobar((await botonCorto.getAttribute("aria-busy")) === "true" && (await botonCorto.innerText()) === "Acortando…", "mientras corre, el botón dice «Acortando…» y marca aria-busy");
    comprobar(await p.locator("[data-ia-rapida='Más directo']").isDisabled(), "y los demás botones esperan");
    await p.screenshot({ path: join(SALIDA, "editor-ia-cargando-1440.png") });
    await p.locator("[data-ia-listo]").waitFor({ timeout: 15_000 });
    const cuantas = () => peticiones.length;
    comprobar(cuantas() === 1 && peticiones[0].seccionId === "sec-heroe" && /más corto/i.test(peticiones[0].instruccion ?? ""), `se pidió a la API de regenerar con la instrucción «${peticiones[0]?.instruccion?.slice(0, 40)}…»`);
    await marco.locator("h1", { hasText: titularCorto }).waitFor({ timeout: 15_000 });
    comprobar(true, "la vista previa muestra el titular más corto");
    comprobar(((await marco.locator("h1").first().innerText()).length) < titularOriginal.length, "y es más corto que el original");
    await p.screenshot({ path: join(SALIDA, "editor-ia-mas-corto-1440.png") });
    await p.locator("[data-ia-deshacer]").click();
    await marco.locator("h1", { hasText: "espalda cargada" }).waitFor({ timeout: 15_000 });
    comprobar(true, "Deshacer devuelve el titular original");
    await p.waitForTimeout(1600);
    const guardada = (await (await fetch(`${BASE}/api/landings/${buena.id}`)).json()) as { doc: LandingDoc };
    comprobar(guardada.doc.secciones[0].ajustes.titular === titularOriginal, "y el autoguardado también lo dejó como estaba");

    // La instrucción libre necesita texto.
    comprobar(await p.locator("[data-ia-instruccion]").isDisabled(), "«Aplicar instrucción» espera a que escribas algo");
    await p.locator("#regenerar-instruccion").fill("Habla del precio");
    await p.locator("[data-ia-instruccion]").click();
    await p.locator("[data-ia-listo]").waitFor({ timeout: 15_000 });
    comprobar(cuantas() === 2 && peticiones[1].instruccion === "Habla del precio", "la instrucción libre viaja tal cual a la API");

    // Un error de la IA se muestra y no cambia nada.
    await p.unroute("**/api/landings/*/regenerar-seccion");
    await p.route("**/api/landings/*/regenerar-seccion", (ruta) => ruta.fulfill({ status: 422, contentType: "application/json", body: JSON.stringify({ error: "La sección regenerada tiene infracciones de la lista negra." }) }));
    await p.locator("[data-ia-rapida='Otro ángulo']").click();
    await p.locator("[data-grupo-inspector='ia'] [role=alert]").waitFor();
    comprobar((await p.locator("[data-grupo-inspector='ia'] [role=alert]").innerText()).includes("lista negra"), "si la IA falla se muestra el error y no se cambia nada");
    await ctx.close();
  } finally {
    await navegador.close();
  }
  const graves = errores.filter((e) => !/favicon|Failed to load resource/i.test(e));
  comprobar(graves.length === 0, `sin errores de página (${graves.slice(0, 1).join("") || "0"})`);
  console.log("dia20-entrega: TODO OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
