import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { crearGemini, type ClienteGemini } from "@/lib/ia/gemini";
import { crearProveedorCompatible } from "@/lib/ia/openai-compat";
import type { ErrorIA } from "@/lib/ia/tipos";

const esquema = z.object({ titulo: z.string() });
const peticion = { sistema: "Eres útil", usuario: "Dame un título", esquema };

function respuesta(status: number, cuerpo: unknown): Response {
  return new Response(JSON.stringify(cuerpo), { status, headers: { "Content-Type": "application/json" } });
}

function crear(fetchFn: typeof fetch, timeoutMs?: number) {
  return crearProveedorCompatible({
    id: "groq",
    baseUrl: "https://api.ejemplo.test/v1/",
    clave: "k-123",
    modelo: "modelo-x",
    fetchFn,
    timeoutMs,
  });
}

async function tipoDeError(promesa: Promise<unknown>): Promise<string> {
  try {
    await promesa;
  } catch (e) {
    return (e as ErrorIA).tipo;
  }
  return "sin-error";
}

describe("openai-compat (fetch simulado)", () => {
  it("respuesta correcta: valida, reporta tokens y arma la petición", async () => {
    const fetchFn = vi.fn(async () =>
      respuesta(200, {
        choices: [{ message: { content: '```json\n{"titulo":"Hola"}\n```' } }],
        usage: { prompt_tokens: 11, completion_tokens: 7 },
      }),
    );
    const r = await crear(fetchFn as unknown as typeof fetch).generarJSON({ ...peticion, maxTokens: 500, temperatura: 0.3 });
    expect(r.datos).toEqual({ titulo: "Hola" });
    expect(r.proveedor).toBe("groq");
    expect(r.modelo).toBe("modelo-x");
    expect(r.tokens).toEqual({ entrada: 11, salida: 7 });

    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.ejemplo.test/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer k-123");
    const cuerpo = JSON.parse(init.body as string);
    expect(cuerpo.response_format).toEqual({ type: "json_object" });
    expect(cuerpo.max_tokens).toBe(500);
    expect(cuerpo.temperature).toBe(0.3);
    expect(cuerpo.messages[0].role).toBe("system");
    expect(cuerpo.messages[0].content).toContain("Eres útil");
    expect(cuerpo.messages[0].content).toContain("JSON Schema");
    expect(cuerpo.messages[1]).toEqual({ role: "user", content: "Dame un título" });
  });

  it("sin usage no inventa tokens", async () => {
    const fetchFn = async () => respuesta(200, { choices: [{ message: { content: '{"titulo":"a"}' } }] });
    const r = await crear(fetchFn as unknown as typeof fetch).generarJSON(peticion);
    expect(r.tokens).toBeUndefined();
  });

  it("429 → limite", async () => {
    const f = (async () => respuesta(429, {})) as unknown as typeof fetch;
    expect(await tipoDeError(crear(f).generarJSON(peticion))).toBe("limite");
  });

  it("401 y 403 → auth", async () => {
    for (const status of [401, 403]) {
      const f = (async () => respuesta(status, {})) as unknown as typeof fetch;
      expect(await tipoDeError(crear(f).generarJSON(peticion))).toBe("auth");
    }
  });

  it("500 y fallo de red → red", async () => {
    const f500 = (async () => respuesta(500, {})) as unknown as typeof fetch;
    expect(await tipoDeError(crear(f500).generarJSON(peticion))).toBe("red");
    const fRed = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    expect(await tipoDeError(crear(fRed).generarJSON(peticion))).toBe("red");
  });

  it("timeout: aborta la petición colgada → timeout", async () => {
    const colgado = ((_url: string, init: RequestInit) =>
      new Promise((_res, rej) => {
        init.signal?.addEventListener("abort", () => rej(init.signal?.reason));
      })) as unknown as typeof fetch;
    expect(await tipoDeError(crear(colgado, 20).generarJSON(peticion))).toBe("timeout");
  });

  it("contenido que no es JSON o no cumple el esquema → json", async () => {
    const fTexto = (async () => respuesta(200, { choices: [{ message: { content: "hola" } }] })) as unknown as typeof fetch;
    expect(await tipoDeError(crear(fTexto).generarJSON(peticion))).toBe("json");
    const fMal = (async () => respuesta(200, { choices: [{ message: { content: '{"titulo":1}' } }] })) as unknown as typeof fetch;
    expect(await tipoDeError(crear(fMal).generarJSON(peticion))).toBe("json");
    const fVacio = (async () => respuesta(200, { choices: [] })) as unknown as typeof fetch;
    expect(await tipoDeError(crear(fVacio).generarJSON(peticion))).toBe("json");
    const fCuerpo = (async () => new Response("<html>", { status: 200 })) as unknown as typeof fetch;
    expect(await tipoDeError(crear(fCuerpo).generarJSON(peticion))).toBe("json");
  });

  it("disponible() depende de la clave", () => {
    const sinClave = crearProveedorCompatible({ id: "cerebras", baseUrl: "x", modelo: "m" });
    expect(sinClave.disponible()).toBe(false);
  });
});

describe("gemini (cliente simulado)", () => {
  it("usa JSON Schema y mime JSON; disponible() = hay clave", async () => {
    const generateContent = vi.fn(async () => ({
      text: '{"titulo":"G"}',
      usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 4 },
    }));
    const cliente = { models: { generateContent } } as ClienteGemini;
    const p = crearGemini({ GEMINI_API_KEY: "k", GEMINI_MODEL: "gm" }, cliente);
    expect(p.disponible()).toBe(true);
    expect(crearGemini({}).disponible()).toBe(false);

    const r = await p.generarJSON({ ...peticion, maxTokens: 100 });
    expect(r).toMatchObject({ datos: { titulo: "G" }, proveedor: "gemini", modelo: "gm", tokens: { entrada: 3, salida: 4 } });
    const arg = (generateContent.mock.calls[0] as unknown as [{ config: Record<string, unknown> }])[0];
    expect(arg.config.responseMimeType).toBe("application/json");
    expect(arg.config.responseJsonSchema).toMatchObject({ type: "object" });
    expect(arg.config.systemInstruction).toBe("Eres útil");
    expect(arg.config.maxOutputTokens).toBe(100);
  });

  it("traduce 429 → limite y 401 → auth", async () => {
    const con = (status: number) =>
      crearGemini(
        { GEMINI_API_KEY: "k" },
        {
          models: {
            generateContent: async () => {
              throw Object.assign(new Error("fallo"), { status });
            },
          },
        },
      );
    expect(await tipoDeError(con(429).generarJSON(peticion))).toBe("limite");
    expect(await tipoDeError(con(401).generarJSON(peticion))).toBe("auth");
    expect(await tipoDeError(con(500).generarJSON(peticion))).toBe("red");
  });
});
