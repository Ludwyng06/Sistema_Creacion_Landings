// Aceptación 14-B en el editor: el modal ofrece las secciones nuevas con miniatura, el marcador dice «Imagen pendiente»
// con «Buscar en bancos» y abre la búsqueda del inspector, y se elige una imagen de un banco real.
// Uso: PUERTO=3114 npx tsx tests/e2e/dia14-editor.ts
import { chromium } from "playwright";
import { combinar } from "@/lib/tecnicas/combinador";
import { landingEjemplo } from "../fixtures/landing-ejemplo";
import { briefCorrector } from "../tecnicas/briefs";

const BASE = `http://localhost:${process.env.PUERTO ?? "3000"}`;

function comprobar(condicion: unknown, mensaje: string): asserts condicion {
  if (!condicion) throw new Error(`FALLA: ${mensaje}`);
  console.log(`ok · ${mensaje}`);
}

async function main() {
  const doc = structuredClone(landingEjemplo);
  doc.meta.slug = `e2e-14b-${Date.now()}`;
  doc.meta.nombre = "Editor 14-B";
  const r = await fetch(`${BASE}/api/landings`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brief: briefCorrector, tecnicas: ["semilla"], prompt: combinar(briefCorrector, []), doc, proveedor: "manual" }) });
  comprobar(r.status === 201, "landing creada");
  const { id } = (await r.json()) as { id: string };
  const navegador = await chromium.launch({ channel: "msedge" });
  const errores: string[] = [];
  try {
    const ctx = await navegador.newContext({ viewport: { width: 1440, height: 800 } });
    await ctx.addInitScript("window.__name = (f) => f;");
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errores.push(e.message));
    p.on("console", (m) => m.type() === "error" && errores.push(m.text()));
    await p.goto(`${BASE}/editor/${id}`, { waitUntil: "domcontentloaded" });
    const marco = p.frameLocator("iframe[title^='Vista previa']");
    await marco.locator("[data-seccion-id]").first().waitFor({ timeout: 60_000 });

    await p.locator("[data-anadir-seccion]").click();
    const modal = p.locator("[data-modal-agregar]");
    await modal.waitFor();
    for (const [tipo, n] of [["para-quien", 2], ["mecanismo", 3], ["historia", 2], ["resumen", 2], ["escena-uso", 2]] as const) {
      comprobar((await modal.locator(`[data-agregar='${tipo}']`).count()) === n, `el modal ofrece ${tipo} con ${n} variantes`);
    }
    await modal.getByRole("button", { name: "Persuasión" }).click();
    comprobar((await modal.locator("[data-agregar='historia']").count()) === 2, "la categoría Persuasión trae Historia");
    await modal.locator("[data-agregar='escena-uso']").first().waitFor({ state: "detached" });
    await modal.getByRole("button", { name: "Todas" }).click();
    await modal.locator("[data-agregar='escena-uso'][data-variante='mosaico-3']").click();
    await modal.waitFor({ state: "detached" });
    comprobar((await p.locator("[data-inspector='seccion'] > header h2").textContent())?.includes("Escena de uso"), "elegir una variante añade la sección nueva");

    // El marcador dice «Imagen pendiente» y ofrece «Buscar en bancos» solo en el editor.
    const escena = marco.locator("[data-tipo='escena-uso']");
    await escena.scrollIntoViewIfNeeded();
    const marcador = escena.locator("[data-marcador-slot]").first();
    await marcador.waitFor();
    comprobar(/imagen pendiente/i.test((await marcador.textContent()) ?? ""), "el marcador dice «Imagen pendiente»");
    comprobar(!/grok/i.test((await escena.textContent()) ?? ""), "sin menciones a Grok en la vista");
    await marcador.getByRole("button", { name: "Buscar en bancos" }).click();
    const buscador = p.locator("[data-buscador-bancos]");
    await buscador.waitFor({ timeout: 10_000 });
    comprobar(true, "el botón abre la búsqueda de bancos del inspector");
    await buscador.getByRole("button", { name: "Buscar", exact: true }).click();
    await buscador.locator("[data-medio]").first().waitFor();
    const real = await buscador.locator("[data-medio]").count();
    comprobar(real > 0, `la búsqueda trae imágenes (${real})`);
    await buscador.locator("[data-medio]").first().click();
    await escena.locator("img").first().waitFor({ timeout: 15_000 });
    comprobar(true, "la imagen elegida aparece en la vista previa");
    await ctx.close();
  } finally {
    await navegador.close();
  }
  const graves = errores.filter((e) => !/favicon|Failed to load resource|React DevTools/i.test(e));
  comprobar(graves.length === 0, `sin errores de consola (${graves.slice(0, 1).map((x) => x.slice(0, 300)).join("") || "0"})`);
  console.log("dia14-editor: TODO OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
