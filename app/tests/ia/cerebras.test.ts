import { describe, expect, it } from "vitest";
import { z } from "zod";
import { colaCompartida, crearColaRpm } from "@/lib/ia/cola-rpm";
import { crearProveedorCompatible } from "@/lib/ia/openai-compat";
import { CASCADA_ID_POR_DEFECTO, proveedoresDisponibles } from "@/lib/ia/registro";
import { TABLA_TAREAS_POR_DEFECTO } from "@/lib/ia/enrutador";

/** Reloj falso: `dormir` adelanta el tiempo. */
function reloj() {
  let t = 1_000_000;
  const esperas: number[] = [];
  return { ahora: () => t, dormir: async (ms: number) => void (esperas.push(ms), (t += ms)), esperas };
}

describe("cola de 5 peticiones por minuto", () => {
  it("las 5 primeras pasan sin esperar y la sexta espera a que salga la primera de la ventana", async () => {
    const r = reloj();
    const cola = crearColaRpm(5, r);
    for (let i = 0; i < 5; i++) await cola.esperar();
    expect(r.esperas).toEqual([]);
    expect(cola.enVentana()).toBe(5);
    const t0 = r.ahora();
    await cola.esperar();
    expect(r.esperas.length).toBe(1);
    expect(r.ahora() - t0).toBeGreaterThanOrEqual(60_000);
  });

  it("nunca más de 5 en ninguna ventana de 60 s, con 17 peticiones a la vez y en orden", async () => {
    const r = reloj();
    const cola = crearColaRpm(5, r);
    const marcas: number[] = [];
    const orden: number[] = [];
    await Promise.all(Array.from({ length: 17 }, (_, i) => cola.esperar().then(() => (marcas.push(r.ahora()), orden.push(i)))));
    expect(orden).toEqual(Array.from({ length: 17 }, (_, i) => i));
    for (let i = 5; i < marcas.length; i++) expect(marcas[i] - marcas[i - 5]).toBeGreaterThanOrEqual(60_000);
    for (const m of marcas) expect(marcas.filter((x) => x >= m && x < m + 60_000).length).toBeLessThanOrEqual(5);
  });

  it("es compartida por proveedor en todo el proceso", () => {
    expect(colaCompartida("cerebras", 5)).toBe(colaCompartida("cerebras", 5));
    expect(colaCompartida("cerebras", 5)).not.toBe(colaCompartida("groq", 5));
  });
});

describe("Cerebras como proveedor principal de texto", () => {
  it("cada intento HTTP espera su turno en la cola antes de llamar", async () => {
    const eventos: string[] = [];
    const p = crearProveedorCompatible({
      id: "cerebras",
      baseUrl: "https://api.cerebras.ai/v1",
      clave: "k",
      modelo: "gpt-oss-120b",
      cola: { esperar: async () => void eventos.push("cola") },
      fetchFn: (async () => (eventos.push("http"), new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }], usage: { prompt_tokens: 1, completion_tokens: 1 } })))) as typeof fetch,
    });
    const r = await p.generarJSON({ sistema: "s", usuario: "u", esquema: z.object({ ok: z.boolean() }) });
    expect(r.datos.ok).toBe(true);
    expect(eventos).toEqual(["cola", "http"]);
  });

  it("la cascada por defecto empieza por OpenAI y deja a Cerebras, Gemini, Groq y OpenRouter de respaldo", () => {
    expect(CASCADA_ID_POR_DEFECTO).toEqual(["openai", "cerebras", "gemini", "groq", "openrouter"]);
    const ids = proveedoresDisponibles({ OPENAI_API_KEY: "z", CEREBRAS_API_KEY: "a", GEMINI_API_KEY: "b", GROQ_API_KEY: "c", OPENROUTER_API_KEY: "d" }).map((x) => x.id);
    expect(ids).toEqual(["openai", "cerebras", "gemini", "groq", "openrouter"]);
    expect(proveedoresDisponibles({ CEREBRAS_API_KEY: "a", GEMINI_API_KEY: "b" }).map((x) => x.id)).toEqual(["cerebras", "gemini"]); // sin clave de OpenAI no entra
  });

  it("la tabla de tareas manda el texto y la visión a OpenAI", () => {
    for (const t of ["estrategia", "plan-secciones", "redactar-seccion", "critico", "intake", "landing", "validar-imagen"] as const) expect(TABLA_TAREAS_POR_DEFECTO[t], t).toBe("openai");
  });
});
