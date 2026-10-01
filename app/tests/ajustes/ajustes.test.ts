import "../ayudas-db"; // primero: base SQLite aislada
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { GET as PROVEEDORES } from "@/app/api/ajustes/proveedores/route";
import { POST as PROBAR } from "@/app/api/ajustes/probar/route";
import { GET as MODO_GET, PUT as MODO_PUT } from "@/app/api/ajustes/modo/route";
import { GET as TAREAS_GET, PUT as TAREAS_PUT } from "@/app/api/ajustes/tareas/route";
import { GET as USO } from "@/app/api/ajustes/uso/route";
import { db } from "@/lib/db";
import { fijarDepsEnrutador } from "@/lib/ia/deps";
import { cargarConfigIA, ejecutar } from "@/lib/ia/enrutador";
import { ErrorIA, type ProveedorId, type ProveedorIA, type RegistradorUso } from "@/lib/ia/tipos";

const CLAVES = { GEMINI_API_KEY: "AIza-secreto-gemini-111", GROQ_API_KEY: "gsk-secreto-groq-222", CEREBRAS_API_KEY: "csk-secreto-cerebras-333" };
const registrarUso: RegistradorUso = async () => {};

const req = (cuerpo?: unknown, metodo = "POST") =>
  new Request("http://localhost/x", {
    method: metodo,
    headers: { "Content-Type": "application/json" },
    body: cuerpo === undefined ? undefined : typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo),
  });

function simulados(fallos: Partial<Record<ProveedorId, Error>> = {}): ProveedorIA[] {
  return (["gemini", "cerebras", "groq", "openrouter"] as const).map((id) => ({
    id,
    disponible: () => true,
    async generarJSON<T>() {
      const fallo = fallos[id];
      if (fallo) throw fallo;
      return { datos: { ok: true } as T, proveedor: id, modelo: `${id}-sim`, ms: 3 };
    },
  }));
}

beforeEach(async () => {
  Object.assign(process.env, CLAVES);
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.IA_MODO;
  delete process.env.IA_CASCADA;
  fijarDepsEnrutador(undefined);
  await db.ajuste.deleteMany();
  await db.usoIA.deleteMany();
});

afterEach(() => {
  for (const k of Object.keys(CLAVES)) delete process.env[k];
  fijarDepsEnrutador(undefined);
});

describe("GET /api/ajustes/proveedores", () => {
  it("nunca devuelve las claves ni parte de ellas", async () => {
    const res = await PROVEEDORES();
    expect(res.status).toBe(200);
    const texto = await res.text();
    for (const clave of Object.values(CLAVES)) {
      expect(texto).not.toContain(clave);
      expect(texto).not.toContain(clave.slice(0, 8));
      expect(texto).not.toContain(clave.slice(-6));
    }
    expect(texto).not.toMatch(/secreto/);
  });

  it("lista los 6 proveedores con modelo, clave, estado, uso y límite", async () => {
    process.env.GROQ_MODEL = "modelo-groq-x";
    const { proveedores } = await (await PROVEEDORES()).json();
    delete process.env.GROQ_MODEL;
    expect(proveedores.map((p: { id: string }) => p.id)).toEqual(["openai", "gemini", "cerebras", "groq", "openrouter", "manual"]);
    const por = Object.fromEntries(proveedores.map((p: { id: string }) => [p.id, p]));
    expect(por.groq).toMatchObject({ nombre: "Groq", modelo: "modelo-groq-x", tieneClave: true, estado: "sin-probar", usoHoy: 0, limiteDiario: 1000 });
    expect(por.openrouter).toMatchObject({ tieneClave: false, estado: "sin-clave", limiteDiario: 50 });
    expect(por.manual).toMatchObject({ tieneClave: true, estado: "conectado" });
    expect(por.gemini.modelo).toBe("gemini-flash-latest");
    expect(por.groq).not.toHaveProperty("ultimoError");
  });

  it("un 429 reciente en UsoIA marca «límite» y calcula el porcentaje de uso; un éxito posterior vuelve a «conectado»", async () => {
    await db.usoIA.createMany({
      data: Array.from({ length: 800 }, () => ({ tarea: "landing", proveedor: "groq", modelo: "m", ms: 5, ok: true })),
    });
    await db.usoIA.create({ data: { tarea: "landing", proveedor: "groq", modelo: "m", ms: 5, ok: false, error: "limite: groq: límite de peticiones alcanzado (429)." } });
    let groq = (await (await PROVEEDORES()).json()).proveedores.find((p: { id: string }) => p.id === "groq");
    expect(groq).toMatchObject({ estado: "limite", usoHoy: 801, porcentaje: 80.1 });
    expect(groq.ultimoError).toContain("429");

    await new Promise((r) => setTimeout(r, 20));
    await db.usoIA.create({ data: { tarea: "landing", proveedor: "groq", modelo: "m", ms: 5, ok: true } });
    groq = (await (await PROVEEDORES()).json()).proveedores.find((p: { id: string }) => p.id === "groq");
    expect(groq.estado).toBe("conectado");
  });

  it("un error que no es de límite es «error» con su mensaje; un límite viejo deja de contar", async () => {
    await db.usoIA.create({ data: { tarea: "landing", proveedor: "gemini", modelo: "m", ms: 5, ok: false, error: "auth: clave rechazada." } });
    const antiguo = new Date(Date.now() - 3 * 3_600_000);
    await db.usoIA.create({ data: { tarea: "landing", proveedor: "cerebras", modelo: "m", ms: 5, ok: false, error: "limite: 429", creadoEn: antiguo } });
    const { proveedores } = await (await PROVEEDORES()).json();
    const por = Object.fromEntries(proveedores.map((p: { id: string }) => [p.id, p]));
    expect(por.gemini).toMatchObject({ estado: "error", ultimoError: "auth: clave rechazada." });
    expect(por.cerebras.estado).toBe("sin-probar");
  });
});

describe("POST /api/ajustes/probar", () => {
  it("«Probar todos» con proveedores simulados: uno falla por límite y queda marcado", async () => {
    fijarDepsEnrutador({ proveedores: simulados({ groq: new ErrorIA("limite", "groq: límite de peticiones alcanzado (429).") }), registrarUso });
    const res = await PROBAR(req({}));
    expect(res.status).toBe(200);
    const { resultados } = await res.json();
    const por = Object.fromEntries(resultados.map((r: { id: string }) => [r.id, r]));
    expect(resultados).toHaveLength(5);
    expect(por.gemini).toMatchObject({ ok: true });
    expect(por.cerebras.ok).toBe(true);
    expect(por.groq.ok).toBe(false);
    expect(por.groq.error).toMatch(/^limite:/);
    expect(por.openrouter).toMatchObject({ ok: false, ms: 0, error: expect.stringContaining("clave") });

    const guardadas = await db.ajuste.findMany({ where: { clave: { startsWith: "prueba:" } }, orderBy: { clave: "asc" } });
    expect(guardadas.map((g) => g.clave)).toEqual(["prueba:cerebras", "prueba:gemini", "prueba:groq"]); // sin clave no se guarda

    const { proveedores } = await (await PROVEEDORES()).json();
    const estado = Object.fromEntries(proveedores.map((p: { id: string; estado: string }) => [p.id, p.estado]));
    expect(estado).toMatchObject({ gemini: "conectado", cerebras: "conectado", groq: "limite", openrouter: "sin-clave" });
  });

  it("prueba uno solo, sin cuerpo o con proveedor, y usa solo ese proveedor (forzar)", async () => {
    const llamados: string[] = [];
    fijarDepsEnrutador({
      registrarUso,
      proveedores: simulados().map((p) => ({ ...p, generarJSON: async <T,>() => (llamados.push(p.id), { datos: { ok: true } as T, proveedor: p.id, modelo: "m", ms: 1 }) })),
    });
    const uno = await (await PROBAR(req({ proveedor: "gemini" }))).json();
    expect(uno.resultados).toEqual([expect.objectContaining({ id: "gemini", ok: true })]);
    expect(llamados).toEqual(["gemini"]);
    llamados.length = 0;
    const todos = await PROBAR(new Request("http://localhost/x", { method: "POST" }));
    expect((await todos.json()).resultados).toHaveLength(5);
    expect(llamados.sort()).toEqual(["cerebras", "gemini", "groq"]); // openrouter no tiene clave: ni se llama
  });

  it("un fallo de autenticación queda como error (no como límite) y 400 con un proveedor inválido", async () => {
    fijarDepsEnrutador({ proveedores: simulados({ gemini: new ErrorIA("auth", "gemini: clave rechazada.") }), registrarUso });
    const { resultados } = await (await PROBAR(req({ proveedor: "gemini" }))).json();
    expect(resultados[0]).toMatchObject({ ok: false, error: "auth: gemini: clave rechazada." });
    const gemini = (await (await PROVEEDORES()).json()).proveedores.find((p: { id: string }) => p.id === "gemini");
    expect(gemini).toMatchObject({ estado: "error", ultimoError: "auth: gemini: clave rechazada." });
    expect((await PROBAR(req({ proveedor: "manual" }))).status).toBe(400);
    expect((await PROBAR(req({ proveedor: "nada" }))).status).toBe(400);
    expect((await PROBAR(req("{roto"))).status).toBe(400);
  });
});

describe("/api/ajustes/modo", () => {
  it("por defecto usa el entorno y PUT lo guarda con prioridad sobre IA_MODO e IA_CASCADA", async () => {
    expect(await (await MODO_GET()).json()).toEqual({ modo: "cascada", cascada: ["openai", "cerebras", "gemini", "groq", "openrouter"] });
    process.env.IA_MODO = "duelo";
    process.env.IA_CASCADA = "groq,gemini";
    expect(await (await MODO_GET()).json()).toEqual({ modo: "duelo", cascada: ["groq", "gemini"] });
    const put = await MODO_PUT(req({ modo: "simultaneo", cascada: ["cerebras", "gemini"] }, "PUT"));
    expect(put.status).toBe(200);
    expect(await put.json()).toEqual({ modo: "simultaneo", cascada: ["cerebras", "gemini"] });
    expect(await (await MODO_GET()).json()).toEqual({ modo: "simultaneo", cascada: ["cerebras", "gemini"] });
    expect((await db.ajuste.findUnique({ where: { clave: "ia.modo" } }))?.valor).toBe("simultaneo");
    expect(JSON.parse((await db.ajuste.findUnique({ where: { clave: "ia.cascada" } }))!.valor)).toEqual(["cerebras", "gemini"]);
  });

  it("PUT cambia el orden que usa `ejecutar` (y el modo guardado gana sobre el entorno)", async () => {
    const esquema = z.object({ ok: z.boolean() });
    const base = { tarea: "objeciones" as const, sistema: "s", usuario: "u", esquema };
    const proveedores = simulados();
    const antes = await ejecutar(base, { proveedores, registrarUso, config: await cargarConfigIA() });
    expect(antes.proveedor).toBe("gemini"); // orden de los proveedores inyectados
    await MODO_PUT(req({ modo: "cascada", cascada: ["groq", "gemini"] }, "PUT"));
    const despues = await ejecutar(base, { proveedores, registrarUso, config: await cargarConfigIA() });
    expect(despues.proveedor).toBe("groq");
    // los que no están en la cascada guardada no se usan
    const soloGroq = await ejecutar(base, { proveedores: simulados({ groq: new ErrorIA("limite", "x") }), registrarUso, config: { cascada: ["groq"] } }).catch((e) => e);
    expect(soloGroq).toBeInstanceOf(Error);
    // el modo guardado (simultáneo) manda sobre IA_MODO=cascada del entorno
    await MODO_PUT(req({ modo: "simultaneo", cascada: ["gemini", "groq"] }, "PUT"));
    const sim = await ejecutar({ ...base, tarea: "critico" }, { proveedores, registrarUso, tablaTareas: { critico: "groq" }, config: await cargarConfigIA(), env: { IA_MODO: "cascada" } });
    expect(sim.proveedor).toBe("groq");
  });

  it("PUT rechaza modos inválidos, cascadas vacías, repetidas o con «manual»", async () => {
    for (const cuerpo of [
      { modo: "turbo", cascada: ["gemini"] },
      { modo: "cascada", cascada: [] },
      { modo: "cascada", cascada: ["gemini", "gemini"] },
      { modo: "cascada", cascada: ["manual"] },
      { modo: "cascada" },
    ]) {
      const res = await MODO_PUT(req(cuerpo, "PUT"));
      expect(res.status, JSON.stringify(cuerpo)).toBe(400);
      expect(typeof (await res.json()).error).toBe("string");
    }
    expect((await MODO_PUT(req("{roto", "PUT"))).status).toBe(400);
  });
});

describe("/api/ajustes/tareas", () => {
  it("GET devuelve las 19 tareas con los valores por defecto", async () => {
    const { tareas } = await (await TAREAS_GET()).json();
    expect(Object.keys(tareas).sort()).toEqual(["corregir-lista-negra", "critico", "dato-curioso", "describir-medio", "elegir-imagen", "estrategia", "humanizar", "identificar-producto", "intake", "investigar", "juez-duelo", "landing", "mejorar-prompt", "objeciones", "plan-secciones", "prompts-grok", "prompts-imagen", "redactar-seccion", "validar-imagen"]);
    expect(tareas.landing).toBe("openai");
    expect(tareas.critico).toBe("openai");
  });

  it("PUT guarda solo lo indicado y el resto conserva su valor", async () => {
    const put = await TAREAS_PUT(req({ tareas: { landing: "cerebras", humanizar: "groq" } }, "PUT"));
    expect(put.status).toBe(200);
    const { tareas } = await put.json();
    expect(tareas).toMatchObject({ landing: "cerebras", humanizar: "groq", critico: "openai", objeciones: "openai" });
    expect((await (await TAREAS_GET()).json()).tareas.landing).toBe("cerebras");
    expect(JSON.parse((await db.ajuste.findUnique({ where: { clave: "ia.tareas" } }))!.valor)).toEqual({ landing: "cerebras", humanizar: "groq" });
  });

  it("PUT rechaza una tarea o un proveedor desconocidos", async () => {
    const tarea = await TAREAS_PUT(req({ tareas: { inventada: "groq" } }, "PUT"));
    expect(tarea.status).toBe(400);
    expect((await tarea.json()).error).toContain("inventada");
    expect((await TAREAS_PUT(req({ tareas: { landing: "manual" } }, "PUT"))).status).toBe(400);
    expect((await TAREAS_PUT(req({ tareas: { landing: "nadie" } }, "PUT"))).status).toBe(400);
    expect((await TAREAS_PUT(req({}, "PUT"))).status).toBe(400);
    expect(await db.ajuste.findUnique({ where: { clave: "ia.tareas" } })).toBeNull();
  });
});

describe("GET /api/ajustes/uso", () => {
  it("reutiliza /api/uso", async () => {
    await db.usoIA.create({ data: { tarea: "landing", proveedor: "groq", modelo: "m", ms: 40, ok: true } });
    const r = await (await USO(new Request("http://localhost/api/ajustes/uso?dias=3"))).json();
    expect(r.dias).toBe(3);
    expect(r.porProveedor[0]).toMatchObject({ proveedor: "groq", total: 1 });
  });
});
