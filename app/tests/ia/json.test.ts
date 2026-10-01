import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ErrorIA } from "@/lib/ia/tipos";
import { extraerJSON, validar } from "@/lib/ia/json";
import { armarPromptManual, proveedorManual, validarPegado } from "@/lib/ia/manual";

const esquema = z.object({ titulo: z.string(), n: z.number() });

describe("extraerJSON", () => {
  it("quita los bloques de código Markdown", () => {
    expect(extraerJSON('```json\n{"titulo":"a","n":1}\n```')).toEqual({ titulo: "a", n: 1 });
    expect(extraerJSON('```\n[1,2]\n```')).toEqual([1, 2]);
  });

  it("toma el JSON con texto antes y después", () => {
    const texto = 'Claro, aquí va: {"titulo":"hola {mundo}","n":2} ¡Listo!';
    expect(extraerJSON(texto)).toEqual({ titulo: "hola {mundo}", n: 2 });
  });

  it("respeta comillas escapadas y llaves anidadas", () => {
    expect(extraerJSON('x {"a":{"b":"\\"}"},"c":[1,{"d":2}]} y')).toEqual({ a: { b: '"}' }, c: [1, { d: 2 }] });
  });

  it("salta un bloque roto y usa el siguiente JSON válido", () => {
    expect(extraerJSON('{no es json} luego {"n":3}')).toEqual({ n: 3 });
  });

  it("lanza ErrorIA('json') si no hay JSON", () => {
    expect(() => extraerJSON("solo texto")).toThrow(ErrorIA);
    try {
      extraerJSON("{ sin cerrar");
    } catch (e) {
      expect((e as ErrorIA).tipo).toBe("json");
    }
  });
});

describe("validar", () => {
  it("devuelve los datos válidos", () => {
    expect(validar(esquema, { titulo: "a", n: 1 })).toEqual({ titulo: "a", n: 1 });
  });

  it("lanza ErrorIA('json') con el mensaje legible de Zod", () => {
    try {
      validar(esquema, { titulo: 5 });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ErrorIA);
      expect((e as ErrorIA).tipo).toBe("json");
      expect((e as ErrorIA).message).toContain("titulo");
    }
  });
});

describe("validar con nulos (Groq pone null en campos opcionales)", () => {
  const esquema = z.object({ a: z.string(), intencion: z.object({ objecion: z.string().optional() }), lista: z.array(z.string().nullable()) });
  it("acepta null en propiedades opcionales y lo quita del resultado", () => {
    expect(validar(esquema, { a: "x", intencion: { objecion: null }, lista: ["y", null] })).toEqual({ a: "x", intencion: {}, lista: ["y", null] });
  });
  it("sigue rechazando un null en un campo obligatorio", () => {
    expect(() => validar(esquema, { a: null, intencion: {}, lista: [] })).toThrow(ErrorIA);
  });
});

describe("modo manual", () => {
  it("siempre está disponible y no llama a nada", async () => {
    expect(proveedorManual.disponible()).toBe(true);
    await expect(
      proveedorManual.generarJSON({ sistema: "s", usuario: "u", esquema }),
    ).rejects.toBeInstanceOf(ErrorIA);
  });

  it("arma el prompt con el esquema y valida un JSON pegado", () => {
    const prompt = armarPromptManual({ sistema: "Sé breve", usuario: "Hola", esquema });
    expect(prompt.usuario).toBe("Hola");
    expect(prompt.sistema).toContain("Sé breve");
    expect(prompt.sistema).toContain('"titulo"');
    expect(validarPegado('Aquí:\n```json\n{"titulo":"x","n":4}\n```', esquema)).toEqual({ titulo: "x", n: 4 });
    expect(() => validarPegado('{"titulo":"x"}', esquema)).toThrow(ErrorIA);
  });
});
