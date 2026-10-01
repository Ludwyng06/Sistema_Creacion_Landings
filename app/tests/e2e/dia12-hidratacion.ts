// Aceptación 12-B §0: /crear sin errores de hidratación y el formulario de /l/<slug> conserva lo escrito antes de hidratar.
// Uso: PUERTO=3112 npx tsx tests/e2e/dia12-hidratacion.ts   (con el servidor encendido)
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
  doc.meta.slug = `e2e-hidr-${Date.now()}`;
  doc.meta.nombre = "Prueba hidratación 12-B";
  const r = await fetch(`${BASE}/api/landings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ brief: briefCorrector, tecnicas: ["semilla"], prompt: combinar(briefCorrector, []), doc, proveedor: "manual" }),
  });
  comprobar(r.status === 201, `POST /api/landings → 201 (fue ${r.status})`);
  const { slug } = (await r.json()) as { id: string; slug: string };

  const navegador = await chromium.launch({ channel: "msedge" });
  try {
    // 1. /crear: ningún error de consola de hidratación.
    const ctx1 = await navegador.newContext({ viewport: { width: 390, height: 844 } });
    const p1 = await ctx1.newPage();
    const consola: string[] = [];
    p1.on("console", (m) => m.type() === "error" && consola.push(m.text()));
    p1.on("pageerror", (e) => consola.push(e.message));
    await p1.goto(`${BASE}/crear`, { waitUntil: "networkidle" });
    const hidratacion = consola.filter((t) => /hydrat|cannot be a descendant|validateDOMNesting/i.test(t));
    comprobar(hidratacion.length === 0, `/crear sin errores de hidratación (${hidratacion.join(" | ") || "0"})`);
    await ctx1.close();

    // 2. /l/<slug>: se escribe con el HTML del servidor, sin JavaScript, y luego se deja hidratar.
    const ctx2 = await navegador.newContext({ viewport: { width: 390, height: 844 } });
    const p2 = await ctx2.newPage();
    let liberar: () => void = () => {};
    const puerta = new Promise<void>((res) => (liberar = res));
    await p2.route("**/_next/static/**/*.js", async (ruta) => {
      await puerta;
      await ruta.continue();
    });
    await p2.goto(`${BASE}/l/${slug}`, { waitUntil: "commit" });
    const nombre = p2.locator("input[name='nombre']");
    await nombre.waitFor({ state: "attached", timeout: 30_000 });
    await nombre.scrollIntoViewIfNeeded();
    await nombre.fill("Ana Torres");
    await p2.locator("input[name='correo']").fill("ana@correo.co");
    await p2.locator("input[name='telefono']").fill("3001234567");
    liberar();
    await p2.waitForLoadState("networkidle");
    comprobar((await nombre.inputValue()) === "Ana Torres", "el nombre escrito antes de hidratar sigue ahí");
    const envio = p2.waitForResponse((res) => res.url().endsWith("/api/leads") && res.request().method() === "POST");
    await p2.getByRole("button", { name: /quiero el mío/i }).click();
    const respuesta = await envio;
    comprobar(respuesta.status() === 201 || respuesta.status() === 200, `el lead se envía (${respuesta.status()})`);
    await ctx2.close();
  } finally {
    await navegador.close();
  }
  console.log("dia12-hidratacion: TODO OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
