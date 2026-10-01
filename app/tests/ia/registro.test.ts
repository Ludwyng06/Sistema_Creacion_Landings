import { describe, expect, it } from "vitest";
import { proveedoresDisponibles } from "@/lib/ia/registro";

const ids = (env: Record<string, string>) => proveedoresDisponibles(env).map((p) => p.id);

describe("registro", () => {
  it("omite los proveedores sin clave", () => {
    expect(ids({ GROQ_API_KEY: "g", OPENROUTER_API_KEY: "o" })).toEqual(["groq", "openrouter"]);
  });

  it("respeta el orden de IA_CASCADA", () => {
    const env = { GEMINI_API_KEY: "a", GROQ_API_KEY: "b", CEREBRAS_API_KEY: "c", OPENROUTER_API_KEY: "d" };
    expect(ids({ ...env, IA_CASCADA: "openrouter,groq,gemini,cerebras" })).toEqual([
      "openrouter",
      "groq",
      "gemini",
      "cerebras",
    ]);
  });

  it("usa el orden por defecto, ignora desconocidos, repetidos y espacios", () => {
    const env = { GEMINI_API_KEY: "a", GROQ_API_KEY: "b", CEREBRAS_API_KEY: "c" };
    expect(ids(env)).toEqual(["cerebras", "gemini", "groq"]);
    expect(ids({ ...env, IA_CASCADA: " Groq , nada, manual, groq ,gemini" })).toEqual(["groq", "gemini"]);
  });

  it("sin claves devuelve una lista vacía", () => {
    expect(ids({})).toEqual([]);
  });
});
