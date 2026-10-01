// Aceptación 09-B §3: «Empieza con una foto» con `POST /api/investigar` simulado (forma de 09-A §5).
// Uso: PUERTO=3109 npx tsx tests/e2e/dia9-foto.ts   → capturas en docs/bitacora/capturas/dia9B/
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const BASE = `http://localhost:${process.env.PUERTO ?? "3000"}`;
const SALIDA = join(process.cwd(), "..", "docs", "bitacora", "capturas", "dia9B");
const fuente = (sitio: string) => [{ url: `https://${sitio}/nota`, sitio }];
const RESPUESTA = {
  sugerencias: { beneficios: [], objeciones: [], preguntas: [] },
  consultas: ["corrector de postura beneficios"],
  usadas: 3,
    cuota: { usadasMes: 3, limiteMes: 250 },
    avisos: [],
  identificacion: { reconocido: true, tipoProducto: "corrector de postura", confianza: 0.9 },
  borrador: {
    categoria: { valor: "salud-y-bienestar", fuentes: fuente("saludtotal.co"), confianza: 0.9 },
    problema: { valor: "Pasas horas sentado y la espalda te pasa factura", fuentes: fuente("foro.co"), confianza: 0.6 },
    publico: { valor: "Personas que trabajan frente a un computador", fuentes: fuente("bienestar.co"), confianza: 0.4 },
    beneficios: { valor: ["Ayuda a mantener la espalda recta", "Se lleva bajo la ropa", "Dura 8 horas con una carga"], fuentes: [...fuente("saludtotal.co"), ...fuente("tecnoresenas.com")], confianza: 0.8 },
    objeciones: { valor: ["¿Incomoda al sentarse?"], fuentes: fuente("foro.co"), confianza: 0.7 },
    nivelConciencia: { valor: "solucion", fuentes: [], confianza: 0.5, motivo: "Comparan opciones antes de comprar." },
    coloresMarca: { valor: ["#2f4858", "#c8553d", "#e9d8a6"], fuentes: [], confianza: 0.9 },
  },
  precioReferencia: { min: 90000, max: 150000, fuentes: fuente("tienda.co") },
};
// PNG 1x1 válido.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

const REAL = Boolean(process.env.REAL);
const MOTOR = process.env.MOTOR ?? "http://localhost:3110";

let fallas = 0;
function ok(c: boolean, m: string) {
  console.log(`${c ? "ok  " : "FALLA"} · ${m}`);
  if (!c) fallas++;
}

async function main() {
  mkdirSync(SALIDA, { recursive: true });
  const foto = join(process.cwd(), "tests", "e2e", "foto-prueba.png");
  writeFileSync(foto, PNG); // se borra al terminar
  const navegador = await chromium.launch({ channel: "msedge" });
  try {
    for (const [ancho, alto] of [[390, 844], [1280, 800]] as const) {
      const ctx = await navegador.newContext({ viewport: { width: ancho, height: alto } });
      const p = await ctx.newPage();
      const errores: string[] = [];
      p.on("pageerror", (e) => errores.push(e.message));
      await p.route("**/api/investigar", async (r) => {
        if (REAL) {
          // API real de A: un next dev de la rama motor (MOTOR=http://localhost:3110); esta página sigue siendo la de B.
          const real = await r.fetch({ url: `${MOTOR}/api/investigar` });
          console.log(`REAL · status ${real.status()} · ${(await real.text()).slice(0, 300)}`);
          await r.fulfill({ response: real });
          return;
        }
        await new Promise((res) => setTimeout(res, 2500));
        await r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(RESPUESTA) });
      });
      await p.goto(`${BASE}/crear?modo=experto`, { waitUntil: "load" });
      await p.evaluate(() => sessionStorage.clear());
      await p.reload({ waitUntil: "load" });
      await p.getByLabel("Foto del producto").setInputFiles(foto);
      await p.locator("[data-vista-foto]").waitFor();
      await p.getByLabel("¿Cómo se llama tu producto?").fill("Corrector de postura inteligente");
      await p.locator("[data-tarjeta-foto]").screenshot({ path: join(SALIDA, `foto-tarjeta-${ancho}.png`) });
      await p.getByRole("button", { name: "Llenar el brief con lo que encuentre" }).click();
      await p.waitForFunction(() => document.querySelector("[data-pasos-foto]")?.textContent?.includes("Reconociendo"));
      ok(true, `@${ancho} paso «Reconociendo el producto en la foto…»`);
      await p.waitForFunction(() => document.querySelector("[data-pasos-foto]")?.textContent?.includes("Buscando en Google"));
      ok(true, `@${ancho} paso «Buscando en Google (x de 3)…»`);
      await p.locator("[data-sugerido='problema']").waitFor();
      ok((await p.locator("[data-estado='pendiente']").count()) >= 5, `@${ancho} campos marcados Sugerido`);
      const bloqueado = await p.locator("#motivo-bloqueo").textContent();
      ok((bloqueado ?? "").includes("Revisa lo sugerido"), `@${ancho} no avanza con campos sin revisar`);
      ok((await p.locator("[data-precio-referencia]").count()) === (REAL ? await p.locator("[data-precio-referencia]").count() : 1), `@${ancho} precioReferencia informativo`);
      ok((await p.locator("#brief-precio").inputValue()) === "", `@${ancho} el precio queda vacío`);
      ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `@${ancho} sin desborde horizontal`);
      await p.locator("[data-tarjeta-foto]").screenshot({ path: join(SALIDA, `foto-resultado-${ancho}.png`) });
      await p.locator("[data-sugerido='beneficios']").scrollIntoViewIfNeeded();
      await p.screenshot({ path: join(SALIDA, `brief-prellenado-${ancho}.png`), fullPage: true });
      if (!REAL) await p.locator("[data-precio-referencia]").locator("xpath=..").screenshot({ path: join(SALIDA, `nota-precio-${ancho}.png`) });
      await p.getByRole("button", { name: "Aceptar todo lo sugerido" }).click();
      ok((await p.locator("[data-estado='pendiente']").count()) === 0, `@${ancho} Aceptar todo lo sugerido`);
      ok(errores.length === 0, `@${ancho} sin errores de página ${errores.join(" | ")}`);
      await ctx.close();
    }
  } finally {
    await navegador.close();
  }
  rmSync(foto, { force: true });
  console.log(fallas ? `${fallas} fallas` : "Empieza con una foto: OK");
  if (fallas) process.exit(1);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
