import { describe, expect, it } from "vitest";
import type { EventoConstruccion } from "@/lib/contratos";
import { POST as POST_REAL } from "@/app/api/construir/route";
import { POST as POST_MANUAL } from "@/app/api/construir/manual/route";
import { crearManejadorConstruir } from "@/lib/ia/construir-http";
import type { RegistradorUso } from "@/lib/ia/tipos";
import { briefCorrector, crearProveedores, docBase, manejadorBase } from "./ayudas";

const leerEventos = (texto: string): EventoConstruccion[] =>
  texto
    .trim()
    .split("\n")
    .map((linea) => {
      const e = JSON.parse(linea) as EventoConstruccion;
      expect(["tarea", "resultado", "manual", "error"]).toContain(e.tipo);
      return e;
    });

const post = (url: string, cuerpo: unknown) =>
  new Request(`http://localhost${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo),
  });

describe("POST /api/construir", () => {
  const { proveedores } = crearProveedores(["gemini", "groq"], manejadorBase());
  const registrarUso: RegistradorUso = async () => {};
  const manejador = crearManejadorConstruir({ enrutador: { proveedores, registrarUso, modo: "simultaneo", tablaTareas: {} } });

  it("responde NDJSON válido: un evento por línea y el último es `resultado`", async () => {
    const res = await manejador(post("/api/construir", { brief: briefCorrector, tecnicas: ["semilla"], numeroSemilla: 42 }));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/x-ndjson");
    const texto = await res.text();
    expect(texto.endsWith("\n")).toBe(true);
    const eventos = leerEventos(texto);
    expect(eventos.length).toBeGreaterThan(4);
    expect(eventos[0]).toMatchObject({ tipo: "tarea", estado: "en-curso" });
    expect(eventos.at(-1)!.tipo).toBe("resultado");
    expect(eventos.filter((e) => e.tipo === "resultado")).toHaveLength(1);
  });

  it("400 con mensaje legible si la petición no valida o no es JSON", async () => {
    const mal = await manejador(post("/api/construir", { brief: { nombre: "" }, tecnicas: [] }));
    expect(mal.status).toBe(400);
    expect((await mal.json()).error).toContain("nombre");
    const sinTecnicas = await manejador(post("/api/construir", { brief: briefCorrector }));
    expect(sinTecnicas.status).toBe(400);
    const roto = await manejador(post("/api/construir", "{no es json"));
    expect(roto.status).toBe(400);
  });

  it("la ruta real valida igual y, sin proveedores, cierra el flujo con un evento manual", async () => {
    const mal = await POST_REAL(post("/api/construir", { tecnicas: [] }));
    expect(mal.status).toBe(400);
    const anterior = { ...process.env };
    for (const k of ["GEMINI_API_KEY", "GROQ_API_KEY", "CEREBRAS_API_KEY", "OPENROUTER_API_KEY"]) delete process.env[k];
    try {
      const res = await POST_REAL(post("/api/construir", { brief: briefCorrector, tecnicas: [] }));
      const eventos = leerEventos(await res.text());
      expect(eventos.at(-1)!.tipo).toBe("manual");
    } finally {
      Object.assign(process.env, anterior);
    }
  });
});

describe("POST /api/construir/manual", () => {
  it("valida el JSON pegado (con bloque de código y texto alrededor) y devuelve doc y salud", async () => {
    const texto = `Aquí está la landing:\n\`\`\`json\n${JSON.stringify(docBase())}\n\`\`\`\nListo.`;
    const res = await POST_MANUAL(post("/api/construir/manual", { texto, brief: briefCorrector }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.doc.meta.slug).toBe("corrector-postura-bauhaus");
    expect(json.salud).toHaveLength(8);
    expect(json.salud[0].id).toBe("esquema");
  });

  it("400 con los errores de Zod legibles si el JSON no cumple", async () => {
    const doc = docBase() as unknown as Record<string, unknown>;
    doc.tokens = { colores: {} };
    const res = await POST_MANUAL(post("/api/construir/manual", { texto: JSON.stringify(doc), brief: briefCorrector }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("tokens");
  });

  it("400 si el texto no trae JSON, si falta el texto o si el cuerpo no es JSON", async () => {
    const sinJson = await POST_MANUAL(post("/api/construir/manual", { texto: "hola", brief: briefCorrector }));
    expect(sinJson.status).toBe(400);
    expect((await sinJson.json()).error).toContain("JSON");
    expect((await POST_MANUAL(post("/api/construir/manual", { brief: briefCorrector }))).status).toBe(400);
    expect((await POST_MANUAL(post("/api/construir/manual", "{roto"))).status).toBe(400);
  });
});
