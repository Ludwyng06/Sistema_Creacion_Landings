import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import type { ZodType } from "zod";
import { fluxHabilitado, generarImagen, hashPrompt, URL_FLUX, URL_FLUX_RESPALDO } from "@/lib/imagenes/flux";
import { CONFIANZA_MINIMA, validarImagen } from "@/lib/imagenes/validar";
import type { ProveedorIA } from "@/lib/ia/tipos";

const png = (w = 64, h = 64) => sharp({ create: { width: w, height: h, channels: 3, background: "#336699" } }).png().toBuffer();

/** Respuesta grabada de nscale: { created, data: [{ b64_json }] }. */
async function respuestaFlux() {
  return JSON.stringify({ created: 1, data: [{ b64_json: (await png(1024, 1024)).toString("base64") }] });
}

describe("generador FLUX", () => {
  it("genera por nscale, guarda WebP por el hash del prompt y no repite la generación", async () => {
    const dirMedia = mkdtempSync(join(tmpdir(), "flux-"));
    const llamadas: { url: string; cuerpo: Record<string, unknown>; auth: string | null }[] = [];
    const fetchFn = (async (url: string | URL | Request, init?: RequestInit) => {
      llamadas.push({ url: String(url), cuerpo: JSON.parse(String(init?.body)), auth: new Headers(init?.headers).get("Authorization") });
      return new Response(await respuestaFlux());
    }) as typeof fetch;
    const op = { dirMedia, env: { HF_TOKEN: "hf_secreto" }, fetchFn };
    const a = await generarImagen("A white projector on a nightstand. No text.", "1:1", op);
    expect(llamadas).toHaveLength(1);
    expect(llamadas[0].url).toBe(URL_FLUX);
    expect(llamadas[0].cuerpo).toMatchObject({ model: "black-forest-labs/FLUX.1-schnell", size: "1024x1024", response_format: "b64_json" });
    expect(llamadas[0].auth).toBe("Bearer hf_secreto");
    expect(a.ruta).toBe(`/media/bancos/generadas/${hashPrompt("A white projector on a nightstand. No text.", "1:1")}.webp`);
    expect(existsSync(join(dirMedia, a.ruta.replace(/^\/media\//, "")))).toBe(true);
    expect(a.deCache).toBe(false);
    const b = await generarImagen("A white projector on a nightstand. No text.", "1:1", op);
    expect(b.deCache).toBe(true);
    expect(llamadas).toHaveLength(1); // caché por prompt: no gasta crédito
    expect(hashPrompt("x", "1:1")).not.toBe(hashPrompt("x", "16:9"));
  });

  it("cada proporción pide su tamaño", async () => {
    const dirMedia = mkdtempSync(join(tmpdir(), "flux-"));
    const tamanos: string[] = [];
    const fetchFn = (async (_u: string | URL | Request, init?: RequestInit) => (tamanos.push(JSON.parse(String(init?.body)).size), new Response(await respuestaFlux()))) as typeof fetch;
    for (const r of ["16:9", "4:5", "9:16"] as const) await generarImagen(`prompt ${r}`, r, { dirMedia, env: { HF_TOKEN: "t" }, fetchFn });
    expect(tamanos).toEqual(["1344x768", "896x1152", "768x1344"]);
  });

  it("sin HF_TOKEN no llama a la red y avisa qué falta", async () => {
    const dirMedia = mkdtempSync(join(tmpdir(), "flux-"));
    let llamadas = 0;
    const fetchFn = (async () => (llamadas++, new Response("x"))) as typeof fetch;
    expect(fluxHabilitado({})).toBe(false);
    await expect(generarImagen("p", "1:1", { dirMedia, env: {}, fetchFn })).rejects.toMatchObject({ tipo: "deshabilitada" });
    expect(llamadas).toBe(0);
  });

  it("si nscale responde 5xx prueba fal-ai; con 402 avisa que se acabó el crédito", async () => {
    const dirMedia = mkdtempSync(join(tmpdir(), "flux-"));
    const urls: string[] = [];
    const conRespaldo = (async (url: string | URL | Request) => {
      const u = String(url);
      urls.push(u);
      if (u === URL_FLUX) return new Response("caído", { status: 503 });
      if (u === URL_FLUX_RESPALDO) return new Response(JSON.stringify({ images: [{ url: "https://cdn.fal.media/x.png" }] }));
      return new Response(await png(512, 512));
    }) as typeof fetch;
    const r = await generarImagen("respaldo", "1:1", { dirMedia, env: { HF_TOKEN: "t" }, fetchFn: conRespaldo });
    expect(r.modelo).toContain("fal-ai");
    expect(urls).toEqual([URL_FLUX, URL_FLUX_RESPALDO, "https://cdn.fal.media/x.png"]);
    const sinCredito = (async () => new Response("payment required", { status: 402 })) as typeof fetch;
    await expect(generarImagen("sin credito", "1:1", { dirMedia, env: { HF_TOKEN: "t" }, fetchFn: sinCredito })).rejects.toMatchObject({ tipo: "cupo" });
    const sinAcceso = (async () => new Response("no", { status: 401 })) as typeof fetch;
    await expect(generarImagen("sin acceso", "1:1", { dirMedia, env: { HF_TOKEN: "t" }, fetchFn: sinAcceso })).rejects.toMatchObject({ tipo: "auth" });
  });

  it("el token no aparece en ningún mensaje de error", async () => {
    const dirMedia = mkdtempSync(join(tmpdir(), "flux-"));
    const fetchFn = (async () => { throw new Error("fallo con hf_secreto"); }) as typeof fetch;
    await expect(generarImagen("token", "1:1", { dirMedia, env: { HF_TOKEN: "hf_secreto" }, fetchFn })).rejects.toSatisfy((e: Error) => !e.message.includes("hf_secreto"));
  });
});

function proveedorVision(respuesta: unknown, vistas: { imagen?: boolean; usuario: string }[] = []): ProveedorIA {
  return {
    id: "gemini",
    disponible: () => true,
    soportaImagen: true,
    async generarJSON<T>(p: { usuario: string; esquema: ZodType<T>; imagen?: unknown }) {
      vistas.push({ imagen: p.imagen !== undefined, usuario: p.usuario });
      return { datos: p.esquema.parse(respuesta), proveedor: "gemini" as const, modelo: "sim", ms: 1 };
    },
  } as ProveedorIA;
}
const deps = (p: ProveedorIA) => ({ proveedores: [p], registrarUso: async () => {}, tablaTareas: {}, config: {}, espera: async () => {} });

describe("validar-imagen", () => {
  it("manda la imagen con lo esperado y devuelve apta, motivo y confianza", async () => {
    const vistas: { imagen?: boolean; usuario: string }[] = [];
    const r = await validarImagen(await png(), "un cepillo dental eléctrico", deps(proveedorVision({ apta: true, motivo: "Muestra un cepillo eléctrico blanco sobre fondo liso", confianza: 0.92 }, vistas)));
    expect(vistas[0].imagen).toBe(true);
    expect(vistas[0].usuario).toContain("un cepillo dental eléctrico");
    expect(r).toMatchObject({ apta: true, confianza: 0.92, proveedor: "gemini" });
  });

  it("una imagen con logos o texto no es apta", async () => {
    const r = await validarImagen(await png(), "un cepillo", deps(proveedorVision({ apta: false, motivo: "Se ve una caja con el logo de Colgate", confianza: 0.95 })));
    expect(r.apta).toBe(false);
    expect(r.motivo).toContain("logo");
  });

  it("una respuesta apta pero dudosa (confianza baja) cuenta como no apta", async () => {
    const r = await validarImagen(await png(), "x", deps(proveedorVision({ apta: true, motivo: "Quizá sea lo esperado", confianza: CONFIANZA_MINIMA - 0.1 })));
    expect(r.apta).toBe(false);
  });

  it("solo la atiende un proveedor con visión", async () => {
    const sinVision: ProveedorIA = { id: "groq", disponible: () => true, async generarJSON() { throw new Error("no debería llamarse"); } };
    await expect(validarImagen(await png(), "x", deps(sinVision))).rejects.toBeTruthy();
  });
});
