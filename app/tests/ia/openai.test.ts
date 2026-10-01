import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ejecutar } from "@/lib/ia/enrutador";
import { costoUsd, crearContadorGasto, presupuestoDe, type AlmacenGasto } from "@/lib/ia/gasto";
import { esModeloConRazonamiento, crearProveedorCompatible } from "@/lib/ia/openai-compat";
import { proveedoresDisponibles } from "@/lib/ia/registro";
import { ErrorIA, ErrorCascadaAgotada, type ProveedorIA } from "@/lib/ia/tipos";
import { ErrorNoCabe } from "@/lib/ia/errores-http";

const CLAVE = "sk-proj-CLAVE-DE-PRUEBA-1234567890abcdef";
const Esquema = z.object({ ok: z.boolean() });
const ok = (extra: Record<string, unknown> = {}) =>
  new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }], usage: { prompt_tokens: 1000, completion_tokens: 500 }, ...extra }), { status: 200 });

function memoria(): AlmacenGasto & { datos: Map<string, string> } {
  const datos = new Map<string, string>();
  return { datos, leer: async (k) => datos.get(k) ?? null, escribir: async (k, v) => void datos.set(k, v) };
}

interface Visto {
  cuerpo: Record<string, unknown>;
}

function crear(modelo: string, respuestas: (() => Response)[], extra: Partial<Parameters<typeof crearProveedorCompatible>[0]> = {}) {
  const vistos: Visto[] = [];
  const cola = [...respuestas];
  const p = crearProveedorCompatible({
    id: "openai",
    baseUrl: "https://api.openai.com/v1",
    clave: CLAVE,
    modelo,
    soportaImagen: true,
    esperaEntreModelosMs: 0,
    fetchFn: (async (_u: string, init: RequestInit) => {
      vistos.push({ cuerpo: JSON.parse(init.body as string) });
      return (cola.shift() ?? ok)();
    }) as unknown as typeof fetch,
    ...extra,
  });
  return { p, vistos };
}

describe("24-A · OpenAI en el adaptador", () => {
  it("detecta la familia: gpt-5 y serie o razonan; gpt-4.1 no", () => {
    expect(esModeloConRazonamiento("gpt-5.4-mini")).toBe(true);
    expect(esModeloConRazonamiento("o4-mini")).toBe(true);
    expect(esModeloConRazonamiento("gpt-4.1-mini")).toBe(false);
    expect(esModeloConRazonamiento("gpt-5-chat-latest")).toBe(false);
  });

  it("gpt-5.4-mini: max_completion_tokens, reasoning_effort low y sin temperature", async () => {
    const { p, vistos } = crear("gpt-5.4-mini", [() => ok()]);
    await p.generarJSON({ sistema: "s", usuario: "u", esquema: Esquema, maxTokens: 900, temperatura: 0.3 });
    const c = vistos[0].cuerpo;
    expect(c.model).toBe("gpt-5.4-mini");
    expect(c.max_completion_tokens).toBe(900);
    expect(c).not.toHaveProperty("max_tokens");
    expect(c).not.toHaveProperty("temperature");
    expect(c.reasoning_effort).toBe("low");
    expect(c.response_format).toEqual({ type: "json_object" });
  });

  it("redacción creativa (temperatura 0,9): razonamiento «none» + temperature, la única forma que la API acepta (medido en vivo)", async () => {
    const { p, vistos } = crear("gpt-5.4-mini", [() => ok()]);
    await p.generarJSON({ sistema: "s", usuario: "u", esquema: Esquema, maxTokens: 900, temperatura: 0.9 });
    expect(vistos[0].cuerpo).toMatchObject({ reasoning_effort: "none", temperature: 0.9, max_completion_tokens: 900 });
  });

  it("formas aceptadas por la API medidas el 30-sep (gpt-5.4-mini rechaza max_tokens y temperature con razonamiento; gpt-4.1-mini acepta las dos)", async () => {
    // Lo que respondió la API real: 5.4 + max_tokens → 400; 5.4 + max_completion_tokens + low → 200; 5.4 + temp 0.9 + low → 400;
    // 5.4 + temp 0.9 + none → 200; 4.1 + max_tokens y 4.1 + max_completion_tokens → 200. Ninguna de las formas rechazadas sale del adaptador.
    for (const [modelo, temp] of [["gpt-5.4-mini", 0.9], ["gpt-5.4-mini", 0.3], ["gpt-5.4-mini", undefined], ["gpt-4.1-mini", 0.9]] as const) {
      const { p, vistos } = crear(modelo, [() => ok()]);
      await p.generarJSON({ sistema: "s", usuario: "u", esquema: Esquema, maxTokens: 200, temperatura: temp });
      const c = vistos[0].cuerpo;
      expect(c, `${modelo} ${temp}`).not.toHaveProperty("max_tokens");
      if (modelo === "gpt-5.4-mini" && "temperature" in c) expect(c.reasoning_effort).toBe("none");
    }
  });

  it("gpt-4.1-mini: max_completion_tokens, con temperature y sin reasoning_effort", async () => {
    const { p, vistos } = crear("gpt-4.1-mini", [() => ok()]);
    await p.generarJSON({ sistema: "s", usuario: "u", esquema: Esquema, maxTokens: 900, temperatura: 0.7 });
    const c = vistos[0].cuerpo;
    expect(c.max_completion_tokens).toBe(900);
    expect(c.temperature).toBe(0.7);
    expect(c).not.toHaveProperty("reasoning_effort");
  });

  it("Groq y Cerebras siguen con max_tokens (no cambian)", async () => {
    const vistos: Record<string, unknown>[] = [];
    const p = crearProveedorCompatible({ id: "cerebras", baseUrl: "https://x", clave: "k", modelo: "gpt-oss-120b", fetchFn: (async (_u: string, i: RequestInit) => (vistos.push(JSON.parse(i.body as string)), ok())) as unknown as typeof fetch });
    await p.generarJSON({ sistema: "s", usuario: "u", esquema: Esquema, maxTokens: 500, temperatura: 0.2 });
    expect(vistos[0].max_tokens).toBe(500);
    expect(vistos[0]).not.toHaveProperty("max_completion_tokens");
  });

  it("con imagen el mensaje lleva image_url en base64 y el proveedor declara soportaImagen", async () => {
    const { p, vistos } = crear("gpt-5.4-mini", [() => ok()]);
    expect((p as { soportaImagen?: boolean }).soportaImagen).toBe(true);
    await p.generarJSON({ sistema: "s", usuario: "mira", esquema: Esquema, imagen: { mimeType: "image/png", base64: "QUJD" } });
    const msgs = vistos[0].cuerpo.messages as { role: string; content: unknown }[];
    expect(msgs[1].content).toEqual([
      { type: "text", text: "mira" },
      { type: "image_url", image_url: { url: "data:image/png;base64,QUJD" } },
    ]);
  });

  it("429 en el principal: prueba gpt-4.1-mini (con sus propios parámetros) y responde", async () => {
    const limite = () => new Response(JSON.stringify({ error: { message: "Rate limit reached" } }), { status: 429 });
    const { p, vistos } = crear("gpt-5.4-mini", [limite, () => ok()], { modelosRespaldo: ["gpt-4.1-mini"] });
    const r = await p.generarJSON({ sistema: "s", usuario: "u", esquema: Esquema, maxTokens: 300, temperatura: 0.5 });
    expect(r.modelo).toBe("gpt-4.1-mini");
    expect(vistos.map((v) => v.cuerpo.model)).toEqual(["gpt-5.4-mini", "gpt-4.1-mini"]);
    expect(vistos[1].cuerpo.temperature).toBe(0.5);
    expect(vistos[0].cuerpo).not.toHaveProperty("temperature");
  });

  it("429 en todo OpenAI → el enrutador pasa al siguiente proveedor", async () => {
    const limite = () => new Response(JSON.stringify({ error: { message: "Rate limit reached" } }), { status: 429 });
    const { p } = crear("gpt-5.4-mini", [limite, limite, limite, limite], { modelosRespaldo: ["gpt-4.1-mini"] });
    const segundo: ProveedorIA = { id: "cerebras", disponible: () => true, generarJSON: async () => ({ datos: { ok: true } as never, proveedor: "cerebras", modelo: "m", ms: 1 }) };
    const r = await ejecutar({ tarea: "estrategia", sistema: "s", usuario: "u", esquema: Esquema }, { proveedores: [p as ProveedorIA, segundo], registrarUso: async () => {}, espera: async () => {}, modo: "cascada", config: {} });
    expect(r.proveedor).toBe("cerebras");
  });

  it("registro: OpenAI entra primero con su modelo y respaldo por defecto, y declara visión", () => {
    const ps = proveedoresDisponibles({ OPENAI_API_KEY: CLAVE, CEREBRAS_API_KEY: "a" });
    expect(ps.map((x) => x.id)).toEqual(["openai", "cerebras"]);
    expect((ps[0] as { modelo?: string }).modelo).toBe("gpt-5.4-mini");
    expect((ps[0] as { soportaImagen?: boolean }).soportaImagen).toBe(true);
    expect((proveedoresDisponibles({ OPENAI_API_KEY: CLAVE, OPENAI_MODEL: "gpt-4.1-mini" })[0] as { modelo?: string }).modelo).toBe("gpt-4.1-mini");
  });
});

describe("24-A · control de gasto diario", () => {
  it("costo estimado por modelo y presupuesto por defecto de 2 USD", () => {
    expect(costoUsd("gpt-5.4-mini", { entrada: 1_000_000, salida: 1_000_000 })).toBeCloseTo(5.25, 5);
    expect(costoUsd("gpt-4.1-mini", { entrada: 1_000_000, salida: 0 })).toBeCloseTo(0.4, 5);
    expect(costoUsd("modelo-nuevo", { entrada: 1_000_000, salida: 0 })).toBeGreaterThan(0); // desconocido: se estima por lo alto
    expect(presupuestoDe({})).toBe(2);
    expect(presupuestoDe({ OPENAI_PRESUPUESTO_USD_DIA: "0.5" })).toBe(0.5);
  });

  it("acumula tokens y USD, persiste y reinicia al cambiar de día", async () => {
    const almacen = memoria();
    let t = new Date("2026-09-30T10:00:00Z");
    const c = crearContadorGasto({ proveedor: "openai", almacen, ahora: () => t, env: {} });
    await c.registrar("gpt-5.4-mini", { entrada: 1000, salida: 500 });
    await c.registrar("gpt-4.1-mini", { entrada: 2000, salida: 100 });
    const h = await c.hoy();
    expect(h).toMatchObject({ entrada: 3000, salida: 600, peticiones: 2, presupuestoUsd: 2 });
    expect(h.usd).toBeCloseTo(costoUsd("gpt-5.4-mini", { entrada: 1000, salida: 500 }) + costoUsd("gpt-4.1-mini", { entrada: 2000, salida: 100 }), 8);
    expect(JSON.parse(almacen.datos.get("gasto:openai:2026-09-30")!).peticiones).toBe(2);
    // otro proceso (contador nuevo) lee lo guardado
    expect((await crearContadorGasto({ proveedor: "openai", almacen, ahora: () => t, env: {} }).hoy()).peticiones).toBe(2);
    t = new Date("2026-10-01T00:05:00Z");
    expect((await c.hoy()).peticiones).toBe(0);
  });

  it("al llegar al presupuesto, OpenAI no se llama (ErrorNoCabe) y el enrutador salta al siguiente", async () => {
    const almacen = memoria();
    const gasto = crearContadorGasto({ proveedor: "openai", almacen, env: { OPENAI_PRESUPUESTO_USD_DIA: "0.001" } });
    const { p, vistos } = crear("gpt-5.4-mini", [() => ok(), () => ok()], { gasto });
    await p.generarJSON({ sistema: "s", usuario: "u", esquema: Esquema }); // 1000 + 500 tokens ≈ US$ 0,003: ya pasó el tope
    expect(vistos).toHaveLength(1);
    await expect(p.generarJSON({ sistema: "s", usuario: "u", esquema: Esquema })).rejects.toThrow(/presupuesto diario agotado/);
    await expect(p.generarJSON({ sistema: "s", usuario: "u", esquema: Esquema })).rejects.toBeInstanceOf(ErrorNoCabe);
    expect(vistos).toHaveLength(1); // no hubo más llamadas
    const segundo: ProveedorIA = { id: "cerebras", disponible: () => true, generarJSON: async () => ({ datos: { ok: true } as never, proveedor: "cerebras", modelo: "m", ms: 1 }) };
    const r = await ejecutar({ tarea: "critico", sistema: "s", usuario: "u", esquema: Esquema }, { proveedores: [p as ProveedorIA, segundo], registrarUso: async () => {}, espera: async () => {}, modo: "cascada", config: {} });
    expect(r.proveedor).toBe("cerebras");
  });

  it("sin presupuesto en ningún proveedor, el error legible no lleva la clave", async () => {
    const gasto = crearContadorGasto({ proveedor: "openai", almacen: memoria(), env: { OPENAI_PRESUPUESTO_USD_DIA: "0.0000001" } });
    const { p } = crear("gpt-5.4-mini", [() => ok()], { gasto });
    await p.generarJSON({ sistema: "s", usuario: "u", esquema: Esquema });
    const e = await ejecutar({ tarea: "critico", sistema: "s", usuario: "u", esquema: Esquema }, { proveedores: [p as ProveedorIA], registrarUso: async () => {}, espera: async () => {}, modo: "cascada", config: {} }).catch((x) => x);
    expect(e).toBeInstanceOf(ErrorCascadaAgotada);
    expect(String(e.message)).not.toContain(CLAVE);
  });
});

describe("24-A · la clave no se filtra", () => {
  it("ni en los errores del servicio ni en lo que se registra por consola", async () => {
    const avisos = [vi.spyOn(console, "warn").mockImplementation(() => {}), vi.spyOn(console, "error").mockImplementation(() => {}), vi.spyOn(console, "log").mockImplementation(() => {})];
    const eco = () => new Response(JSON.stringify({ error: { message: `Incorrect API key provided: ${CLAVE}` } }), { status: 401 });
    const { p } = crear("gpt-5.4-mini", [eco], { gasto: crearContadorGasto({ proveedor: "openai", almacen: memoria(), env: {} }) });
    const e = await p.generarJSON({ sistema: "s", usuario: "u", esquema: Esquema }).catch((x) => x);
    expect(e).toBeInstanceOf(ErrorIA);
    expect(String(e.message)).not.toContain(CLAVE);
    expect(String(e.message)).toContain("clave rechazada");
    for (const a of avisos) {
      expect(JSON.stringify(a.mock.calls)).not.toContain(CLAVE);
      a.mockRestore();
    }
  });
});

describe("24-A · concurrencia y API de gasto", () => {
  it("la redacción va con 6 secciones a la vez si OpenAI es el primero, y con 3 si no", async () => {
    const { simultaneasPara } = await import("@/lib/generar/pipeline");
    const mk = (id: string) => ({ id, disponible: () => true, generarJSON: async () => ({}) }) as unknown as ProveedorIA;
    expect(simultaneasPara({ proveedores: [mk("openai"), mk("cerebras")] })).toBe(6);
    expect(simultaneasPara({ proveedores: [mk("cerebras"), mk("openai")] })).toBe(3);
  }, 60_000);

  it("GET /api/ia/uso responde el gasto de hoy sin la clave", async () => {
    await import("../ayudas-db");
    const { GET } = await import("@/app/api/ia/uso/route");
    const r = await GET();
    const cuerpo = await r.json();
    expect(r.status).toBe(200);
    expect(cuerpo).toMatchObject({ proveedor: "openai", presupuestoUsd: expect.any(Number), restanteUsd: expect.any(Number), agotado: false });
    expect(JSON.stringify(cuerpo)).not.toMatch(/sk-/);
  });
});

describe("24-A · cascada guardada antes de OpenAI", () => {
  it("una cascada de /ajustes sin OpenAI lo recibe primero; una guardada después se respeta", async () => {
    await import("../ayudas-db");
    const { db } = await import("@/lib/db");
    const { cargarConfigIA, CLAVE_CASCADA_OPENAI } = await import("@/lib/ia/enrutador");
    await db.ajuste.upsert({ where: { clave: "ia.cascada" }, update: { valor: '["cerebras","gemini"]' }, create: { clave: "ia.cascada", valor: '["cerebras","gemini"]' } });
    expect((await cargarConfigIA()).cascada).toEqual(["openai", "cerebras", "gemini"]);
    await db.ajuste.upsert({ where: { clave: CLAVE_CASCADA_OPENAI }, update: { valor: "1" }, create: { clave: CLAVE_CASCADA_OPENAI, valor: "1" } });
    expect((await cargarConfigIA()).cascada).toEqual(["cerebras", "gemini"]);
  });
});
