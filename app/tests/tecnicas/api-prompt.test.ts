import { describe, expect, it } from "vitest";
import { PromptEstructurado, Tokens } from "@/lib/contratos";
import { POST } from "@/app/api/prompt/route";
import { briefCorrector } from "./briefs";

const peticion = (cuerpo: unknown) =>
  new Request("http://localhost/api/prompt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo),
  });

describe("POST /api/prompt", () => {
  it("200 con un brief válido: prompt, texto, semilla y tokens", async () => {
    const res = await POST(peticion({ brief: briefCorrector, tecnicas: ["semilla", "ambicioso"], numeroSemilla: 42 }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(() => PromptEstructurado.parse(json.prompt)).not.toThrow();
    expect(() => Tokens.parse(json.tokens)).not.toThrow();
    expect(json.semilla.numero).toBe(42);
    for (const h of ["### ROL", "### TAREA", "### CONTEXTO", "### FORMATO"]) expect(json.texto).toContain(h);
    expect(json.prompt.aportes.some((a: { tecnica: string }) => a.tecnica === "negativas")).toBe(true);
  });

  it("es reproducible con el mismo numeroSemilla", async () => {
    const cuerpo = { brief: briefCorrector, tecnicas: ["semilla"], numeroSemilla: 7 };
    const a = await (await POST(peticion(cuerpo))).json();
    const b = await (await POST(peticion(cuerpo))).json();
    expect(a).toEqual(b);
  });

  it("sin numeroSemilla tira una semilla y la devuelve; sin técnicas usa el perfil Esencial", async () => {
    const res = await POST(peticion({ brief: briefCorrector }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Number.isInteger(json.semilla.numero)).toBe(true);
    expect(new Set(json.prompt.aportes.map((a: { tecnica: string }) => a.tecnica))).toEqual(
      new Set(["ambicioso", "sustractivo", "negativas"]),
    );
  });

  it("aplica intensidad y colores de marca del brief a los tokens", async () => {
    const brief = { ...briefCorrector, intensidad: 1, coloresMarca: ["#0055AA"] };
    const json = await (await POST(peticion({ brief, numeroSemilla: 1 }))).json();
    expect(json.tokens.intensidad).toBe(1);
    expect(json.tokens.colores.acento).toBe("#0055AA");
  });

  it("400 con mensaje legible si el brief es inválido", async () => {
    const res = await POST(peticion({ brief: { nombre: "" }, tecnicas: [] }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(typeof json.error).toBe("string");
    expect(json.error).toContain("nombre");
  });

  it("400 con una técnica desconocida", async () => {
    const res = await POST(peticion({ brief: briefCorrector, tecnicas: ["magia"] }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("tecnicas");
  });

  it("400 si el cuerpo no es JSON", async () => {
    const res = await POST(peticion("{no es json"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("JSON");
  });
});
