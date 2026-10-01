import { describe, expect, it } from "vitest";
import { esLandingDePrueba } from "../../scripts/limpiar-pruebas";

describe("limpiar:pruebas · qué cuenta como prueba", () => {
  it("borra lo de los e2e y las capturas", () => {
    for (const slug of ["e2e-editor-1790781692647", "e2e20-buena-1", "cap14-con-imagen-1", "demo-12b-1", "split-1790725135787", "heroe-poster-a-sangre-img-1790725212560", "una-noche-de-observacion-de-la-lluvia-de-muoitopy"]) {
      expect(esLandingDePrueba({ slug, proveedor: "manual" }), slug).toBe(true);
    }
  });
  it("no toca la vitrina ni lo creado por IA", () => {
    expect(esLandingDePrueba({ slug: "timbre-inteligente-vitrina", proveedor: "gemini" })).toBe(false);
    expect(esLandingDePrueba({ slug: "e2e-x", proveedor: "gemini" })).toBe(false);
    expect(esLandingDePrueba({ slug: "e2e-vitrina", proveedor: "manual" })).toBe(false);
    expect(esLandingDePrueba({ slug: "mi-tienda-de-velas", proveedor: "manual" })).toBe(false);
  });
});
