// Aceptación 13-B: editor estilo Shopify (layout fijo, árbol, modal, vista sincronizada, barra rápida, edición en línea,
// inspector por grupos, imagen desde bancos y atajos).
// Uso: PUERTO=3112 npx tsx tests/e2e/dia13-editor.ts   (con el servidor encendido; capturas en docs/bitacora/capturas/dia13B/)
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright";
import { combinar } from "@/lib/tecnicas/combinador";
import { landingEjemplo } from "../fixtures/landing-ejemplo";
import { briefCorrector } from "../tecnicas/briefs";

const BASE = `http://localhost:${process.env.PUERTO ?? "3000"}`;
const SALIDA = join(process.cwd(), "..", "docs", "bitacora", "capturas", "dia13B");
mkdirSync(SALIDA, { recursive: true });

function comprobar(condicion: unknown, mensaje: string): asserts condicion {
  if (!condicion) throw new Error(`FALLA: ${mensaje}`);
  console.log(`ok · ${mensaje}`);
}

async function crearLanding(nombre: string): Promise<{ id: string; slug: string }> {
  const doc = structuredClone(landingEjemplo);
  doc.meta.slug = `e2e-editor-${Date.now()}`;
  doc.meta.nombre = nombre;
  const r = await fetch(`${BASE}/api/landings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ brief: briefCorrector, tecnicas: ["semilla"], prompt: combinar(briefCorrector, []), doc, proveedor: "manual" }),
  });
  comprobar(r.status === 201, `POST /api/landings → 201 (fue ${r.status})`);
  return (await r.json()) as { id: string; slug: string };
}

const filas = (p: Page) => p.locator("[data-fila-seccion]");
const ids = (p: Page) => filas(p).evaluateAll((els) => els.map((e) => e.getAttribute("data-fila-seccion")));
const esperarGuardado = (p: Page) => p.locator('[data-guardado="guardado"]').waitFor({ timeout: 15_000 });

async function abrir(p: Page, id: string) {
  await p.goto(`${BASE}/editor/${id}`, { waitUntil: "domcontentloaded" });
  await p.locator("[data-lienzo]").waitFor({ timeout: 60_000 });
  const marco = p.frameLocator("iframe[title^='Vista previa']");
  await marco.locator("[data-seccion-id]").first().waitFor({ timeout: 60_000 });
  await p.waitForTimeout(1200);
  return marco;
}

async function main() {
  const { id } = await crearLanding("Editor 13-B");
  const navegador = await chromium.launch({ channel: "msedge" });
  const errores: string[] = [];
  try {
    const ctx = await navegador.newContext({ viewport: { width: 1440, height: 760 } });
    // tsx (esbuild) agrega `__name` a las funciones con nombre que viajan a la página.
    await ctx.addInitScript("window.__name = (f) => f;");
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errores.push(e.message));
    p.on("console", (m) => m.type() === "error" && errores.push(m.text()));
    let marco = await abrir(p, id);

    // ── 1. Layout fijo ──
    const medidas = await p.evaluate(() => {
      const r = (s: string) => document.querySelector(s)!.getBoundingClientRect();
      return {
        barra: r("[data-barra-editor]").height,
        izq: r("#panel-secciones").width,
        der: r("#panel-ajustes").width,
        alto: document.documentElement.scrollHeight,
        ventana: window.innerHeight,
      };
    });
    comprobar(Math.round(medidas.barra) === 56, `barra superior de 56 px (${medidas.barra})`);
    comprobar(Math.round(medidas.izq) === 280 && Math.round(medidas.der) === 320, `columnas de 280 y 320 px (${Math.round(medidas.izq)} y ${Math.round(medidas.der)})`);
    comprobar(medidas.alto <= medidas.ventana, `la página no crece más que la ventana (${medidas.alto} ≤ ${medidas.ventana})`);
    await p.evaluate(() => window.scrollTo(0, 600));
    comprobar((await p.evaluate(() => window.scrollY)) === 0, "window.scrollY sigue en 0");
    const estilos = await p.evaluate(() => {
      const c = document.querySelector("[data-editor]") as HTMLElement;
      const a = getComputedStyle(c);
      const izq = getComputedStyle(document.querySelector("#panel-secciones")!);
      const der = getComputedStyle(document.querySelector("#panel-ajustes")!);
      const fijos = [...document.querySelectorAll("#panel-secciones, #panel-ajustes, #panel-vista")].some((el) => ["sticky", "fixed"].includes(getComputedStyle(el).position));
      return { overflow: a.overflow, alto: a.height, izqOverflow: izq.overflowY, derOverflow: der.overflowY, contain: izq.overscrollBehaviorY, fijos };
    });
    comprobar(estilos.overflow.startsWith("hidden"), "el contenedor tiene overflow hidden");
    comprobar(estilos.izqOverflow === "auto" && estilos.derOverflow === "auto" && estilos.contain === "contain", "cada panel scrollea solo y contiene el scroll");
    comprobar(!estilos.fijos, "sin sticky ni fixed en los paneles");

    // Los paneles scrollean por separado: se agregan secciones hasta que el árbol desborde y se abre todo el inspector.
    await p.locator("[data-fila-seccion]").first().click();
    await p.locator("[data-grupo-inspector]").first().waitFor();
    for (const g of await p.locator("[data-grupo-inspector]").all()) {
      if (!(await g.evaluate((el) => (el as HTMLDetailsElement).open))) await g.locator("summary").click();
    }
    const scrolls = await p.evaluate(() => {
      const izq = document.querySelector("#panel-secciones") as HTMLElement;
      const der = document.querySelector("#panel-ajustes") as HTMLElement;
      const antesIzq = izq.scrollTop;
      der.scrollTop = 300;
      return { derMax: der.scrollHeight - der.clientHeight, der: der.scrollTop, izq: izq.scrollTop, antesIzq, win: window.scrollY };
    });
    comprobar(scrolls.derMax > 0 && scrolls.der > 0, `el inspector scrollea por su cuenta (${scrolls.der} de ${scrolls.derMax})`);
    comprobar(scrolls.izq === scrolls.antesIzq && scrolls.win === 0, "al scrollear el inspector, ni el árbol ni la ventana se mueven");
    await p.evaluate(() => {
      (document.querySelector("#panel-ajustes") as HTMLElement).scrollTop = 0;
    });

    // ── 2. Árbol por grupos y bloques ──
    comprobar((await p.locator("[data-grupo='plantilla']").count()) === 1, "el árbol tiene el grupo Plantilla");
    const filaBeneficios = p.locator("[data-fila-seccion]", { hasText: "Beneficios" });
    await filaBeneficios.getByRole("button", { name: /Desplegar los bloques/ }).click();
    const bloquesBeneficios = filaBeneficios.locator("[data-bloque-fila]");
    comprobar((await bloquesBeneficios.count()) === 3, `Beneficios muestra sus 3 bloques (${await bloquesBeneficios.count()})`);
    await filaBeneficios.locator("[data-anadir-bloque]").click();
    comprobar((await bloquesBeneficios.count()) === 4, "«Añadir bloque» suma un bloque");
    await bloquesBeneficios.first().click();
    comprobar((await p.locator("[data-bloque-id]").first().evaluate((el) => el.className.includes("ring-marca"))) === true, "elegir un bloque lo resalta en el inspector");

    // ── 3. Hover y clic en la vista previa ──
    const secciones = marco.locator("[data-seccion-id]");
    const totalVista = await secciones.count();
    comprobar(totalVista === 6, `la vista previa tiene las 6 secciones (${totalVista})`);
    await secciones.nth(3).hover();
    await marco.locator("[data-contorno='hover']").waitFor();
    comprobar((await marco.locator("[data-contorno='hover'] span").first().textContent())?.length, "al pasar el mouse sale el contorno con la etiqueta de la sección");
    await p.screenshot({ path: join(SALIDA, "hover-1440.png") });

    await secciones.nth(4).click({ position: { x: 20, y: 20 } });
    await p.waitForFunction(() => document.querySelector("[data-fila-seccion][data-fila-seccion] button[aria-current='true']")?.textContent?.includes("Preguntas"), null, { timeout: 5000 });
    comprobar((await p.locator("[data-fila-seccion] button[aria-current='true']").first().textContent())?.includes("Preguntas"), "un clic en la vista selecciona la sección en la lista");
    comprobar((await p.locator("[data-inspector='seccion'] > header h2").textContent())?.includes("Preguntas"), "y abre su configuración");
    await marco.locator("[data-contorno='seleccion']").waitFor();

    // ── 4. Barra rápida ──
    const contar = async () => (await ids(p)).length;
    const antes = await contar();
    // Las preguntas frecuentes admiten una sola por landing: «Duplicar» queda desactivado con su motivo.
    comprobar((await marco.locator("[data-accion-rapida='duplicar']").getAttribute("aria-disabled")) === "true", "«Duplicar» está desactivado cuando el tipo no admite otra copia");
    await marco.locator("[data-accion-rapida='subir']").click();
    await p.waitForTimeout(400);
    await marco.locator("[data-accion-rapida='eliminar']").click();
    await p.waitForFunction((n) => document.querySelectorAll("[data-fila-seccion]").length === n - 1, antes);
    comprobar((await contar()) === antes - 1, "«Eliminar» quita la sección");
    // Al ocultar, la sección desaparece de la vista y con ella su barra: se vuelve a mostrar desde la lista.
    await marco.locator("[data-seccion-id]").nth(1).click({ position: { x: 20, y: 20 } });
    await marco.locator("[data-accion-rapida='ocultar']").click();
    await p.waitForFunction(() => [...document.querySelectorAll("[data-fila-seccion]")].some((f) => f.textContent?.includes("Oculta")));
    comprobar(true, "«Ocultar» marca la sección como oculta");
    await p.screenshot({ path: join(SALIDA, "barra-rapida-1440.png") });

    // ── 5. Edición en línea ──
    await secciones.first().scrollIntoViewIfNeeded();
    const titular = marco.locator("[data-seccion-id] h1").first();
    await titular.dblclick();
    await marco.locator("[contenteditable]").first().waitFor({ timeout: 8000 });
    comprobar(true, "doble clic en el titular lo deja editable en la vista");
    await p.keyboard.press("Control+A");
    await p.keyboard.type("Titular editado en línea");
    await p.keyboard.press("Enter");
    await p.waitForFunction(() => (document.querySelector("#ajuste-titular") as HTMLTextAreaElement | HTMLInputElement | null)?.value === "Titular editado en línea", null, { timeout: 8000 });
    comprobar(true, "el cambio aparece en el inspector");
    await esperarGuardado(p);
    await p.waitForTimeout(1500);
    const guardado = (await (await fetch(`${BASE}/api/landings/${id}`)).json()) as { doc: { secciones: { tipo: string; ajustes: { titular?: string } }[] } };
    comprobar(guardado.doc.secciones.find((s) => s.tipo === "heroe")?.ajustes.titular === "Titular editado en línea", "el texto quedó guardado en la base");
    marco = await abrir(p, id);
    comprobar((await marco.locator("h1").first().textContent())?.includes("Titular editado en línea"), "y persiste al recargar");

    // ── 6. Modal «Añadir sección» ──
    const antesModal = await contar();
    await p.locator("[data-anadir-seccion]").click();
    const modal = p.locator("[data-modal-agregar]");
    await modal.waitFor();
    await modal.locator("[data-miniatura]").first().waitFor();
    comprobar((await modal.locator("[data-agregar]").count()) > 20, `el modal ofrece miniaturas por variante (${await modal.locator("[data-agregar]").count()})`);
    await p.waitForTimeout(1500);
    await p.screenshot({ path: join(SALIDA, "modal-1440.png") });
    await modal.getByPlaceholder(/Buscar/).fill("galeria");
    comprobar((await modal.locator("[data-agregar='galeria']").count()) === 4, "el buscador filtra (galería: 4 variantes)");
    await modal.locator("[data-agregar='galeria'][data-variante='carrusel']").click();
    await modal.waitFor({ state: "detached" });
    comprobar((await contar()) === antesModal + 1, "elegir una variante añade la sección");
    comprobar((await p.locator("[data-inspector='seccion'] > header h2").textContent())?.includes("Galería"), "y queda seleccionada");
    await p.keyboard.press("Escape");

    // ── 7. Inspector por grupos e imagen ──
    await p.locator("[data-fila-seccion]", { hasText: "Galería" }).locator("button[aria-current]").first().click().catch(() => {});
    await p.locator("[data-fila-seccion]", { hasText: "Galería" }).getByRole("button", { name: /^Galería/ }).click();
    const grupos = await p.locator("[data-grupo-inspector]").evaluateAll((els) => els.map((e) => [e.getAttribute("data-grupo-inspector"), (e as HTMLDetailsElement).open]));
    comprobar(JSON.stringify(grupos.map((g) => g[0])) === JSON.stringify(["contenido", "diseno", "espaciado", "visibilidad", "ia", "efectos", "avanzado"]), `grupos del inspector: ${grupos.map((g) => g[0]).join(", ")}`);
    comprobar(grupos[0][1] === true && grupos.slice(1).every((g) => g[1] === false), "Contenido abierto y los demás plegados");
    await p.locator("[data-grupo-inspector='diseno'] summary").click();
    comprobar((await p.locator("[data-selector-variante] [data-variante]").count()) === 4, "Diseño trae el selector visual de variantes con miniaturas");
    await p.locator("[data-selector-variante] [data-variante='mosaico']").click();
    comprobar((await p.locator("[data-selector-variante] [data-variante='mosaico']").getAttribute("aria-pressed")) === "true", "elegir una variante la aplica");
    await p.locator("[data-grupo-inspector='diseno'] summary").click();

    await p.locator("[data-fila-seccion]", { hasText: "Galería" }).getByRole("button", { name: /^Galería/ }).click();
    const control = p.locator("[data-slot-editor]").first();
    await control.getByRole("button", { name: "Buscar en bancos" }).click();
    await control.getByRole("button", { name: "Buscar", exact: true }).click();
    await control.locator("[data-medio]").first().waitFor();
    comprobar(true, "«Buscar en bancos» lista resultados");
    await control.locator("[data-medio]").first().click();
    await p.waitForFunction(() => document.querySelector("[data-slot-editor] img") !== null);
    comprobar(true, "elegir un resultado deja la imagen en el slot");
    await control.getByRole("button", { name: "Foco" }).click();
    await control.locator("input[type='range']").first().fill("20");
    comprobar((await control.locator("[data-foco] output, [data-foco] span.tabular-nums").first().textContent())?.includes("20"), "el control de foco cambia el encuadre");
    // (el botón «Copiar prompt» salió con Grok Imagine)
    await p.screenshot({ path: join(SALIDA, "inspector-imagen-1440.png") });

    // ── 8. Atajos ──
    await p.locator("[data-fila-seccion]", { hasText: "Galería" }).getByRole("button", { name: /^Galería/ }).click();
    const inicial = await ids(p);
    await p.locator("body").click({ position: { x: 700, y: 5 } });
    await p.keyboard.press("Control+d");
    await p.waitForFunction((n) => document.querySelectorAll("[data-fila-seccion]").length === n + 1, inicial.length);
    comprobar(true, "Ctrl+D duplica");
    await p.keyboard.press("Alt+ArrowUp");
    await p.waitForTimeout(300);
    await p.keyboard.press("Delete");
    await p.waitForFunction((n) => document.querySelectorAll("[data-fila-seccion]").length === n, inicial.length);
    comprobar(true, "Supr elimina");
    await p.keyboard.press("Control+z");
    await p.waitForFunction((n) => document.querySelectorAll("[data-fila-seccion]").length === n + 1, inicial.length);
    comprobar(true, "Ctrl+Z deshace");
    await p.keyboard.press("Control+Shift+z");
    await p.waitForFunction((n) => document.querySelectorAll("[data-fila-seccion]").length === n, inicial.length);
    comprobar(true, "Ctrl+Shift+Z rehace");
    await p.keyboard.press("Escape");
    await p.locator("[data-inspector='tema']").waitFor();
    comprobar(true, "Esc quita la selección y el inspector muestra el Tema");
    await p.keyboard.press("?");
    await p.locator("[data-ayuda-atajos]").waitFor();
    comprobar(true, "«?» muestra los atajos");
    await p.screenshot({ path: join(SALIDA, "atajos-1440.png") });
    await p.keyboard.press("Escape");
    // Atajos con el foco dentro de la vista previa.
    await marco.locator("[data-tipo='galeria']").first().click({ position: { x: 20, y: 20 } });
    await p.waitForTimeout(400);
    const n0 = await contar();
    await p.frames()[1]?.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.());
    await marco.locator("body").press("Control+d");
    await p.waitForFunction((n) => document.querySelectorAll("[data-fila-seccion]").length === n + 1, n0);
    comprobar(true, "los atajos también funcionan con el foco dentro de la vista previa");
    await marco.locator("body").press("p");
    await p.waitForURL(new RegExp(`/ver/${id}`), { timeout: 15_000 });
    comprobar(true, "P abre «Ver completa» (/ver/[id])");

    // ── 9. Capturas y modos ──
    await abrir(p, id);
    await p.screenshot({ path: join(SALIDA, "editor-1440.png") });
    await p.setViewportSize({ width: 1280, height: 720 });
    await p.waitForTimeout(800);
    await p.screenshot({ path: join(SALIDA, "editor-1280.png") });
    await p.setViewportSize({ width: 1100, height: 720 });
    await p.waitForTimeout(600);
    comprobar((await p.locator("[data-modo]").getAttribute("data-modo")) === "cajon", "a 1100 px la configuración pasa a un cajón");
    await p.locator("[data-fila-seccion]").first().getByRole("button").nth(1).click();
    await p.locator("[data-cajon]").waitFor();
    await p.screenshot({ path: join(SALIDA, "editor-cajon-1100.png") });
    await p.setViewportSize({ width: 800, height: 700 });
    await p.waitForTimeout(600);
    comprobar((await p.locator("[data-aviso-computador]").count()) === 1, "a 800 px sale el aviso «El editor funciona mejor en computador»");
    await p.screenshot({ path: join(SALIDA, "editor-800.png") });
    await ctx.close();
  } finally {
    await navegador.close();
  }
  const graves = errores.filter((e) => !/favicon|Failed to load resource|Download the React DevTools/i.test(e));
  comprobar(graves.length === 0, `sin errores de consola (${graves.slice(0, 1).map((x) => x.slice(0, 1500)).join(" | ") || "0"})`);
  console.log("dia13-editor: TODO OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
