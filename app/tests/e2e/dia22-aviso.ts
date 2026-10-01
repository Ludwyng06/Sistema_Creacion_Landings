// Aceptación 22-B · generación a medias: /crear y el visor avisan con tono amable y ofrecen «Reintentar el crítico» sin perder la landing.
// `POST /api/generar` y el crítico (`GET`/`POST /api/landings/[id]/critico`, 20-A) se simulan dentro de la página con la forma real de A
// (evento `listo` con `criticoPendiente` y `seccionesPorCompletar`; 503 sin cupo), porque la prueba no gasta cuota de IA.
// Uso: PUERTO=3115 npx tsx tests/e2e/dia22-aviso.ts   (capturas en docs/bitacora/capturas/dia22B/)
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { combinar } from "@/lib/tecnicas/combinador";
import { landingEjemplo } from "../fixtures/landing-ejemplo";
import { briefCorrector } from "../tecnicas/briefs";

const BASE = `http://localhost:${process.env.PUERTO ?? "3000"}`;
const SALIDA = join(process.cwd(), "..", "docs", "bitacora", "capturas", "dia22B");
mkdirSync(SALIDA, { recursive: true });

function comprobar(condicion: unknown, mensaje: string): asserts condicion {
  if (!condicion) throw new Error(`FALLA: ${mensaje}`);
  console.log(`ok · ${mensaje}`);
}

async function main() {
  // Una landing guardada sin informe del crítico: lo que deja una generación sin cuota.
  const doc = structuredClone(landingEjemplo);
  doc.meta.slug = `e2e22-sin-critico-${Date.now()}`;
  doc.meta.nombre = "Aviso sin crítico";
  delete doc.critica;
  const r = await fetch(`${BASE}/api/landings`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brief: briefCorrector, tecnicas: ["semilla"], prompt: combinar(briefCorrector, []), doc, proveedor: "manual" }) });
  comprobar(r.status === 201, "landing sin crítico creada");
  const { id } = (await r.json()) as { id: string };

  const navegador = await chromium.launch({ channel: process.env.E2E_CANAL ?? "msedge" });
  const errores: string[] = [];
  try {
    for (const [ancho, alto] of [[1440, 900], [390, 844]] as const) {
      const ctx = await navegador.newContext({ viewport: { width: ancho, height: alto } });
      await ctx.addInitScript("window.__name = (f) => f;");
      const p = await ctx.newPage();
      p.on("pageerror", (e) => errores.push(e.message));
      let intentos = 0;
      await p.route("**/api/generar", (ruta) =>
        ruta.fulfill({
          status: 200,
          contentType: "application/x-ndjson",
          body: [
            { tipo: "etapa", etapa: "intake", mensaje: "Entendiendo tu idea…" },
            { tipo: "etapa", etapa: "critico", mensaje: "Revisando como director creativo…" },
            { tipo: "listo", id, criticoPendiente: true, seccionesPorCompletar: ["faq", "oferta"] },
          ].map((e) => JSON.stringify(e)).join("\n") + "\n",
        }),
      );
      // GET devuelve el estado simulado; el primer POST falla por falta de cupo (503) y el segundo deja el informe.
      const estado = { criticoPendiente: true, etapa: "critico" as string | null, seccionesPorCompletar: ["faq", "oferta"] as string[] };
      await p.route(`**/api/landings/${id}/critico`, async (ruta) => {
        if (ruta.request().method() === "GET") return ruta.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...estado, puntaje: null, avisos: [] }) });
        intentos += 1;
        if (intentos === 1) return ruta.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Ningún proveedor tiene cupo.", intentos: [], promptManual: "" }) });
        estado.criticoPendiente = false;
        return ruta.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ landing: { id }, puntaje: 8.1, bajoUmbral: false }) });
      });

      // ── /crear ──
      await p.goto(`${BASE}/crear`, { waitUntil: "load" });
      await p.waitForTimeout(800);
      await p.getByLabel("¿Qué landing quieres?").fill("Landing para una agencia de tours de auroras");
      await p.getByRole("button", { name: "Crear mi landing" }).click();
      await p.locator("[data-aviso-generacion]").waitFor({ timeout: 20_000 });
      comprobar(p.url().includes("/crear"), `${ancho}: con la generación a medias se queda en /crear`);
      const texto = (await p.locator("[data-aviso-generacion]").innerText()).replace(/\s+/g, " ");
      comprobar(/guardada/.test(texto) && /2 secciones quedaron por completar/.test(texto), `${ancho}: el aviso es amable y dice cuántas secciones faltan`);
      comprobar(!/error|falló|fallo/i.test(texto), `${ancho}: el aviso no asusta`);
      comprobar((await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)), `${ancho}: /crear sin scroll horizontal`);
      await p.screenshot({ path: join(SALIDA, `crear-aviso-${ancho}.png`) });

      await p.getByRole("button", { name: "Reintentar el crítico" }).click();
      await p.locator("[data-aviso-generacion] [role=alert]").waitFor();
      comprobar(/Todavía no hay cupo/.test(await p.locator("[data-aviso-generacion] [role=alert]").innerText()), `${ancho}: si falla, muestra el motivo y la landing sigue ahí`);
      comprobar(p.url().includes("/crear") && (await p.getByRole("button", { name: "Reintentar el crítico" }).isEnabled()), `${ancho}: se puede volver a intentar`);
      await p.getByRole("button", { name: "Reintentar el crítico" }).click();
      await p.waitForURL(new RegExp(`/ver/${id}`), { timeout: 20_000 });
      comprobar(true, `${ancho}: al funcionar, abre el visor`);
      // El crítico ya revisó: el aviso de «crítico» desaparece y quedan solo las secciones por completar.
      await p.locator("[data-panel-entrega]").waitFor({ timeout: 30_000 });
      await p.locator("[data-aviso-generacion]").waitFor({ timeout: 20_000 });
      comprobar((await p.getByRole("button", { name: "Reintentar el crítico" }).count()) === 0, `${ancho}: ya con informe, el visor no ofrece reintentar`);
      comprobar((await p.locator("[data-aviso-generacion]").count()) === 1, `${ancho}: el visor sigue avisando de las 2 secciones por completar`);
      await p.screenshot({ path: join(SALIDA, `visor-secciones-${ancho}.png`) });

      // ── Visor de una landing generada con el crítico pendiente ──
      estado.criticoPendiente = true;
      estado.seccionesPorCompletar = [];
      intentos = 1; // el siguiente reintento sale bien
      await p.goto(`${BASE}/ver/${id}`, { waitUntil: "load" });
      await p.locator("[data-aviso-generacion]").waitFor({ timeout: 30_000 });
      comprobar((await p.locator("[data-aviso-generacion]").innerText()).includes("falta la revisión del crítico"), `${ancho}: visor avisa que falta el crítico`);
      comprobar((await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)), `${ancho}: visor sin scroll horizontal`);
      await p.screenshot({ path: join(SALIDA, `visor-critico-${ancho}.png`) });
      await p.getByRole("button", { name: "Reintentar el crítico" }).click();
      await p.locator("[data-aviso-generacion]").waitFor({ state: "detached", timeout: 20_000 });
      comprobar(true, `${ancho}: tras reintentar, el visor se actualiza y el aviso desaparece`);
      // Una landing que no salió del generador (manual, semilla) no trae etapa: no hay aviso.
      estado.etapa = null;
      await p.goto(`${BASE}/ver/${id}`, { waitUntil: "load" });
      await p.locator("[data-panel-entrega]").waitFor({ timeout: 30_000 });
      await p.waitForTimeout(1500);
      comprobar((await p.getByRole("button", { name: "Reintentar el crítico" }).count()) === 0, `${ancho}: las landings manuales no ofrecen reintentar el crítico`);
      await ctx.close();
    }
    comprobar(errores.length === 0, `sin errores de página (${errores.join(" | ")})`);
  } finally {
    await navegador.close();
    await fetch(`${BASE}/api/landings/${id}`, { method: "DELETE" });
  }
  console.log("\n22-B aviso: OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
