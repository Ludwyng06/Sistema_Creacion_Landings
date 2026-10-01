import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { LandingDoc } from "@/lib/contratos";
import { ejecutar } from "@/lib/ia/enrutador";
import { ErrorNoCabe, esperaSugeridaMs } from "@/lib/ia/errores-http";
import { esquemaParaGemini } from "@/lib/ia/esquema-json";
import { crearGemini, type ClienteGemini } from "@/lib/ia/gemini";
import { crearProveedorCompatible } from "@/lib/ia/openai-compat";
import type { ErrorIA } from "@/lib/ia/tipos";
import gemini400 from "./fixtures/gemini-400.json";
import gemini503 from "./fixtures/gemini-503.json";
import groq400 from "./fixtures/groq-400.json";
import groq429 from "./fixtures/groq-429-tpm.json";
import razonamiento from "./fixtures/openrouter-razonamiento.json";
import textoAntes from "./fixtures/openrouter-texto-antes.json";

// Respuestas grabadas (sin claves) de los fallos que dio `npm run ia:probar` con las claves reales.

const esquema = z.object({ titulo: z.string() });
const peticion = { sistema: "Eres útil", usuario: "Dame un título", esquema };
const respuesta = (status: number, cuerpo: unknown) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { "Content-Type": "application/json" } });

async function fallo(promesa: Promise<unknown>): Promise<ErrorIA> {
  try {
    await promesa;
  } catch (e) {
    return e as ErrorIA;
  }
  throw new Error("Se esperaba un error");
}

function compatible(id: "groq" | "openrouter", f: () => Response, extra: object = {}) {
  const fetchFn = vi.fn(async () => f());
  const proveedor = crearProveedorCompatible({
    id,
    baseUrl: "https://x.test/v1",
    clave: "clave-secreta-123456",
    modelo: "m",
    fetchFn: fetchFn as unknown as typeof fetch,
    ...extra,
  });
  return { proveedor, fetchFn };
}

function geminiQueFalla(estado: number, cuerpo: unknown, modeloOk?: string) {
  const modelos: string[] = [];
  const cliente: ClienteGemini = {
    models: {
      async generateContent(p) {
        modelos.push(p.model);
        if (p.model === modeloOk) return { text: '{"titulo":"desde el respaldo"}' };
        throw Object.assign(new Error(JSON.stringify(cuerpo)), { status: estado });
      },
    },
  };
  return { cliente, modelos };
}

describe("Gemini · 400 INVALID_ARGUMENT con el esquema de LandingDoc", () => {
  const esquemaLanding = esquemaParaGemini(LandingDoc.omit({ critica: true }));
  const json = JSON.stringify(esquemaLanding);

  it("el esquema enviado no lleva los rasgos que la API rechaza", () => {
    expect(json).not.toContain('"$schema"');
    expect(json).not.toContain('"minItems"');
    expect(json).not.toContain('"maxItems"');
    expect(json).not.toContain('"propertyNames"');
    expect(json).not.toContain('"anyOf"');
    expect(json).not.toContain('"const"');
  });

  it("los literales numéricos pasan de anyOf/const a enum", () => {
    const radio = (esquemaLanding as { properties: { tokens: { properties: { radio: unknown } } } }).properties.tokens.properties.radio;
    expect(radio).toEqual({ type: "number", enum: [0, 4, 8, 16, 999] });
  });

  it("el adaptador manda ese esquema y un 400 se explica en una línea, sin la clave", async () => {
    const enviados: unknown[] = [];
    const cliente: ClienteGemini = {
      models: {
        async generateContent(p) {
          enviados.push(p.config.responseJsonSchema);
          throw Object.assign(new Error(JSON.stringify(gemini400)), { status: 400 });
        },
      },
    };
    const p = crearGemini({ GEMINI_API_KEY: "clave-secreta-123456", GEMINI_MODEL_RESPALDO: "" }, cliente);
    const e = await fallo(p.generarJSON({ ...peticion, esquema: LandingDoc.omit({ critica: true }) as never }));
    expect(e.tipo).toBe("red");
    expect(e.message).toBe("gemini: error del servicio (400): Request contains an invalid argument.");
    expect(JSON.stringify(enviados[0])).not.toContain('"anyOf"');
  });
});

describe("Gemini · 503 de alta demanda es transitorio", () => {
  it("se clasifica como límite (no red) y el error es legible", async () => {
    const { cliente } = geminiQueFalla(503, gemini503);
    const e = await fallo(crearGemini({ GEMINI_API_KEY: "k", GEMINI_MODEL_RESPALDO: "" }, cliente).generarJSON(peticion));
    expect(e.tipo).toBe("limite");
    expect(e.message).toContain("(503): This model is currently experiencing high demand");
  });

  it("pasa al modelo de respaldo y lo reporta como modelo usado", async () => {
    const { cliente, modelos } = geminiQueFalla(503, gemini503, "gemini-3.1-flash-lite");
    const r = await crearGemini({ GEMINI_API_KEY: "k", GEMINI_MODEL: "gemini-flash-latest" }, cliente).generarJSON(peticion);
    expect(modelos).toEqual(["gemini-flash-latest", "gemini-3.1-flash-lite"]);
    expect(r).toMatchObject({ modelo: "gemini-3.1-flash-lite", datos: { titulo: "desde el respaldo" } });
  });

  it("el enrutador reintenta con espera y luego sigue con el siguiente proveedor", async () => {
    const { cliente } = geminiQueFalla(503, gemini503);
    const gemini = crearGemini({ GEMINI_API_KEY: "k", GEMINI_MODEL_RESPALDO: "" }, cliente);
    const { proveedor: groq } = compatible("groq", () => respuesta(200, { choices: [{ message: { content: '{"titulo":"groq"}' } }] }));
    const espera = vi.fn(async () => {});
    const r = await ejecutar({ tarea: "objeciones", ...peticion }, { proveedores: [gemini, groq], registrarUso: async () => {}, espera });
    expect(espera).toHaveBeenCalledWith(2000);
    expect(r.proveedor).toBe("groq");
  });
});

describe("Groq · 400 y límites", () => {
  it("un 400 del servidor muestra el motivo del proveedor en una línea", async () => {
    const { proveedor } = compatible("groq", () => respuesta(400, groq400));
    const e = await fallo(proveedor.generarJSON(peticion));
    // Groq no llegó a cerrar un JSON válido: se trata como `json` para que el enrutador lo corrija y reintente.
    expect(e.tipo).toBe("json");
    expect(e.message).toBe("groq: JSON incompleto (400): Failed to generate JSON. Please adjust your prompt. See 'failed_generation' for more details.");
  });

  it("el 429 por tokens por minuto es un límite y sugiere cuánto esperar", async () => {
    const { proveedor } = compatible("groq", () => respuesta(429, groq429));
    const e = await fallo(proveedor.generarJSON(peticion));
    expect(e.tipo).toBe("limite");
    expect(e.message).toContain("tokens per minute (TPM): Limit 8000");
    expect(e.message).not.toContain("clave-secreta");
    expect(esperaSugeridaMs(e.message)).toBe(19110);
  });

  it("una petición que no cabe en el cupo por minuto se descarta sin llamar a la red", async () => {
    const { proveedor, fetchFn } = compatible("groq", () => respuesta(200, {}), { limiteTokensMinuto: 8000 });
    const e = await fallo(proveedor.generarJSON({ ...peticion, usuario: "x".repeat(30_000) }));
    expect(e).toBeInstanceOf(ErrorNoCabe);
    expect(e.tipo).toBe("limite");
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("el enrutador no reintenta lo que no cabe y sigue con el siguiente", async () => {
    const { proveedor: groq } = compatible("groq", () => respuesta(200, {}), { limiteTokensMinuto: 8000 });
    const { proveedor: otro } = compatible("openrouter", () => respuesta(200, { choices: [{ message: { content: '{"titulo":"ok"}' } }] }));
    const espera = vi.fn(async () => {});
    const r = await ejecutar(
      { tarea: "landing", ...peticion, usuario: "x".repeat(30_000) },
      { proveedores: [groq, otro], registrarUso: async () => {}, espera },
    );
    expect(r.proveedor).toBe("openrouter");
    expect(espera).not.toHaveBeenCalled();
  });

  it("un 503 HTTP también es un límite transitorio", async () => {
    const { proveedor } = compatible("groq", () => respuesta(503, { error: { message: "Service unavailable" } }));
    expect((await fallo(proveedor.generarJSON(peticion))).tipo).toBe("limite");
  });
});

describe("OpenRouter · formatos reales de respuesta", () => {
  it("content vacío con el JSON al final del razonamiento: gana el JSON más completo", async () => {
    const { proveedor } = compatible("openrouter", () => respuesta(200, razonamiento));
    const r = await proveedor.generarJSON({ ...peticion, esquema: z.object({ titulo: z.string(), extra: z.array(z.number()) }) });
    expect(r.datos).toEqual({ titulo: "Postura recta, dia largo", extra: [1, 2, 3] });
    expect(r.tokens).toEqual({ entrada: 40, salida: 90 });
  });

  it("bloque <think>, texto antes y cerca de código Markdown", async () => {
    const { proveedor } = compatible("openrouter", () => respuesta(200, textoAntes));
    expect((await proveedor.generarJSON(peticion)).datos).toEqual({ titulo: "Titulo real" });
  });

  it("un 429 del modelo principal pasa al modelo de respaldo y lo reporta", async () => {
    const usados: string[] = [];
    const fetchFn = vi.fn(async (_u: unknown, init?: RequestInit) => {
      const modelo = JSON.parse(String(init?.body)).model as string;
      usados.push(modelo);
      return modelo === "principal:free" ? respuesta(429, { error: { message: "Provider returned error" } }) : respuesta(200, textoAntes);
    });
    const proveedor = crearProveedorCompatible({
      id: "openrouter",
      baseUrl: "https://x.test/v1",
      clave: "k",
      modelo: "principal:free",
      modelosRespaldo: ["respaldo:free"],
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    const r = await proveedor.generarJSON(peticion);
    expect(usados).toEqual(["principal:free", "respaldo:free"]);
    expect(r.modelo).toBe("respaldo:free");
  });

  it("sin content ni razonamiento es un error de JSON legible", async () => {
    const { proveedor } = compatible("openrouter", () => respuesta(200, { choices: [{ message: { content: "" } }] }));
    const e = await fallo(proveedor.generarJSON(peticion));
    expect(e.tipo).toBe("json");
  });
});
