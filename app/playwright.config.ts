import { execFileSync } from "node:child_process";
import { defineConfig } from "playwright/test";
import { prepararBase } from "./e2e/preparar-base";

// Pruebas de punta a punta (npm run e2e). NO entran en `npm run verificar`.
// Levantan `npm run dev` en un puerto libre con su propia base SQLite y sin claves de IA
// (así el flujo usa el modo manual con un LandingDoc de prueba).

function puertoLibre(): number {
  if (process.env.E2E_PUERTO) return Number(process.env.E2E_PUERTO);
  const script = "const s=require('net').createServer();s.listen(0,()=>{console.log(s.address().port);s.close()})";
  return Number(execFileSync(process.execPath, ["-e", script], { encoding: "utf8" }).trim());
}

// El puerto se calcula una vez y se comparte con globalSetup y los tests por variable de entorno.
process.env.E2E_PUERTO ??= String(puertoLibre());
const puerto = Number(process.env.E2E_PUERTO);
// La base se prepara una sola vez, en el proceso principal y antes de que arranque el servidor; los workers heredan la marca.
if (!process.env.E2E_BASE_LISTA) {
  prepararBase();
  process.env.E2E_BASE_LISTA = "1";
}

export const URL_E2E = `http://localhost:${puerto}`;
export const BASE_E2E = "file:./e2e-test.db";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: URL_E2E,
    // E2E_CANAL=msedge (o chrome) usa el navegador ya instalado en vez de descargar Chromium.
    channel: process.env.E2E_CANAL || undefined,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npm run dev -- -p ${puerto}`,
    url: URL_E2E,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      DATABASE_URL: BASE_E2E,
      GEMINI_API_KEY: "",
      GROQ_API_KEY: "",
      CEREBRAS_API_KEY: "",
      OPENROUTER_API_KEY: "",
      IA_CACHE: "0",
    },
  },
});
