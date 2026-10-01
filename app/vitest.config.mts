import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      // Las secciones cargan por tipo en la app; en los tests se importan directo para renderizar sin esperar.
      { find: /^@\/secciones\/componentes$/, replacement: fileURLToPath(new URL("./src/secciones/componentes-sync.ts", import.meta.url)) },
      { find: /^@\/efectos\/nivel3\/envolturas$/, replacement: fileURLToPath(new URL("./src/efectos/nivel3/envolturas-sync.ts", import.meta.url)) },
      { find: "@", replacement: fileURLToPath(new URL("./src", import.meta.url)) },
    ],
  },
  // Los tests de componentes (.tsx) declaran `// @vitest-environment jsdom` en su cabecera.
  test: {
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
    // Crea una vez la base SQLite de plantilla que copian los tests con base de datos.
    globalSetup: ["./tests/global-setup.ts"],
  },
});
