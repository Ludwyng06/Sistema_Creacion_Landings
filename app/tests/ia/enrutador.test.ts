import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ejecutar } from "@/lib/ia/enrutador";
import {
  ErrorCascadaAgotada,
  ErrorIA,
  type ProveedorId,
  type ProveedorIA,
  type RegistradorUso,
  type TipoErrorIA,
} from "@/lib/ia/tipos";

const esquema = z.object({ titulo: z.string() });
const base = { tarea: "landing" as const, sistema: "SISTEMA", usuario: "USUARIO", esquema };

type Paso = TipoErrorIA | { titulo: string };

/** Proveedor simulado: cada llamada consume un paso (error o respuesta). */
function simulado(id: ProveedorId, pasos: Paso[]) {
  const usuarios: string[] = [];
  const proveedor: ProveedorIA = {
    id,
    disponible: () => true,
    async generarJSON<T>(p: { usuario: string }) {
      usuarios.push(p.usuario);
      const paso = pasos[usuarios.length - 1] ?? "red";
      if (typeof paso === "string") throw new ErrorIA(paso, `${id} falló: ${paso}`);
      return { datos: paso as T, proveedor: id, modelo: `${id}-m`, ms: 5 };
    },
  };
  return { proveedor, usuarios };
}

function registrador() {
  const registrarUso = vi.fn<RegistradorUso>(async () => {});
  return { registrarUso, espera: async () => {} }; // sin esperas reales en el reintento por límite
}

describe("enrutador · cascada", () => {
  it("Gemini con límite → responde Groq", async () => {
    const gemini = simulado("gemini", ["limite", "limite"]);
    const groq = simulado("groq", [{ titulo: "desde groq" }]);
    const r = await ejecutar(base, { proveedores: [gemini.proveedor, groq.proveedor], ...registrador() });
    expect(r.proveedor).toBe("groq");
    expect(r.datos).toEqual({ titulo: "desde groq" });
    expect(gemini.usuarios).toHaveLength(2); // límite: 1 reintento con espera y luego pasa al siguiente
  });

  it("503 o 429 transitorio → un reintento con espera y responde el mismo proveedor", async () => {
    const espera = vi.fn(async () => {});
    const gemini = simulado("gemini", ["limite", { titulo: "ya respondió" }]);
    const groq = simulado("groq", [{ titulo: "no debería usarse" }]);
    const r = await ejecutar(base, { proveedores: [gemini.proveedor, groq.proveedor], ...registrador(), espera });
    expect(r.proveedor).toBe("gemini");
    expect(espera).toHaveBeenCalledTimes(1);
    expect(groq.usuarios).toHaveLength(0);
  });

  it("si el proveedor pide esperar más de 8 s, no reintenta y pasa al siguiente", async () => {
    const espera = vi.fn(async () => {});
    const lento: ProveedorIA = {
      id: "groq",
      disponible: () => true,
      async generarJSON() {
        throw new ErrorIA("limite", "groq: límite (429): Please try again in 19.1s.");
      },
    };
    const otro = simulado("openrouter", [{ titulo: "ok" }]);
    const r = await ejecutar(base, { proveedores: [lento, otro.proveedor], ...registrador(), espera });
    expect(r.proveedor).toBe("openrouter");
    expect(espera).not.toHaveBeenCalled();
  });

  it.each<TipoErrorIA>(["red", "timeout", "auth"])("%s → pasa al siguiente sin reintentar", async (tipo) => {
    const a = simulado("gemini", [tipo]);
    const b = simulado("cerebras", [{ titulo: "ok" }]);
    const r = await ejecutar(base, { proveedores: [a.proveedor, b.proveedor], ...registrador() });
    expect(r.proveedor).toBe("cerebras");
    expect(a.usuarios).toHaveLength(1);
  });

  it("JSON inválido una vez → reintenta en el mismo proveedor con el error en el mensaje", async () => {
    const gemini = simulado("gemini", ["json", { titulo: "ya sí" }]);
    const groq = simulado("groq", [{ titulo: "no debería usarse" }]);
    const r = await ejecutar(base, { proveedores: [gemini.proveedor, groq.proveedor], ...registrador() });
    expect(r.proveedor).toBe("gemini");
    expect(gemini.usuarios).toHaveLength(2);
    expect(gemini.usuarios[0]).toBe("USUARIO");
    expect(gemini.usuarios[1]).toContain("USUARIO");
    expect(gemini.usuarios[1]).toContain("gemini falló: json");
    expect(groq.usuarios).toHaveLength(0);
  });

  it("JSON inválido dos veces → pasa al siguiente", async () => {
    const gemini = simulado("gemini", ["json", "json", { titulo: "tercero" }]);
    const groq = simulado("groq", [{ titulo: "groq ok" }]);
    const r = await ejecutar(base, { proveedores: [gemini.proveedor, groq.proveedor], ...registrador() });
    expect(r.proveedor).toBe("groq");
    expect(gemini.usuarios).toHaveLength(2); // solo 1 reintento
  });

  it("todos fallan → ErrorCascadaAgotada con los intentos y el prompt manual", async () => {
    const a = simulado("gemini", ["limite", "limite"]);
    const b = simulado("cerebras", ["json", "json"]);
    const c = simulado("groq", ["auth"]);
    const error = await ejecutar(base, { proveedores: [a.proveedor, b.proveedor, c.proveedor], ...registrador() }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ErrorCascadaAgotada);
    const e = error as ErrorCascadaAgotada;
    expect(e.intentos.map((i) => [i.proveedor, i.tipo])).toEqual([
      ["gemini", "limite"],
      ["gemini", "limite"],
      ["cerebras", "json"],
      ["cerebras", "json"],
      ["groq", "auth"],
    ]);
    expect(e.promptManual.usuario).toBe("USUARIO");
    expect(e.promptManual.sistema).toContain("SISTEMA");
    expect(e.promptManual.sistema).toContain("JSON Schema");
  });

  it("sin proveedores → ErrorCascadaAgotada con 0 intentos", async () => {
    const error = await ejecutar(base, { proveedores: [], ...registrador() }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorCascadaAgotada);
    expect((error as ErrorCascadaAgotada).intentos).toEqual([]);
    expect((error as ErrorCascadaAgotada).promptManual.usuario).toBe("USUARIO");
  });

  it("omite proveedores no disponibles", async () => {
    const caido = simulado("gemini", [{ titulo: "x" }]);
    caido.proveedor.disponible = () => false;
    const groq = simulado("groq", [{ titulo: "groq" }]);
    const r = await ejecutar(base, { proveedores: [caido.proveedor, groq.proveedor], ...registrador() });
    expect(r.proveedor).toBe("groq");
    expect(caido.usuarios).toHaveLength(0);
  });

  it("los modos simultáneo y duelo caen en cascada por ahora", async () => {
    for (const modo of ["simultaneo", "duelo"] as const) {
      const g = simulado("groq", [{ titulo: "ok" }]);
      const r = await ejecutar(base, { proveedores: [g.proveedor], modo, ...registrador() });
      expect(r.proveedor).toBe("groq");
    }
  });
});

describe("enrutador · registro de uso", () => {
  it("registrarUso se llama una vez por intento", async () => {
    const gemini = simulado("gemini", ["limite", "limite"]);
    const cerebras = simulado("cerebras", ["json", { titulo: "ok" }]);
    const registrador2 = registrador();
    const { registrarUso } = registrador2;
    await ejecutar(base, { proveedores: [gemini.proveedor, cerebras.proveedor], ...registrador2 });
    expect(registrarUso).toHaveBeenCalledTimes(4);
    const llamadas = registrarUso.mock.calls.map(([u]) => [u.proveedor, u.ok, u.tarea]);
    expect(llamadas).toEqual([
      ["gemini", false, "landing"],
      ["gemini", false, "landing"],
      ["cerebras", false, "landing"],
      ["cerebras", true, "landing"],
    ]);
    expect(registrarUso.mock.calls[0][0].error).toContain("limite");
    expect(registrarUso.mock.calls[3][0]).toMatchObject({ modelo: "cerebras-m", ms: 5 });
  });

  it("un registrador que falla no rompe la generación", async () => {
    const g = simulado("groq", [{ titulo: "ok" }]);
    const registrarUso = vi.fn<RegistradorUso>(async () => {
      throw new Error("base caída");
    });
    const r = await ejecutar(base, { proveedores: [g.proveedor], registrarUso });
    expect(r.datos).toEqual({ titulo: "ok" });
    expect(registrarUso).toHaveBeenCalledTimes(1);
  });
});
