import "../ayudas-db"; // primero: base SQLite aislada
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as ESTADO } from "@/app/api/ajustes/investigacion/route";
import { POST as INVESTIGAR } from "@/app/api/investigar/route";
import { crearGemini } from "@/lib/ia/gemini";
import { ejecutar } from "@/lib/ia/enrutador";
import type { ProveedorIA } from "@/lib/ia/tipos";
import { z } from "zod";

const guardada = process.env.SERPAPI_API_KEY;
beforeEach(() => {
  delete process.env.SERPAPI_API_KEY;
});
afterEach(() => {
  if (guardada === undefined) delete process.env.SERPAPI_API_KEY;
  else process.env.SERPAPI_API_KEY = guardada;
});

const json = (cuerpo: unknown) =>
  new Request("http://localhost/api/investigar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });

describe("POST /api/investigar", () => {
  it("400 si falta el nombre", async () => {
    const r = await INVESTIGAR(json({ categoria: "hogar" }));
    expect(r.status).toBe(400);
  });
  it("400 con una categoría fuera del enum", async () => {
    expect((await INVESTIGAR(json({ nombre: "Lámpara", categoria: "juguetes" }))).status).toBe(400);
  });
  it("400 si la foto está dañada", async () => {
    const form = new FormData();
    form.set("nombre", "Lámpara");
    form.set("imagen", new File([Buffer.from("no es una imagen")], "x.png", { type: "image/png" }));
    const r = await INVESTIGAR(new Request("http://localhost/api/investigar", { method: "POST", body: form }));
    expect(r.status).toBe(400);
    expect(((await r.json()) as { error: string }).error).toMatch(/foto|imagen/i);
  });
  it("503 legible sin clave de SerpAPI", async () => {
    const r = await INVESTIGAR(json({ nombre: "Corrector de postura", categoria: "salud-y-bienestar" }));
    expect(r.status).toBe(503);
    const c = (await r.json()) as { error: string };
    expect(c.error).toMatch(/opcional/);
    expect(c.error).toMatch(/SERPAPI_API_KEY/);
  });
});

describe("GET /api/ajustes/investigacion", () => {
  it("sin clave: estado sin-clave, sin gastar nada", async () => {
    const r = await ESTADO();
    expect(await r.json()).toEqual({ estado: "sin-clave" });
  });
});

describe("imagen en el enrutador", () => {
  const Esquema = z.object({ ok: z.boolean() });
  const proveedor = (id: "gemini" | "groq", soportaImagen: boolean, vistos: string[]) =>
    ({
      id,
      soportaImagen,
      disponible: () => true,
      async generarJSON() {
        vistos.push(id);
        return { datos: { ok: true }, proveedor: id, modelo: "sim", ms: 1 };
      },
    }) as unknown as ProveedorIA;

  it("una tarea con imagen solo se envía a proveedores con visión", async () => {
    const vistos: string[] = [];
    const r = await ejecutar(
      { tarea: "identificar-producto", sistema: "s", usuario: "u", esquema: Esquema, imagen: { mimeType: "image/jpeg", base64: "AAAA" } },
      { proveedores: [proveedor("groq", false, vistos), proveedor("gemini", true, vistos)], registrarUso: async () => {}, modo: "cascada" },
    );
    expect(r.proveedor).toBe("gemini");
    expect(vistos).toEqual(["gemini"]);
  });

  it("Gemini manda la imagen como inlineData junto al texto", async () => {
    let contenido: unknown;
    const gemini = crearGemini(
      { GEMINI_API_KEY: "k-de-prueba-123456" },
      {
        models: {
          async generateContent(p) {
            contenido = p.contents;
            return { text: '{"ok":true}' };
          },
        },
      },
    );
    await gemini.generarJSON({ sistema: "s", usuario: "mira", esquema: Esquema, imagen: { mimeType: "image/jpeg", base64: "QUJD" } });
    expect(contenido).toEqual([{ role: "user", parts: [{ text: "mira" }, { inlineData: { mimeType: "image/jpeg", data: "QUJD" } }] }]);
  });
});
