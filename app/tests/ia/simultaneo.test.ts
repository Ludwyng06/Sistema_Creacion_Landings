import { describe, expect, it } from "vitest";
import { z } from "zod";
import { TABLA_TAREAS_POR_DEFECTO, ejecutar } from "@/lib/ia/enrutador";
import type { ProveedorId, ProveedorIA, RegistradorUso } from "@/lib/ia/tipos";

const esquema = z.object({ ok: z.boolean() });
const registrarUso: RegistradorUso = async () => {};

const proveedor = (id: ProveedorId): ProveedorIA => ({
  id,
  disponible: () => true,
  async generarJSON() {
    return { datos: { ok: true } as never, proveedor: id, modelo: "m", ms: 1 };
  },
});
const todos = () => (["gemini", "cerebras", "groq", "openrouter"] as const).map(proveedor);
const base = { sistema: "s", usuario: "u", esquema };

describe("enrutador · modo simultáneo", () => {
  it("la tabla por defecto sigue docs/07 §5", () => {
    expect(TABLA_TAREAS_POR_DEFECTO).toEqual({
      objeciones: "cerebras",
      landing: "cerebras",
      "prompts-grok": "cerebras",
      "corregir-lista-negra": "cerebras",
      humanizar: "cerebras",
      critico: "cerebras",
      "mejorar-prompt": "cerebras",
      "juez-duelo": "groq",
      investigar: "groq",
      "identificar-producto": "gemini",
      "describir-medio": "groq",
      "dato-curioso": "groq",
      estrategia: "cerebras",
      "plan-secciones": "cerebras",
      "redactar-seccion": "cerebras",
      "prompts-imagen": "cerebras",
      "validar-imagen": "gemini",
      intake: "cerebras",
    });
  });

  it("pone primero al proveedor preferido de la tarea, luego el resto de la cascada", async () => {
    const r = await ejecutar({ tarea: "humanizar", ...base }, { proveedores: todos(), registrarUso, modo: "simultaneo", tablaTareas: TABLA_TAREAS_POR_DEFECTO });
    expect(r.proveedor).toBe("cerebras");
  });

  it("si el preferido falla, sigue con el orden de la cascada", async () => {
    const proveedores = todos();
    proveedores[1] = { ...proveedores[1], generarJSON: async () => { throw new (await import("@/lib/ia/tipos")).ErrorIA("limite", "sin cuota"); } };
    const r = await ejecutar({ tarea: "humanizar", ...base }, { proveedores, registrarUso, modo: "simultaneo", tablaTareas: TABLA_TAREAS_POR_DEFECTO });
    expect(r.proveedor).toBe("gemini"); // cerebras falla → primero de la cascada
  });

  it("la tabla inyectada manda; un preferido sin clave se ignora", async () => {
    const soloGemini = [proveedor("gemini"), proveedor("groq")];
    const a = await ejecutar({ tarea: "landing", ...base }, { proveedores: soloGemini, registrarUso, modo: "simultaneo", tablaTareas: { landing: "groq" } });
    expect(a.proveedor).toBe("groq");
    const b = await ejecutar({ tarea: "humanizar", ...base }, { proveedores: soloGemini, registrarUso, modo: "simultaneo", tablaTareas: TABLA_TAREAS_POR_DEFECTO });
    expect(b.proveedor).toBe("gemini");
  });

  it("en modo cascada el orden es el de siempre", async () => {
    const r = await ejecutar({ tarea: "humanizar", ...base }, { proveedores: todos(), registrarUso, modo: "cascada", tablaTareas: TABLA_TAREAS_POR_DEFECTO });
    expect(r.proveedor).toBe("gemini");
  });

  it("`evitar` deja al proveedor al final, en ambos modos", async () => {
    for (const modo of ["cascada", "simultaneo"] as const) {
      const r = await ejecutar({ tarea: "landing", ...base, evitar: "gemini" }, { proveedores: todos(), registrarUso, modo, tablaTareas: TABLA_TAREAS_POR_DEFECTO });
      expect(r.proveedor, modo).not.toBe("gemini");
    }
    const solo = await ejecutar({ tarea: "landing", ...base, evitar: "gemini" }, { proveedores: [proveedor("gemini")], registrarUso, modo: "cascada" });
    expect(solo.proveedor).toBe("gemini");
  });
});
