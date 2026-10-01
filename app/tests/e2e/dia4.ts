// Aceptación del día 4 (docs/02 §5) contra `npm run dev`: reordenar, ocultar y editar un texto
// se ven al instante en la vista previa y persisten al recargar. También toma las capturas de docs/bitacora/capturas/dia4/.
//
// Uso: PUERTO=3111 npx tsx tests/e2e/dia4.ts   (con el servidor de desarrollo encendido)
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright";
import { combinar } from "@/lib/tecnicas/combinador";
import { landingEjemplo } from "../fixtures/landing-ejemplo";
import { briefCorrector } from "../tecnicas/briefs";

const BASE = `http://localhost:${process.env.PUERTO ?? "3000"}`;
const SALIDA = join(process.cwd(), "..", "docs", "bitacora", "capturas", "dia4");
mkdirSync(SALIDA, { recursive: true });

function comprobar(condicion: unknown, mensaje: string): asserts condicion {
  if (!condicion) throw new Error(`FALLA: ${mensaje}`);
  console.log(`ok · ${mensaje}`);
}

async function crearLanding(): Promise<{ id: string; slug: string }> {
  const doc = structuredClone(landingEjemplo);
  doc.meta.slug = `e2e-${Date.now()}`;
  doc.meta.nombre = "Prueba de aceptación día 4";
  const r = await fetch(`${BASE}/api/landings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ brief: briefCorrector, tecnicas: ["semilla"], prompt: combinar(briefCorrector, []), doc, proveedor: "manual" }),
  });
  comprobar(r.status === 201, `POST /api/landings → 201 (fue ${r.status})`);
  return (await r.json()) as { id: string; slug: string };
}

/** Orden de los `data-seccion-id` que pinta la vista previa. */
const ordenEnVista = (pagina: Page) =>
  pagina.frameLocator("iframe").locator("[data-seccion-id]").evaluateAll((els) => els.map((e) => e.getAttribute("data-seccion-id")));

async function esperarGuardado(pagina: Page) {
  await pagina.locator('[data-guardado="guardado"]').waitFor({ timeout: 10_000 });
}

async function main() {
  const { id, slug } = await crearLanding();
  const navegador = await chromium.launch({ channel: "msedge" });
  const errores: string[] = [];
  try {
    // ── Escritorio 1280 ────────────────────────────────────────────────
    const ctx = await navegador.newContext({ viewport: { width: 1280, height: 900 } });
    const pagina = await ctx.newPage();
    pagina.on("pageerror", (e) => errores.push(e.message));
    pagina.on("console", (m) => m.type() === "error" && errores.push(m.text()));
    await pagina.goto(`${BASE}/editor/${id}`);
    await pagina.locator("[data-lista-secciones]").waitFor();
    await pagina.frameLocator("iframe").locator("[data-seccion-id]").first().waitFor({ timeout: 20_000 });
    await pagina.waitForTimeout(800);
    await pagina.screenshot({ path: join(SALIDA, "editor-1280.png") });

    const antes = await ordenEnVista(pagina);
    comprobar(antes.length >= 5, `la vista previa pinta ${antes.length} secciones`);

    // 1) Reordenar: «Bajar Beneficios» la pasa una posición abajo.
    const filas = pagina.locator("[data-fila-seccion]");
    const idsLista = await filas.evaluateAll((els) => els.map((e) => e.getAttribute("data-fila-seccion")));
    const idBeneficios = idsLista[idsLista.findIndex((x) => x?.includes("ben"))];
    comprobar(idBeneficios, "existe la sección de beneficios");
    const posAntes = antes.indexOf(idBeneficios);
    await pagina.getByRole("button", { name: "Bajar Beneficios", exact: true }).click();
    await pagina.waitForFunction(() => true);
    const trasBajar = await ordenEnVista(pagina);
    comprobar(trasBajar.indexOf(idBeneficios) === posAntes + 1, "reordenar se ve al instante en la vista previa");

    // 2) Ocultar la sección de preguntas frecuentes.
    const idFaq = idsLista.find((x) => x?.includes("faq"));
    comprobar(idFaq, "existe la sección de preguntas frecuentes");
    await pagina.getByRole("button", { name: "Ocultar Preguntas frecuentes", exact: true }).click();
    await pagina.waitForTimeout(300);
    const trasOcultar = await ordenEnVista(pagina);
    comprobar(!trasOcultar.includes(idFaq), "ocultar se ve al instante en la vista previa");

    // 3) Editar un texto: el título de Beneficios.
    await filas.filter({ has: pagina.locator(`text=Beneficios`) }).first().getByRole("button", { name: /^Beneficios/ }).click();
    const campo = pagina.locator('[data-panel-ajustes] [data-campo="ajustes.titulo"]').locator("input, textarea").first();
    await campo.waitFor();
    const textoNuevo = `Título editado ${Date.now() % 100000}`;
    await campo.fill(textoNuevo);
    await pagina.frameLocator("iframe").getByText(textoNuevo).first().waitFor({ timeout: 5_000 });
    comprobar(true, "editar un texto se ve al instante en la vista previa");
    await esperarGuardado(pagina);
    comprobar(true, "el indicador pasa a «Guardado»");

    // 4) Persistencia: recargar y comprobar orden, oculta y texto.
    await pagina.reload();
    await pagina.frameLocator("iframe").locator("[data-seccion-id]").first().waitFor({ timeout: 20_000 });
    const trasRecargar = await ordenEnVista(pagina);
    comprobar(trasRecargar.join() === trasOcultar.join(), "el orden y la sección oculta persisten al recargar");
    await pagina.frameLocator("iframe").getByText(textoNuevo).first().waitFor({ timeout: 5_000 });
    comprobar(true, "el texto editado persiste al recargar");
    const servidor = (await (await fetch(`${BASE}/api/landings/${id}`)).json()) as { doc: { secciones: { id: string; visible: boolean; editadoPorHumano?: string[] }[] } };
    comprobar(servidor.doc.secciones.find((s) => s.id === idFaq)?.visible === false, "el servidor guarda la sección oculta");
    comprobar((servidor.doc.secciones.find((s) => s.id === idBeneficios)?.editadoPorHumano ?? []).length > 0, "el servidor marca «editado a mano»");

    // 5) Tema antes / después (morph) con «Otra semilla».
    await pagina.getByRole("button", { name: "Restaurar", exact: false }).first().waitFor({ state: "detached", timeout: 100 }).catch(() => {});
    await pagina.screenshot({ path: join(SALIDA, "editor-tema-antes.png") });
    await pagina.getByRole("button", { name: "Otra semilla" }).first().click();
    await pagina.waitForTimeout(900);
    await pagina.screenshot({ path: join(SALIDA, "editor-tema-despues.png") });
    comprobar(true, "capturas del tema antes y después");
    await ctx.close();

    // ── Móvil 390: una captura por pestaña ─────────────────────────────
    const movil = await navegador.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const m = await movil.newPage();
    m.on("pageerror", (e) => errores.push(e.message));
    await m.goto(`${BASE}/editor/${id}`);
    await m.getByRole("tab", { name: "Secciones" }).waitFor();
    // Barra superior compacta: el nombre en una línea y las acciones en un menú.
    const altoBarra = await m.locator("[data-barra-editor]").evaluate((e) => e.getBoundingClientRect().height);
    comprobar(altoBarra <= 130, `la barra superior a 390 px mide ${Math.round(altoBarra)} px (2 filas)`);
    comprobar(!(await m.getByRole("button", { name: "Versiones" }).isVisible()), "a 390 px Versiones no ocupa lugar en la barra");
    await m.getByRole("button", { name: /^Acciones/ }).click();
    for (const nombre of ["Versiones", "Guardar en banco"]) comprobar(await m.getByRole("button", { name: nombre }).isVisible(), `el menú de acciones muestra «${nombre}»`);
    comprobar(await m.getByRole("link", { name: "Ver la landing pública" }).isVisible(), "el menú de acciones muestra «Ver la landing pública»");
    await m.screenshot({ path: join(SALIDA, "editor-390-menu-acciones.png") });
    await m.keyboard.press("Escape");
    comprobar(!(await m.getByRole("button", { name: "Versiones" }).isVisible()), "Escape cierra el menú de acciones");
    for (const nombre of ["Secciones", "Vista", "Ajustes"]) {
      await m.getByRole("tab", { name: nombre }).click();
      await m.waitForTimeout(900);
      await m.screenshot({ path: join(SALIDA, `editor-390-${nombre.toLowerCase()}.png`) });
      const desborde = await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      comprobar(!desborde, `sin desborde horizontal en la pestaña ${nombre} a 390 px`);
    }
    await movil.close();

    // ── Landing pública + lead + tabla de leads ────────────────────────
    // reduced-motion: la captura sale con el titular y el formulario ya en su sitio, no a mitad de la animación.
    const pub = await navegador.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: "reduce" });
    const p = await pub.newPage();
    p.on("pageerror", (e) => errores.push(e.message));
    await p.goto(`${BASE}/l/${slug}`);
    await p.locator("form").waitFor();
    await p.locator("form").scrollIntoViewIfNeeded();
    await p.getByLabel(/^nombre/i).fill("Ana Torres");
    await p.getByLabel(/^correo/i).fill("ana@example.com");
    await p.getByLabel(/^teléfono/i).fill("3001234567");
    await p.screenshot({ path: join(SALIDA, "landing-publica-390.png") });
    await p.locator("form button[type=submit]").click();
    await p.locator("[role=status]").filter({ hasText: /\S/ }).first().waitFor({ timeout: 10_000 });
    comprobar(true, "el lead público se envía y muestra el mensaje de éxito");
    await pub.close();

    const grande = await navegador.newContext({ viewport: { width: 1280, height: 800 } });
    const l = await grande.newPage();
    await l.goto(`${BASE}/l/${slug}/leads`);
    await l.getByText("Ana Torres").first().waitFor({ timeout: 10_000 });
    await l.screenshot({ path: join(SALIDA, "leads-1280.png") });
    comprobar(true, "la tabla de leads muestra el lead recibido");
    await grande.close();
  } finally {
    await navegador.close();
  }
  const graves = errores.filter((e) => !/favicon|Download the React DevTools/i.test(e));
  if (graves.length) console.log("Errores de consola:", graves);
  console.log(`\nAceptación día 4: OK · landing ${id} · capturas en ${SALIDA}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
