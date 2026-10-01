import "../ayudas-db"; // primero: base SQLite aislada
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { POST as DUPLICAR } from "@/app/api/landings/[id]/duplicar/route";
import DetalleBanco from "@/app/banco/[id]/page";
import PaginaBanco from "@/app/banco/page";
import { EstadoVacio } from "@/componentes/banco/Galeria";
import type { LandingCompleta } from "@/lib/landings";
import { crearLanding, duplicarLanding, guardarEnBanco, guardarVersion, listarLandingsCompletas, listarVersiones, obtenerLanding } from "@/lib/landings";
import { combinar } from "@/lib/tecnicas/combinador";
import { lintearTexto } from "@/lib/tecnicas/lista-negra";
import { landingEjemplo } from "../fixtures/landing-ejemplo";
import { briefCorrector } from "../tecnicas/briefs";

// Los componentes con estado usan el router de la app; aquí solo se renderiza el HTML del servidor.
vi.mock("next/navigation", async () => {
  const real = await vi.importActual<typeof import("next/navigation")>("next/navigation");
  return { ...real, useRouter: () => ({ push: () => {}, refresh: () => {} }) };
});

const prompt = combinar(briefCorrector, ["semilla", "humana"]);
let original: LandingCompleta;

beforeAll(async () => {
  original = await crearLanding({ brief: briefCorrector, tecnicas: ["semilla", "humana"], prompt, doc: structuredClone(landingEjemplo), proveedor: "gemini" });
  const r = await guardarEnBanco(original.id);
  if (!r.ok) throw new Error(`el ejemplo debe poder entrar al banco: ${JSON.stringify(r.motivos)}`);
  await guardarVersion(original.id, "Antes del cambio");
});

const html = async (id: string) => renderToStaticMarkup(await DetalleBanco({ params: Promise.resolve({ id }) }));

describe("/banco/[id]", () => {
  it("muestra la landing en un iframe a /l/<slug> y el prompt con sus 4 bloques", async () => {
    const pagina = await html(original.id);
    expect(pagina).toContain(`<iframe src="/l/${original.slug}"`);
    expect(pagina).toContain("El prompt que la creó");
    for (const b of ["rol", "tarea", "contexto", "formato"]) expect(pagina).toContain(`data-bloque="${b}"`);
    // el texto del prompt es el guardado, no un resumen
    expect(pagina).toContain("Eres director de arte");
    expect(pagina).toContain("data-aportes");
  });

  it("en móvil ofrece las pestañas «Landing» y «Prompt» y desde 1024 px se ven juntas", async () => {
    const pagina = await html(original.id);
    expect(pagina).toContain('role="tablist"');
    expect(pagina).toMatch(/role="tab"[^>]*>Landing</);
    expect(pagina).toMatch(/role="tab"[^>]*>Prompt</);
    expect(pagina).toContain('data-panel="landing"');
    expect(pagina).toContain('data-panel="prompt"');
    expect(pagina).toContain("lg:grid-cols-2");
    expect(pagina).toContain("lg:hidden"); // la barra de pestañas solo existe bajo 1024 px
  });

  it("lista las versiones con «Restaurar» y ofrece abrir en el editor y duplicar", async () => {
    const pagina = await html(original.id);
    expect(pagina).toContain("Versiones");
    expect(pagina).toContain("Antes del cambio");
    expect(pagina).toContain("Generada por IA");
    expect((pagina.match(/data-version="true"/g) ?? []).length).toBe((await listarVersiones(original.id)).length);
    expect(pagina).toContain(">Restaurar<");
    expect(pagina).toContain(`href="/editor/${original.id}"`);
    expect(pagina).toContain("Abrir en el editor");
    expect(pagina).toContain("Duplicar como nueva");
  });

  it("muestra proveedor, fecha y puntaje del crítico", async () => {
    const pagina = await html(original.id);
    expect(pagina).toContain("gemini");
    expect(pagina).toMatch(/Crítico \d+,\d\/10|Sin crítico/);
  });

  it("un id que no existe responde 404", async () => {
    await expect(html("no-existe")).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/);
  });
});

describe("/banco", () => {
  it("lista solo las landings en el banco, con miniatura, nombre y prompt en el reverso", async () => {
    const borrador = await crearLanding({ brief: briefCorrector, tecnicas: [], prompt, doc: { ...structuredClone(landingEjemplo), meta: { ...landingEjemplo.meta, slug: "borrador-x" } }, proveedor: "manual" });
    const pagina = renderToStaticMarkup(await PaginaBanco());
    expect(pagina).toContain(`data-id="${original.id}"`);
    expect(pagina).not.toContain(`data-id="${borrador.id}"`);
    expect(pagina).toContain("Mostrando 1 de 1 landing");
    expect(pagina).toContain(`href="/banco/${original.id}"`);
  });
});

describe("duplicar como nueva", () => {
  it("crea un borrador con el mismo brief, prompt y documento, otro slug y su versión inicial", async () => {
    const copia = await duplicarLanding(original.id);
    const fuente = await obtenerLanding(original.id);
    expect(copia.id).not.toBe(original.id);
    expect(copia.slug).not.toBe(original.slug);
    expect(copia.estado).toBe("borrador");
    expect(copia.nombre).toBe(`${fuente.nombre} (copia)`);
    expect(copia.brief).toEqual(fuente.brief);
    expect(copia.promptBloques).toEqual(fuente.promptBloques);
    expect(copia.tecnicas).toEqual(fuente.tecnicas);
    expect(copia.doc.secciones).toEqual(fuente.doc.secciones);
    const versiones = await listarVersiones(copia.id);
    expect(versiones).toHaveLength(1);
    expect(versiones[0].nota).toContain("Copia de");
    // el original no cambia
    expect((await obtenerLanding(original.id)).nombre).toBe(fuente.nombre);
  });

  it("la API responde 201 con la copia y 404 si el id no existe", async () => {
    const ok = await DUPLICAR(new Request("http://localhost/x", { method: "POST" }), { params: Promise.resolve({ id: original.id }) });
    expect(ok.status).toBe(201);
    expect(((await ok.json()) as { estado: string }).estado).toBe("borrador");
    const mal = await DUPLICAR(new Request("http://localhost/x", { method: "POST" }), { params: Promise.resolve({ id: "no-existe" }) });
    expect(mal.status).toBe(404);
  });

  it("listarLandingsCompletas filtra por estado y trae brief, prompt y documento", async () => {
    const enBanco = await listarLandingsCompletas({ estado: "en-banco" });
    expect(enBanco.map((l) => l.id)).toEqual([original.id]);
    expect(enBanco[0].promptBloques.rol.length).toBeGreaterThan(0);
    expect((await listarLandingsCompletas()).length).toBeGreaterThan(enBanco.length);
  });
});

describe("texto propio de /banco", () => {
  const texto = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/g, " ").replace(/\s+/g, " ");

  it("pasa el linter de la lista negra con cero infracciones (fuera del prompt citado)", async () => {
    const detalle = texto((await html(original.id)).split("data-prompt")[0]).replaceAll(original.nombre, "Nombre"); // el nombre es un dato de la landing
    const listado = texto(renderToStaticMarkup(await PaginaBanco())).split("Mostrando")[0];
    for (const t of [detalle, listado, texto(renderToStaticMarkup(<EstadoVacio />))]) expect(lintearTexto(t)).toEqual([]);
  });
});
