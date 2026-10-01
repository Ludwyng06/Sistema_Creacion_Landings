// Aceptación del validador anti-split (render) contra `npm run dev`:
//  · una landing con un html-libre en dos columnas muestra el banner «Héroe split detectado» y bloquea «Guardar en banco»;
//  · las 8 variantes de héroe aprobadas no lo disparan (ni con imágenes ni con marcadores de asset);
//  · el paso 4 de /crear muestra el mismo banner.
//
// Uso: PUERTO=3111 npx tsx tests/e2e/dia6-antisplit.ts
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright";
import { VARIANTES_HEROE } from "@/lib/contratos";
import { combinar } from "@/lib/tecnicas/combinador";
import { ejemplos as ejemplosHeroe } from "@/secciones/heroe/ejemplo";
import { ASSETS_EJEMPLO } from "@/app/dev/secciones/documentos";
import { ASSETS_NIVEL_3 } from "@/app/dev/efectos/demos-nivel3";
import { landingEjemplo } from "../fixtures/landing-ejemplo";
import { briefCorrector } from "../tecnicas/briefs";

const BASE = `http://localhost:${process.env.PUERTO ?? "3000"}`;
const SALIDA = join(process.cwd(), "..", "docs", "bitacora", "capturas", "dia6B");
mkdirSync(SALIDA, { recursive: true });

function comprobar(condicion: unknown, mensaje: string): asserts condicion {
  if (!condicion) throw new Error(`FALLA: ${mensaje}`);
  console.log(`ok · ${mensaje}`);
}

type Doc = typeof landingEjemplo;

const HTML_DOS_COLUMNAS =
  '<div class="grid gap-8 md:grid-cols-2"><div><h1>Un título pegado a la izquierda</h1><p>Texto de apoyo.</p></div><img src="/dev/efectos/producto.webp" alt="Producto" class="w-full h-auto"></div>';

/** Landing de prueba: héroe oculto y un html-libre a dos columnas como primera cosa visible. */
function landingSplit(): Doc {
  const doc = structuredClone(landingEjemplo);
  doc.meta.slug = `split-${Date.now()}`;
  doc.meta.nombre = "Prueba anti-split";
  doc.secciones = [
    { ...doc.secciones[0], visible: false },
    {
      id: "html-dos-columnas",
      tipo: "html-libre",
      visible: true,
      intencion: { objetivo: "Probar el validador de render." },
      ajustes: { html: HTML_DOS_COLUMNAS },
      bloques: [],
    },
    ...doc.secciones.slice(1),
  ];
  doc.assets = [...doc.assets, ...ASSETS_NIVEL_3.filter((a) => !doc.assets.some((x) => x.slot === a.slot))];
  return doc;
}

function landingConHeroe(variante: (typeof VARIANTES_HEROE)[number], conArchivos: boolean): Doc {
  const doc = structuredClone(landingEjemplo);
  doc.meta.slug = `heroe-${variante}-${conArchivos ? "img" : "marc"}-${Date.now()}`;
  doc.secciones = [structuredClone(ejemplosHeroe[variante]), ...doc.secciones.slice(1)];
  doc.assets = conArchivos ? ASSETS_NIVEL_3 : ASSETS_EJEMPLO;
  return doc;
}

async function crear(doc: Doc): Promise<string> {
  const r = await fetch(`${BASE}/api/landings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ brief: briefCorrector, tecnicas: ["semilla"], prompt: combinar(briefCorrector, []), doc, proveedor: "manual" }),
  });
  if (r.status !== 201) throw new Error(`POST /api/landings → ${r.status} ${await r.text()}`);
  return ((await r.json()) as { id: string }).id;
}

/** Espera a que el editor llegue al veredicto esperado; los intermedios (imágenes aún sin cargar) no cuentan. */
async function veredicto(pagina: Page, esperado: "split" | "ok"): Promise<string> {
  const lee = () => pagina.getAttribute("[data-editor]", "data-anti-split");
  const limite = Date.now() + 30_000;
  while (Date.now() < limite && (await lee()) !== esperado) await pagina.waitForTimeout(250);
  if (esperado === "ok") await pagina.waitForTimeout(1500); // que un split tardío no se cuele
  return (await lee()) ?? "";
}

async function main() {
  const navegador = await chromium.launch({ channel: "msedge" });
  try {
    // ── Editor a 1280: banner y banco bloqueado ────────────────────────
    const idSplit = await crear(landingSplit());
    const ctx = await navegador.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
    const pagina = await ctx.newPage();
    await pagina.goto(`${BASE}/editor/${idSplit}`);
    comprobar((await veredicto(pagina, "split")) === "split", "el editor detecta el héroe split (html-libre a dos columnas)");
    const banner = pagina.locator("[data-banner-anti-split]");
    comprobar(await banner.isVisible(), "aparece el banner rojo");
    comprobar(/Héroe split detectado/.test(await banner.innerText()), "el banner dice «Héroe split detectado»");
    comprobar(await pagina.getByRole("button", { name: "Cambiar a una variante aprobada" }).isVisible(), "el banner ofrece cambiar a una variante aprobada");
    const banco = pagina.getByRole("button", { name: "Guardar en banco" });
    comprobar(await banco.isDisabled(), "«Guardar en banco» queda bloqueado mientras el detector falle");
    comprobar(await pagina.locator("[data-banco-bloqueado]").isVisible(), "se explica por qué está bloqueado");
    await pagina.screenshot({ path: join(SALIDA, "antisplit-banner-editor-1280.png") });
    await pagina.locator("[data-barra-editor]").screenshot({ path: join(SALIDA, "antisplit-banco-bloqueado-1280.png") });

    // El banner sigue visible con la vista previa en 390 px (donde el validador no aplica): mide un iframe aparte a 1280.
    await pagina.getByRole("button", { name: "390" }).click();
    await pagina.waitForTimeout(500);
    comprobar(await banner.isVisible(), "con la vista de 390 px el banner sigue (la medición se hace a 1280 px)");
    await pagina.getByRole("button", { name: "Cambiar a una variante aprobada" }).click();
    comprobar((await pagina.locator("[data-panel-ajustes]").first().getAttribute("data-panel-ajustes")) === "heroe", "el botón del banner abre los ajustes del héroe");
    await ctx.close();

    // ── Editor a 390: el menú de acciones tiene el banco bloqueado ─────
    const movil = await navegador.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: "reduce" });
    const m = await movil.newPage();
    await m.goto(`${BASE}/editor/${idSplit}`);
    comprobar((await veredicto(m, "split")) === "split", "a 390 px el editor también detecta el split");
    await m.getByRole("button", { name: /^Acciones/ }).click();
    comprobar(await m.getByRole("button", { name: "Guardar en banco" }).isDisabled(), "a 390 px «Guardar en banco» sigue bloqueado");
    await m.screenshot({ path: join(SALIDA, "antisplit-banco-bloqueado-390.png") });
    await movil.close();

    // ── Ningún héroe aprobado dispara el detector ──────────────────────
    const c2 = await navegador.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
    const p2 = await c2.newPage();
    for (const variante of VARIANTES_HEROE) {
      for (const conArchivos of [true, false]) {
        const id = await crear(landingConHeroe(variante, conArchivos));
        await p2.goto(`${BASE}/editor/${id}`);
        const v = await veredicto(p2, "ok");
        comprobar(v === "ok", `héroe «${variante}» ${conArchivos ? "con imágenes" : "con marcadores"}: sin banner (veredicto ${v})`);
        comprobar(!(await p2.getByRole("button", { name: "Guardar en banco" }).isDisabled()), `héroe «${variante}»: el banco no se bloquea`);
      }
    }
    await c2.close();

    // ── Paso 4 de /crear: mismo banner con una respuesta simulada ──────
    const c3 = await navegador.newContext({ viewport: { width: 1280, height: 1000 }, reducedMotion: "reduce" });
    const p3 = await c3.newPage();
    const resultado = {
      tipo: "resultado",
      doc: landingSplit(),
      salud: [{ id: "esquema", estado: "verde", problemas: [] }],
      vueltasCritico: 1,
      proveedores: { landing: "gemini" },
      avisos: [],
      proveedorLanding: "gemini",
    };
    await p3.route("**/api/construir", (ruta) =>
      ruta.fulfill({ status: 200, contentType: "application/x-ndjson", body: JSON.stringify(resultado) + "\n" }),
    );
    await p3.goto(`${BASE}/crear?modo=experto`);
    await p3.getByRole("button", { name: "Rellenar ejemplo" }).click();
    for (let i = 0; i < 2; i++) {
      await p3.getByRole("button", { name: /^(Elegir mis técnicas|Armar mi prompt|Ir a construir mi landing)$/ }).click();
      await p3.waitForTimeout(400);
    }
    await p3.getByRole("button", { name: "Construir", exact: true }).click();
    await p3.locator("[data-banner-anti-split]").waitFor({ timeout: 20_000 });
    comprobar(true, "el paso 4 de /crear muestra el banner «Héroe split detectado»");
    await p3.locator("[data-banner-anti-split]").scrollIntoViewIfNeeded();
    await p3.screenshot({ path: join(SALIDA, "antisplit-banner-crear-paso4-1280.png") });
    await c3.close();
  } finally {
    await navegador.close();
  }
  console.log("\nAnti-split (render): OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
