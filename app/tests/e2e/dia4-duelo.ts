// Captura del duelo (docs/bitacora/capturas/dia4/duelo-1280.png) con respuestas simuladas:
// no gasta cuota de los proveedores. Uso: PUERTO=3111 npx tsx tests/e2e/dia4-duelo.ts
import { join } from "node:path";
import { chromium } from "playwright";
import { landingEjemplo } from "../fixtures/landing-ejemplo";

const BASE = `http://localhost:${process.env.PUERTO ?? "3000"}`;
const SALIDA = join(process.cwd(), "..", "docs", "bitacora", "capturas", "dia4");

const critica = (puntaje: number) => ({ puntaje, porCriterio: [], problemas: [], correcciones: [] });
const lado = (proveedor: string, nombre: string) => ({
  doc: { ...landingEjemplo, meta: { ...landingEjemplo.meta, nombre } },
  salud: [{ id: "esquema", estado: "verde", problemas: [] }],
  vueltasCritico: 1,
  proveedores: { landing: proveedor },
  avisos: [],
  proveedorLanding: proveedor,
});
const flujo = [
  { tipo: "tarea", tarea: "landing", estado: "ok", proveedor: "gemini", ms: 4000, lado: "a" },
  { tipo: "tarea", tarea: "landing", estado: "ok", proveedor: "groq", ms: 2500, lado: "b" },
  {
    tipo: "duelo",
    a: lado("gemini", "Versión de Gemini"),
    b: lado("groq", "Versión de Groq"),
    juez: { a: critica(7.4), b: critica(8.8), ganador: "b", razon: "La opción B tiene un titular más concreto." },
    ganador: "b",
    proveedores: { a: "gemini", b: "groq", juez: "cerebras" },
    avisos: [],
  },
];

async function main() {
  const navegador = await chromium.launch({ channel: "msedge" });
  try {
    const pagina = await (await navegador.newContext({ viewport: { width: 1280, height: 1000 }, reducedMotion: "reduce" })).newPage();
    await pagina.route("**/api/construir-duelo", (ruta) =>
      ruta.fulfill({ status: 200, contentType: "application/x-ndjson", body: flujo.map((e) => JSON.stringify(e)).join("\n") + "\n" }),
    );
    // La construcción normal no debe gastar cuota: se corta con un error simulado.
    await pagina.route("**/api/construir", (ruta) =>
      ruta.fulfill({ status: 200, contentType: "application/x-ndjson", body: JSON.stringify({ tipo: "error", mensaje: "simulado" }) + "\n" }),
    );
    await pagina.goto(`${BASE}/crear?modo=experto`);
    await pagina.getByRole("button", { name: "Rellenar ejemplo" }).click();
    for (let i = 0; i < 2; i++) {
      await pagina.getByRole("button", { name: /^(Elegir mis técnicas|Armar mi prompt|Ir a construir mi landing)$/ }).click();
      await pagina.waitForTimeout(400);
    }
    await pagina.getByRole("button", { name: "Construir", exact: true }).click();
    await pagina.getByRole("button", { name: "Construir en duelo" }).click();
    await pagina.locator("[data-razon-juez]").waitFor({ timeout: 15_000 });
    await pagina.waitForTimeout(1200);
    await pagina.locator("[data-panel-duelo]").scrollIntoViewIfNeeded();
    await pagina.screenshot({ path: join(SALIDA, "duelo-1280.png") });
    console.log("duelo-1280.png OK");
  } finally {
    await navegador.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
