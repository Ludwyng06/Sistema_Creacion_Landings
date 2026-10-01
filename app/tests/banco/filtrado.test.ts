import { describe, expect, it } from "vitest";
import {
  FILTROS_VACIOS,
  aTarjeta,
  filtrarTarjetas,
  formatearFecha,
  formatearFechaHora,
  fuentesDe,
  imagenHeroeDe,
  normalizar,
  opcionesFiltro,
  resumirTexto,
  tematicaDe,
  type TarjetaBanco,
} from "@/lib/banco";
import type { LandingDoc } from "@/lib/contratos";
import type { LandingCompleta } from "@/lib/landings";
import { combinar } from "@/lib/tecnicas/combinador";
import { landingEjemplo } from "../fixtures/landing-ejemplo";
import { briefCorrector } from "../tecnicas/briefs";

function tarjeta(extra: Partial<TarjetaBanco> = {}): TarjetaBanco {
  return {
    id: "a",
    slug: "a",
    nombre: "Corrector de postura",
    producto: "Corrector de postura inteligente",
    proveedor: "gemini",
    creadoEn: "2026-09-29T12:00:00.000Z",
    tecnicas: ["semilla", "humana"],
    puntaje: 8,
    intensidad: 3,
    miniatura: null,
    imagenHeroe: null,
    tematica: "producto",
    secciones: 12,
    fuentes: [],
    favorita: false,
    resumen: { rol: "r", tarea: "t", contexto: "c", formato: "f" },
    ...extra,
  };
}

const BANCO: TarjetaBanco[] = [
  tarjeta({ id: "1", nombre: "Colágeno hidrolizado", producto: "Colágeno", proveedor: "gemini", tecnicas: ["semilla", "ambicioso"], puntaje: 8.1, intensidad: 2, creadoEn: "2026-09-29T10:00:00.000Z" }),
  tarjeta({ id: "2", nombre: "Timbre con cámara", producto: "Timbre inteligente", proveedor: "openrouter", tecnicas: ["video", "imagenes"], puntaje: 6.5, intensidad: 3, creadoEn: "2026-09-29T11:00:00.000Z" }),
  tarjeta({ id: "3", nombre: "Llavero 3 en 1", producto: "Llavero encendedor", proveedor: "gemini", tecnicas: ["semilla", "critico"], puntaje: null, intensidad: 3, favorita: true, creadoEn: "2026-09-29T12:00:00.000Z" }),
];

const ids = (l: TarjetaBanco[]) => l.map((t) => t.id);

describe("filtrarTarjetas", () => {
  it("sin filtros devuelve todo, de la más reciente a la más antigua", () => {
    expect(ids(filtrarTarjetas(BANCO, FILTROS_VACIOS))).toEqual(["3", "2", "1"]);
  });

  it("filtra por técnica, proveedor e intensidad, y los filtros se combinan", () => {
    expect(ids(filtrarTarjetas(BANCO, { ...FILTROS_VACIOS, tecnica: "semilla" }))).toEqual(["3", "1"]);
    expect(ids(filtrarTarjetas(BANCO, { ...FILTROS_VACIOS, proveedor: "openrouter" }))).toEqual(["2"]);
    expect(ids(filtrarTarjetas(BANCO, { ...FILTROS_VACIOS, intensidad: 3 }))).toEqual(["3", "2"]);
    expect(ids(filtrarTarjetas(BANCO, { ...FILTROS_VACIOS, tecnica: "semilla", intensidad: 3 }))).toEqual(["3"]);
    expect(filtrarTarjetas(BANCO, { ...FILTROS_VACIOS, tecnica: "video", proveedor: "gemini" })).toEqual([]);
  });

  it("filtra por temática y se combina con los demás filtros", () => {
    const mixto = [tarjeta({ id: "e1", tematica: "espacio", creadoEn: "2026-09-29T09:00:00.000Z" }), tarjeta({ id: "p1", tematica: "producto", creadoEn: "2026-09-29T08:00:00.000Z" }), tarjeta({ id: "e2", tematica: "espacio", puntaje: 9, creadoEn: "2026-09-29T07:00:00.000Z" })];
    expect(ids(filtrarTarjetas(mixto, { ...FILTROS_VACIOS, tematica: "espacio" }))).toEqual(["e1", "e2"]);
    expect(ids(filtrarTarjetas(mixto, { ...FILTROS_VACIOS, tematica: "producto" }))).toEqual(["p1"]);
    expect(ids(filtrarTarjetas(mixto, { ...FILTROS_VACIOS, tematica: "espacio", orden: "puntaje" }))).toEqual(["e2", "e1"]);
  });

  it("la búsqueda ignora tildes y mayúsculas y exige todas las palabras", () => {
    expect(ids(filtrarTarjetas(BANCO, { ...FILTROS_VACIOS, busqueda: "COLAGENO" }))).toEqual(["1"]);
    expect(ids(filtrarTarjetas(BANCO, { ...FILTROS_VACIOS, busqueda: "camara timbre" }))).toEqual(["2"]);
    expect(filtrarTarjetas(BANCO, { ...FILTROS_VACIOS, busqueda: "timbre colageno" })).toEqual([]);
    expect(ids(filtrarTarjetas(BANCO, { ...FILTROS_VACIOS, busqueda: "  " }))).toEqual(["3", "2", "1"]);
  });

  it("la búsqueda también mira el proveedor y el nombre de las técnicas", () => {
    expect(ids(filtrarTarjetas(BANCO, { ...FILTROS_VACIOS, busqueda: "openrouter" }))).toEqual(["2"]);
    expect(ids(filtrarTarjetas(BANCO, { ...FILTROS_VACIOS, busqueda: "generacion de video" }))).toEqual(["2"]);
  });

  it("solo favoritas y orden por puntaje (sin crítico al final)", () => {
    expect(ids(filtrarTarjetas(BANCO, { ...FILTROS_VACIOS, soloFavoritas: true }))).toEqual(["3"]);
    expect(ids(filtrarTarjetas(BANCO, { ...FILTROS_VACIOS, orden: "puntaje" }))).toEqual(["1", "2", "3"]);
  });

  it("no modifica la lista original", () => {
    const copia = ids(BANCO);
    filtrarTarjetas(BANCO, { ...FILTROS_VACIOS, orden: "puntaje" });
    expect(ids(BANCO)).toEqual(copia);
  });
});

describe("temática, fuentes e imagen del héroe", () => {
  const conAssets = (assets: unknown[], secciones: unknown[] = [], meta: Record<string, unknown> = {}) =>
    ({ ...landingEjemplo, meta: { ...landingEjemplo.meta, ...meta }, assets, secciones: [...landingEjemplo.secciones, ...secciones] }) as unknown as LandingDoc;
  const imagen = (slot: string, extra: Record<string, unknown> = {}) => ({ slot, tipo: "imagen", relacion: "16:9", promptGrok: "x", alt: "x", ...extra });
  const widget = (variante: string) => ({ id: `w-${variante}`, tipo: "dato-en-vivo", variante, visible: true, intencion: { objetivo: "x" }, ajustes: {}, bloques: [] });

  it("una landing de producto no es espacial", () => {
    expect(tematicaDe(landingEjemplo)).toBe("producto");
    expect(fuentesDe(landingEjemplo)).toEqual([]);
  });

  it("es «espacio» con un widget en vivo o con imágenes de la NASA, y manda meta.tematica si existe", () => {
    expect(tematicaDe(conAssets([], [widget("auroras")]))).toBe("espacio");
    expect(tematicaDe(conAssets([imagen("a", { ruta: "/m/a.webp", fuente: "nasa-images" })]))).toBe("espacio");
    expect(tematicaDe(conAssets([imagen("a", { ruta: "/m/a.webp", fuente: "nasa-images" })], [], { tematica: "producto" }))).toBe("producto");
  });

  it("junta las fuentes de los medios y de los widgets, sin repetir", () => {
    const doc = conAssets(
      [imagen("a", { ruta: "/m/a.webp", fuente: "nasa-images" }), imagen("b", { ruta: "/m/b.webp", fuente: "apod" }), imagen("c", { fuente: "wikimedia" }), imagen("d", { ruta: "/m/d.webp", fuente: "ia-flux" })],
      [widget("auroras"), widget("fase-lunar")],
    );
    // «c» no tiene archivo y «d» es propia (Grok): no cuentan.
    expect(fuentesDe(doc)).toEqual(["NASA", "NOAA", "USNO"]);
    expect(fuentesDe(conAssets([imagen("a", { ruta: "/m/a.webp", fuente: "open-beauty-facts" }), imagen("b", { ruta: "/m/b.webp", fuente: "wikimedia" })])).join(" · ")).toBe("Open Beauty Facts · Wikimedia");
    expect(fuentesDe(conAssets([], [], { fuentes: ["NASA", "SerpAPI", "NASA"] }))).toEqual(["NASA", "SerpAPI"]);
  });

  it("la imagen del héroe es su fondo o su producto, solo si tienen archivo", () => {
    const heroe = (ajustes: Record<string, unknown>) => ({ id: "h", tipo: "heroe", variante: "poster-a-sangre", visible: true, intencion: { objetivo: "x" }, ajustes, bloques: [] });
    const doc = (assets: unknown[], ajustes: Record<string, unknown>) =>
      ({ ...landingEjemplo, assets, secciones: [heroe(ajustes), ...landingEjemplo.secciones.slice(1)] }) as unknown as LandingDoc;
    expect(imagenHeroeDe(doc([imagen("fondo", { ruta: "/m/fondo.webp" }), imagen("prod", { ruta: "/m/prod.webp" })], { slot: "prod", slots: ["fondo"] }))).toBe("/m/fondo.webp");
    expect(imagenHeroeDe(doc([imagen("fondo"), imagen("prod", { ruta: "/m/prod.webp" })], { slot: "prod", slots: ["fondo"] }))).toBe("/m/prod.webp");
    expect(imagenHeroeDe(doc([imagen("prod")], { slot: "prod" }))).toBeNull();
  });
});

describe("opcionesFiltro", () => {
  it("solo ofrece lo que hay en el banco, ordenado y sin repetir", () => {
    expect(opcionesFiltro(BANCO)).toEqual({
      tecnicas: ["ambicioso", "critico", "imagenes", "semilla", "video"],
      proveedores: ["gemini", "openrouter"],
      tematicas: ["producto"],
      intensidades: [2, 3],
    });
    expect(opcionesFiltro([])).toEqual({ tecnicas: [], proveedores: [], tematicas: [], intensidades: [] });
  });
});

describe("resumirTexto y normalizar", () => {
  it("colapsa espacios, quita marcas de Markdown y recorta en una palabra completa", () => {
    expect(resumirTexto("1.  Genera el `LandingDoc`\n\n de una **landing**", 100)).toBe("1. Genera el LandingDoc de una landing");
    const largo = "uno dos tres cuatro cinco seis siete ocho nueve diez";
    const r = resumirTexto(largo, 20);
    expect(r.endsWith("…")).toBe(true);
    expect(r.length).toBeLessThanOrEqual(21);
    expect(largo.startsWith(r.slice(0, -1))).toBe(true);
  });

  it("normaliza tildes y eñes", () => {
    expect(normalizar("Colágeno Ñandú")).toBe("colageno nandu");
  });
});

describe("aTarjeta", () => {
  it("resume los 4 bloques del prompt y toma la intensidad de los tokens", () => {
    const prompt = combinar(briefCorrector, ["semilla"]);
    const landing = {
      id: "x",
      nombre: "Corrector",
      slug: "corrector",
      tecnicas: ["semilla"],
      puntaje: 7.8,
      favorita: false,
      estado: "en-banco",
      proveedor: "gemini",
      miniatura: "/media/x/miniatura.webp",
      creadoEn: "2026-09-29T12:00:00.000Z",
      actualizadoEn: "2026-09-29T12:00:00.000Z",
      brief: briefCorrector,
      prompt: "",
      promptBloques: prompt,
      doc: landingEjemplo,
    } as LandingCompleta;
    const t = aTarjeta(landing);
    expect(t).toMatchObject({ id: "x", producto: landingEjemplo.meta.producto, intensidad: landingEjemplo.tokens.intensidad, puntaje: 7.8, miniatura: "/media/x/miniatura.webp" });
    for (const b of ["rol", "tarea", "contexto", "formato"] as const) {
      expect(t.resumen[b].length).toBeGreaterThan(0);
      expect(t.resumen[b].length).toBeLessThanOrEqual(171);
    }
  });
});

describe("fechas", () => {
  it("dan el mismo texto siempre (hora de Colombia, 24 horas, sin espacios especiales)", () => {
    expect(formatearFecha("2026-09-29T23:40:43.169Z")).toBe("29 de sept de 2026");
    expect(formatearFechaHora("2026-09-29T23:40:43.169Z")).toBe("29 de sept, 18:40");
    expect(formatearFechaHora("2026-09-29T23:40:43.169Z")).not.toMatch(/[  ]/);
  });
});
