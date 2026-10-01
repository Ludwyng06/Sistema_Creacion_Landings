import { describe, expect, it } from "vitest";
import { z } from "zod";
import { crearGuardiaCupoDia, guardiaCompartida, leerCupoDia } from "@/lib/ia/cupo-dia";
import { ErrorNoCabe } from "@/lib/ia/errores-http";
import { crearProveedorCompatible } from "@/lib/ia/openai-compat";

const Esquema = z.object({ ok: z.boolean() });
const cuerpoOk = JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }], usage: { prompt_tokens: 10, completion_tokens: 5 } });

function respuesta(h: Record<string, string>) {
  return new Response(cuerpoOk, { status: 200, headers: h });
}

describe("20-A · cupo del día de Cerebras", () => {
  it("lee los encabezados del día y los ignora si no están", () => {
    expect(leerCupoDia(new Headers({ "x-ratelimit-remaining-tokens-day": "900", "x-ratelimit-remaining-requests-day": "40", "x-ratelimit-reset-tokens-day": "3600" }))).toEqual({ tokensDia: 900, peticionesDia: 40, reinicioS: 3600 });
    expect(leerCupoDia(new Headers())).toBeNull();
  });

  it("salta a otro proveedor (ErrorNoCabe, sin llamar) cuando quedan pocos tokens del día", async () => {
    let llamadas = 0;
    const p = crearProveedorCompatible({
      id: "cerebras",
      baseUrl: "https://x",
      clave: "k",
      modelo: "m",
      cupoDia: crearGuardiaCupoDia(),
      fetchFn: (async () => (llamadas++, respuesta({ "x-ratelimit-remaining-tokens-day": "3000", "x-ratelimit-remaining-requests-day": "500" }))) as typeof fetch,
    });
    await p.generarJSON({ sistema: "s", usuario: "u", esquema: Esquema, maxTokens: 500 }); // la primera pasa y registra el cupo
    expect(llamadas).toBe(1);
    await expect(p.generarJSON({ sistema: "s", usuario: "u", esquema: Esquema })).rejects.toBeInstanceOf(ErrorNoCabe);
    expect(llamadas).toBe(1);
  });

  it("salta cuando quedan pocas peticiones del día y vuelve a probar tras el reinicio", async () => {
    let t = 0;
    const g = crearGuardiaCupoDia({ ahora: () => t });
    g.registrar({ tokensDia: 900_000, peticionesDia: 1, reinicioS: 600 });
    expect(g.bloqueo(1000)).toMatch(/peticiones del día/);
    t = 601_000;
    expect(g.bloqueo(1000)).toBeNull();
  });

  it("con cupo de sobra no bloquea y la guardia compartida es una por proveedor", () => {
    const g = crearGuardiaCupoDia();
    g.registrar({ tokensDia: 800_000, peticionesDia: 10_000 });
    expect(g.bloqueo(5000)).toBeNull();
    expect(guardiaCompartida("cerebras")).toBe(guardiaCompartida("cerebras"));
  });
});
