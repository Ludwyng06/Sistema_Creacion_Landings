import { describe, expect, it, vi } from "vitest";
import { crearProveedorCompatible } from "@/lib/ia/openai-compat";
import type { ProveedorIA } from "@/lib/ia/tipos";
import groq429Tpd from "../ia/fixtures/groq-429-tpd.json";
import { briefCorrector, crearProveedores, manejadorBase, peticion } from "./ayudas";
import { construir } from "@/lib/ia/construir";
import type { EventoConstruccion } from "@/lib/contratos";

// Respuesta grabada (sin claves) del 429 por tokens por día (TPD) de Groq: reinicio en ~15 min. La cascada debe pasar a Gemini
// sola y la construcción de /crear debe terminar bien, sin eventos de error ni el panel manual.

const groqSinCupoDiario = (): { proveedor: ProveedorIA; fetchFn: ReturnType<typeof vi.fn> } => {
  const fetchFn = vi.fn(async () => new Response(JSON.stringify(groq429Tpd), { status: 429, headers: { "Content-Type": "application/json" } }));
  const proveedor = crearProveedorCompatible({
    id: "groq",
    baseUrl: "https://x.test/v1",
    clave: "clave-secreta-123456",
    modelo: "openai/gpt-oss-120b",
    fetchFn: fetchFn as unknown as typeof fetch,
  });
  return { proveedor, fetchFn };
};

describe("Groq sin cupo diario (TPD): la construcción pasa a Gemini", () => {
  for (const modo of ["cascada", "simultaneo"] as const) {
    it(`modo ${modo}: la landing termina con Gemini, sin errores en la UI y sin esperar los 15 min`, async () => {
      const groq = groqSinCupoDiario();
      const { proveedores: [gemini] } = crearProveedores(["gemini"], manejadorBase());
      const esperas: number[] = [];
      const eventos: EventoConstruccion[] = [];
      await construir(peticion({ brief: briefCorrector }), (e) => eventos.push(e), {
        enrutador: {
          proveedores: [groq.proveedor, gemini],
          registrarUso: async () => {},
          modo,
          tablaTareas: {},
          espera: async (ms) => void esperas.push(ms),
        },
      });
      const resultado = eventos.find((e) => e.tipo === "resultado");
      expect(resultado).toBeDefined();
      expect(eventos.some((e) => e.tipo === "error" || e.tipo === "manual")).toBe(false);
      expect(eventos.filter((e) => e.tipo === "tarea").some((e) => e.estado === "error" && e.tarea === "landing")).toBe(false);
      expect(resultado && "proveedores" in resultado ? resultado.proveedores : {}).toMatchObject({ landing: "gemini" });
      expect(Math.max(0, ...esperas)).toBeLessThanOrEqual(60_000); // el TPD (14m58s) no se espera
    });
  }

  it("con Groq primero en la tabla de tareas, Gemini toma la landing", async () => {
    const groq = groqSinCupoDiario();
    const { proveedores: [gemini] } = crearProveedores(["gemini"], manejadorBase());
    const eventos: EventoConstruccion[] = [];
    await construir(peticion(), (e) => eventos.push(e), {
      enrutador: { proveedores: [groq.proveedor, gemini], registrarUso: async () => {}, modo: "cascada", tablaTareas: { landing: "groq" }, espera: async () => {} },
    });
    expect(eventos.find((e) => e.tipo === "resultado")).toBeDefined();
    expect(eventos.some((e) => e.tipo === "error" || e.tipo === "manual")).toBe(false);
  });
});
