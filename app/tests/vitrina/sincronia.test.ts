import "../ayudas-db";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import type { Asset, LandingDoc } from "@/lib/contratos";
import { db } from "@/lib/db";
import { crearLanding, obtenerPorSlug, upsertLandingPorSlug } from "@/lib/landings";
import { publicarEnVitrina } from "@/lib/vitrina/medios";
import { rutasReferenciadas } from "@/lib/vitrina/referencias";
import { docBase, briefCorrector } from "../construccion/ayudas";
import { combinar } from "@/lib/tecnicas/combinador";

const prompt = () => combinar(briefCorrector, [], undefined);
const conRutas = (slug: string, archivos: string[], puntaje = 8): LandingDoc => {
  const d = docBase();
  d.meta.slug = slug;
  d.assets = archivos.map<Asset>((f, i) => ({ slot: `s${i}`, tipo: "imagen", relacion: "16:9", promptGrok: "p", alt: "a", ruta: `/media/vitrina/${slug}/${f}` }));
  d.critica = { puntaje, porCriterio: [], problemas: [], correcciones: [] };
  return d;
};
const archivo = (dir: string, slug: string, f: string) => sharp({ create: { width: 20, height: 20, channels: 3, background: "#123456" } }).webp().toFile(join(dir, "vitrina", slug, f));

describe("la vitrina nunca borra una imagen que alguien usa", () => {
  it("conserva lo que la base y los JSON referencian y borra solo lo huérfano", async () => {
    const dirMedia = mkdtempSync(join(tmpdir(), "sync-"));
    mkdirSync(join(dirMedia, "vitrina", "mi-slug"), { recursive: true });
    for (const f of ["vieja-en-base.webp", "vieja-en-json.webp", "huerfana.webp", "nueva.webp"]) await archivo(dirMedia, "mi-slug", f);
    // La base guarda la versión anterior, que usa `vieja-en-base`.
    await crearLanding({ brief: briefCorrector, tecnicas: [], prompt: prompt(), doc: conRutas("mi-slug", ["vieja-en-base.webp"]), proveedor: "gemini" });
    // Un JSON de la vitrina usa `vieja-en-json`.
    const datos = join(dirMedia, "datos");
    mkdirSync(datos);
    writeFileSync(join(datos, "otra.json"), JSON.stringify({ doc: conRutas("otra", ["x.webp"]) }));
    writeFileSync(join(datos, "mi-slug.json"), JSON.stringify({ doc: conRutas("mi-slug", ["vieja-en-json.webp"]) }));
    const protegidas = await rutasReferenciadas(datos);
    expect(protegidas.has("/media/vitrina/mi-slug/vieja-en-base.webp")).toBe(true);
    expect(protegidas.has("/media/vitrina/mi-slug/vieja-en-json.webp")).toBe(true);
    // Se publica la versión nueva, que solo usa `nueva`.
    mkdirSync(join(dirMedia, "bancos", "b1"), { recursive: true });
    await sharp({ create: { width: 20, height: 20, channels: 3, background: "#000" } }).webp().toFile(join(dirMedia, "bancos", "b1", "nueva.webp"));
    await publicarEnVitrina({ ...conRutas("mi-slug", []), assets: [{ slot: "s", tipo: "imagen", relacion: "16:9", promptGrok: "p", alt: "a", ruta: "/media/bancos/b1/nueva.webp" }] }, "mi-slug", dirMedia, protegidas);
    expect(readdirSync(join(dirMedia, "vitrina", "mi-slug")).sort()).toEqual(["nueva.webp", "vieja-en-base.webp", "vieja-en-json.webp"]);
    expect(existsSync(join(dirMedia, "vitrina", "mi-slug", "huerfana.webp"))).toBe(false);
  });
});

describe("upsert por slug", () => {
  it("actualiza la landing sin borrarla: mismo id, datos nuevos, una versión más y los leads intactos", async () => {
    const v1 = conRutas("vitrina-upsert", ["a.webp"], 7.5);
    const creada = await crearLanding({ brief: briefCorrector, tecnicas: [], prompt: prompt(), doc: v1, proveedor: "gemini" });
    await db.lead.create({ data: { landingId: creada.id, datos: JSON.stringify({ nombre: "Ana" }) } });
    const v2 = conRutas("vitrina-upsert", ["b.webp"], 9.6);
    const nueva = await upsertLandingPorSlug({ brief: briefCorrector, tecnicas: [], prompt: prompt(), doc: v2, proveedor: "groq" });
    expect(nueva.id).toBe(creada.id);
    expect(nueva.puntaje).toBe(9.6);
    expect(nueva.proveedor).toBe("groq");
    const leida = await obtenerPorSlug("vitrina-upsert");
    expect(leida?.doc.assets[0].ruta).toBe("/media/vitrina/vitrina-upsert/b.webp");
    expect(await db.landing.count({ where: { slug: "vitrina-upsert" } })).toBe(1);
    expect(await db.version.count({ where: { landingId: creada.id } })).toBe(2);
    expect(await db.lead.count({ where: { landingId: creada.id } })).toBe(1);
  });

  it("si no existe, la crea", async () => {
    const r = await upsertLandingPorSlug({ brief: briefCorrector, tecnicas: [], prompt: prompt(), doc: conRutas("vitrina-nueva", ["a.webp"]), proveedor: "gemini" });
    expect((await obtenerPorSlug("vitrina-nueva"))?.id).toBe(r.id);
  });
});
