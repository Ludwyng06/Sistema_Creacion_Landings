import sharp from "sharp";
import { describe, expect, it } from "vitest";
import type { ZodType } from "zod";
import { promptCritico } from "@/lib/ia/prompts/critico";
import type { ProveedorIA } from "@/lib/ia/tipos";
import { componerCaptura, criticarConCaptura } from "@/lib/vitrina/critico-visual";
import { docBase } from "../construccion/ayudas";

const png = (w: number, h: number) => sharp({ create: { width: w, height: h, channels: 3, background: "#224466" } }).png().toBuffer();
const critica = (puntaje: number) => ({ puntaje, porCriterio: [{ criterio: "Claridad en 3 s", puntaje, evidencia: "secciones[0].ajustes.titular" }], problemas: [], correcciones: [] });

function proveedores(opciones: { visionFalla?: boolean } = {}) {
  const vistas: { imagen: boolean; sistema: string }[] = [];
  const gemini = {
    id: "gemini",
    disponible: () => true,
    soportaImagen: true,
    async generarJSON<T>(p: { sistema: string; usuario: string; esquema: ZodType<T>; imagen?: unknown }) {
      vistas.push({ imagen: p.imagen !== undefined, sistema: p.usuario });
      if (p.imagen && opciones.visionFalla) throw new Error("Gemini sin cupo de visión");
      return { datos: p.esquema.parse(critica(p.imagen ? 9.1 : 8.4)), proveedor: "gemini" as const, modelo: "sim", ms: 1 };
    },
  } as ProveedorIA;
  const cerebras = {
    id: "cerebras",
    disponible: () => true,
    async generarJSON<T>(p: { usuario: string; esquema: ZodType<T>; imagen?: unknown }) {
      vistas.push({ imagen: false, sistema: p.usuario });
      return { datos: p.esquema.parse(critica(8.4)), proveedor: "cerebras" as const, modelo: "sim", ms: 1 };
    },
  } as ProveedorIA;
  return { vistas, deps: { proveedores: [cerebras, gemini], registrarUso: async () => {}, modo: "cascada" as const, tablaTareas: {}, config: {}, espera: async () => {} } };
}

describe("crítico multimodal", () => {
  it("con captura solo lo atiende Gemini (visión) y el prompt explica la captura; misma rúbrica", async () => {
    const { vistas, deps } = proveedores();
    const r = await criticarConCaptura(docBase(), "brief", await png(800, 450), deps);
    expect(r).toMatchObject({ vio: true, proveedor: "gemini" });
    expect(r.critica.puntaje).toBe(9.1);
    expect(vistas).toHaveLength(1);
    expect(vistas[0].imagen).toBe(true);
    expect(vistas[0].sistema).toContain("CAPTURA ADJUNTA");
    const p = promptCritico({ documento: {}, contextoBrief: "b", visual: true });
    expect(p.sistema).toContain("Claridad en 3 s (20 %)");
    expect(p.sistema).toContain("10 es una landing sin nada que corregir");
  });

  it("si la visión falla degrada a solo JSON con el mismo crítico y lo dice", async () => {
    const { vistas, deps } = proveedores({ visionFalla: true });
    const r = await criticarConCaptura(docBase(), "brief", await png(800, 450), deps);
    expect(r.vio).toBe(false);
    expect(r.motivoDegradado).toContain("sin visión");
    expect(r.critica.puntaje).toBe(8.4);
    expect(vistas.filter((v) => v.imagen)).toHaveLength(1);
    expect(vistas.at(-1)!.sistema).not.toContain("CAPTURA ADJUNTA");
  });

  it("sin captura (no hay navegador o la página no cargó) usa solo JSON", async () => {
    const { vistas, deps } = proveedores();
    const r = await criticarConCaptura(docBase(), "brief", null, deps);
    expect(r).toMatchObject({ vio: false, motivoDegradado: "sin captura" });
    expect(vistas.some((v) => v.imagen)).toBe(false);
  });

  it("compone escritorio y móvil en una sola imagen de 720 px de alto", async () => {
    const jpg = await componerCaptura(await png(1280, 720), await png(390, 844));
    const m = await sharp(jpg).metadata();
    expect(m.height).toBe(720);
    expect(m.width).toBeGreaterThan(1280 + 300);
    expect(m.format).toBe("jpeg");
  });
});
