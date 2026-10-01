import "../ayudas-db"; // primero: base SQLite aislada
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { crearLanding, guardarEnBanco, obtenerLanding } from "@/lib/landings";
import { combinar } from "@/lib/tecnicas/combinador";
import { capturar } from "../../scripts/capturas";
import { docBase } from "../construccion/ayudas";
import { briefCorrector } from "../tecnicas/briefs";

sharp.cache(false);
const hayChromium = existsSync(chromium.executablePath());
let media: string;
let servidor: Server | undefined;
let url = "";

async function landingEnBanco() {
  const l = await crearLanding({ brief: briefCorrector, tecnicas: [], prompt: combinar(briefCorrector, []), doc: docBase(), proveedor: "manual" });
  expect((await guardarEnBanco(l.id)).ok).toBe(true);
  return l;
}

beforeAll(async () => {
  media = await mkdtemp(join(tmpdir(), "capturas-"));
  await db.landing.deleteMany();
  servidor = createServer((req, res) => {
    if (req.url?.startsWith("/l/corrector-postura-bauhaus")) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end("<html><body style='margin:0'><h1 style='height:2000px;background:#369'>Hola</h1></body></html>");
    } else {
      res.statusCode = 404;
      res.end("no");
    }
  });
  await new Promise<void>((ok) => servidor!.listen(0, ok));
  url = `http://localhost:${(servidor!.address() as { port: number }).port}`;
});

afterAll(async () => {
  await new Promise<void>((ok) => (servidor ? servidor.close(() => ok()) : ok()));
  await rm(media, { recursive: true, force: true, maxRetries: 3 }).catch(() => {});
});

describe("npm run capturas", () => {
  it("sin landings en el banco no abre el navegador ni falla", async () => {
    await db.landing.deleteMany();
    const lineas: string[] = [];
    const r = await capturar({ url, mediaRaiz: media, log: (l) => lineas.push(l) });
    expect(r).toEqual({ miniaturas: [], vitrina: [] });
    expect(lineas.join(" ")).toContain("No hay landings en el banco");
  });

  it.skipIf(hayChromium)("sin el navegador de Playwright explica cómo instalarlo", async () => {
    await db.landing.deleteMany();
    await landingEnBanco();
    await expect(capturar({ url, mediaRaiz: media, log: () => {} })).rejects.toThrow(/npx playwright install chromium/);
  });

  it.skipIf(!hayChromium)("guarda la miniatura de 640 px y las capturas de vitrina; con 404 avisa y termina bien", async () => {
    await db.landing.deleteMany();
    const l = await landingEnBanco();
    const r = await capturar({ url, vitrina: true, mediaRaiz: media, log: () => {} });
    expect(r.miniaturas).toEqual([l.slug]);
    const meta = await sharp(join(media, l.id, "miniatura.webp")).metadata();
    expect([meta.format, meta.width]).toEqual(["webp", 640]);
    expect((await obtenerLanding(l.id)).miniatura).toBe(`/media/${l.id}/miniatura.webp`);
    expect(r.vitrina).toEqual([`/media/vitrina/${l.slug}-390.webp`, `/media/vitrina/${l.slug}-1280.webp`]);
    expect((await sharp(join(media, "vitrina", `${l.slug}-390.webp`)).metadata()).width).toBe(390);
    expect((await sharp(join(media, "vitrina", `${l.slug}-1280.webp`)).metadata()).height).toBeGreaterThan(1500); // página completa

  }, 120_000);

  it.skipIf(!hayChromium)("si /l/<slug> responde 404 lo dice y no captura nada", async () => {
    await db.landing.deleteMany();
    await landingEnBanco();
    await db.landing.updateMany({ data: { slug: "otra-landing" } });
    const lineas: string[] = [];
    const r = await capturar({ url, mediaRaiz: media, log: (x) => lineas.push(x) });
    expect(r.noEncontrada).toBe("otra-landing");
    expect(r.miniaturas).toEqual([]);
    expect(lineas.join(" ")).toContain("404");
  }, 120_000);
});
