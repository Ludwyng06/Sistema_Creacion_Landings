import { existsSync } from "node:fs";
import { chromium } from "playwright";

/** Comprueba que hay navegador. La base de prueba se prepara al cargar playwright.config.ts (antes del servidor). */
export default function globalSetup() {
  const canal = process.env.E2E_CANAL;
  if (!canal && !existsSync(chromium.executablePath())) {
    throw new Error(
      [
        "Falta el navegador de Playwright para las pruebas e2e.",
        "  1) Instálalo una vez:  npx playwright install chromium",
        "  2) Si la descarga falla (red o CDN), usa un navegador que ya tengas:",
        "       PowerShell:  $env:E2E_CANAL='msedge'; npm run e2e      (o 'chrome')",
        "       Bash:        E2E_CANAL=msedge npm run e2e",
      ].join("\n"),
    );
  }
}
