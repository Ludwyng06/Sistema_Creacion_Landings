import { describe, expect, it } from "vitest";
import type { LandingDoc, Tokens } from "@/lib/contratos";
import { CATALOGO_FUENTES, buscarFuente, esFamiliaConocida, estaEnBiblioteca, estaEnCatalogo } from "@/lib/fuentes/catalogo";
import {
  CATEGORIAS,
  CUPO_POR_CATEGORIA,
  TOTAL_CATALOGO,
  esOtroAlfabeto,
  pesosDe,
  seleccionarFuentes,
  usoSugeridoDe,
  type FamiliaApi,
} from "@/lib/fuentes/seleccionar";
import { PESOS_USADOS, ORIGENES_FUENTES, pesosParaFamilia, urlFuentes } from "@/lib/fuentes/url";
import { validarEsquema } from "@/lib/validadores/esquema";
import { landingEjemplo } from "../fixtures/landing-ejemplo";
import api from "./fixtures/webfonts-api.json";

const items = (api as { items: FamiliaApi[] }).items;
const porNombre = new Map(items.map((f) => [f.family, f]));
const r = seleccionarFuentes(items);

const fam = (over: Partial<FamiliaApi> & { family: string }): FamiliaApi => ({
  variants: ["regular", "italic", "500", "700"],
  subsets: ["latin", "latin-ext"],
  category: "sans-serif",
  ...over,
});

describe("filtro de las 200 (fixture grabado de la API de Google Fonts)", () => {
  it("el fixture es la respuesta completa de la API (1.959 familias)", () => {
    expect(items.length).toBeGreaterThan(1900);
  });

  it("devuelve exactamente 200, sin repetir", () => {
    expect(r.fuentes).toHaveLength(TOTAL_CATALOGO);
    expect(new Set(r.fuentes.map((f) => f.familia)).size).toBe(TOTAL_CATALOGO);
  });

  it("reparte por categoría según el cupo, y completa lo que falte con sans y serif", () => {
    const n = (c: string) => r.fuentes.filter((f) => f.categoria === c).length;
    for (const c of CATEGORIAS) expect(n(c)).toBeLessThanOrEqual(CUPO_POR_CATEGORIA[c] + (c === "sans-serif" || c === "serif" ? 20 : 0));
    expect(n("sans-serif")).toBeGreaterThanOrEqual(80);
    expect(n("serif")).toBeGreaterThanOrEqual(55);
    expect(n("display")).toBe(35);
    expect(n("monospace")).toBe(15);
    expect(n("handwriting")).toBeGreaterThan(0);
  });

  it("cada una tiene subset latin y al menos 3 pesos o el eje wght", () => {
    for (const f of r.fuentes) {
      const original = porNombre.get(f.familia)!;
      expect(original.subsets, f.familia).toContain("latin");
      expect(f.variable || f.pesos.length >= 3, f.familia).toBe(true);
      expect(f.latinExt).toBe(original.subsets.includes("latin-ext"));
    }
  });

  it("no trae alfabetos ajenos, íconos ni variantes que dupliquen familia", () => {
    const nombres = r.fuentes.map((f) => f.familia);
    for (const n of nombres) {
      expect(n, n).not.toMatch(/^Noto (Sans|Serif) (JP|KR|SC|TC|HK|Arabic|Hebrew|Thai|Devanagari|Bengali|Tamil)/);
      expect(n, n).not.toMatch(/icons|symbols|emoji|awesome|barcode/i);
      const sub = porNombre.get(n)!.subsets;
      for (const duro of ["japanese", "korean", "chinese-simplified", "chinese-traditional", "chinese-hongkong", "thai", "arabic"]) {
        if (!["Rubik", "Noto Sans", "Noto Serif"].includes(n)) expect(sub, `${n} trae ${duro}`).not.toContain(duro);
      }
    }
    for (const bloqueado of ["Noto Sans JP", "Noto Sans KR", "Noto Sans Arabic", "Noto Color Emoji", "Kanit", "Cairo"]) expect(nombres).not.toContain(bloqueado);
    expect(nombres).not.toContain("Roboto Condensed");
    expect(nombres.filter((n) => n.startsWith("Playwrite ")).length).toBeLessThanOrEqual(1);
    for (const esperada of ["Roboto", "Inter", "Poppins", "Fraunces", "Playfair Display", "JetBrains Mono", "Dancing Script"]) expect(nombres).toContain(esperada);
  });

  it("dentro de cada categoría van por popularidad", () => {
    for (const c of CATEGORIAS) {
      const p = r.fuentes.filter((f) => f.categoria === c).map((f) => f.popularidad);
      expect(p).toEqual([...p].sort((a, b) => a - b));
    }
    expect(r.fuentes[0]).toMatchObject({ familia: "Roboto", popularidad: 1 });
  });

  it("usoSugerido: display y handwriting solo para títulos; sans y serif con 400 sirven para ambos", () => {
    for (const f of r.fuentes) {
      if (f.categoria === "display" || f.categoria === "handwriting") expect(f.usoSugerido).toBe("titulos");
      if ((f.categoria === "sans-serif" || f.categoria === "serif") && f.pesos.includes(400)) expect(f.usoSugerido).toBe("ambos");
    }
    expect(buscarFuente("Inter")).toMatchObject({ usoSugerido: "ambos", variable: true, cursiva: true });
  });
});

describe("piezas del filtro", () => {
  it("pesosDe lee variantes y ejes", () => {
    expect(pesosDe(fam({ family: "A", variants: ["regular", "italic", "700", "700italic"] }))).toEqual([400, 700]);
    expect(pesosDe(fam({ family: "B", variants: ["regular"], axes: [{ tag: "wght", start: 300, end: 700 }] }))).toEqual([300, 400, 500, 600, 700]);
  });
  it("otro alfabeto: por subset duro o por nombre; Open Sans (hebreo) y Poppins (devanagari) se quedan", () => {
    expect(esOtroAlfabeto(fam({ family: "Zen Kaku Gothic New", subsets: ["latin", "japanese"] }))).toBe(true);
    expect(esOtroAlfabeto(fam({ family: "Noto Sans Devanagari", subsets: ["latin", "devanagari"] }))).toBe(true);
    expect(esOtroAlfabeto(fam({ family: "Noto Sans", subsets: ["latin", "thai"] }))).toBe(false);
    expect(esOtroAlfabeto(fam({ family: "Open Sans", subsets: ["latin", "hebrew"] }))).toBe(false);
    expect(esOtroAlfabeto(fam({ family: "Poppins", subsets: ["latin", "devanagari"] }))).toBe(false);
  });
  it("una familia sin latin, con menos de 3 pesos o de ícono queda fuera", () => {
    const s = seleccionarFuentes([
      fam({ family: "Buena" }),
      fam({ family: "Sin Latin", subsets: ["cyrillic"] }),
      fam({ family: "Pocos", variants: ["regular", "700"] }),
      fam({ family: "Material Symbols Outlined" }),
      fam({ family: "Buena Condensed" }),
    ]);
    expect(s.fuentes.map((f) => f.familia)).toEqual(["Buena"]);
    expect(s.descartadas).toMatchObject({ sinLatin: 1, pocosPesos: 1, iconos: 1, duplicadas: 1 });
  });
  it("usoSugeridoDe pide el peso 400 para el cuerpo", () => {
    expect(usoSugeridoDe("sans-serif", [300, 400, 700])).toBe("ambos");
    expect(usoSugeridoDe("sans-serif", [600, 700, 900])).toBe("titulos");
  });
});

describe("catálogo versionado (src/datos/fuentes.json)", () => {
  it("son 200 entradas con todos sus campos", () => {
    expect(CATALOGO_FUENTES).toHaveLength(TOTAL_CATALOGO);
    for (const f of CATALOGO_FUENTES) {
      expect(f.familia.length).toBeGreaterThan(0);
      expect(CATEGORIAS).toContain(f.categoria);
      expect(f.pesos.length).toBeGreaterThan(0);
      expect(typeof f.variable).toBe("boolean");
      expect(typeof f.cursiva).toBe("boolean");
      expect(f.popularidad).toBeGreaterThan(0);
      expect(["titulos", "cuerpo", "ambos"]).toContain(f.usoSugerido);
    }
  });
  it("reconoce las familias del catálogo y de la biblioteca de semillas, sin distinguir mayúsculas", () => {
    expect(estaEnCatalogo("inter")).toBe(true);
    expect(estaEnBiblioteca("DM Serif Display")).toBe(true);
    expect(esFamiliaConocida("Instrument Serif")).toBe(true);
    expect(esFamiliaConocida("Fuente Inventada Xyz")).toBe(false);
  });
});

const tokens = (titulos: string, cuerpo: string): Pick<Tokens, "tipografia"> => ({ tipografia: { titulos, cuerpo, escala: "normal" } });

describe("urlFuentes", () => {
  it("arma la URL con solo las 2 familias, los pesos usados y display=swap", () => {
    const u = urlFuentes(tokens("Fraunces", "Inter Tight"));
    expect(u.startsWith("https://fonts.googleapis.com/css2?")).toBe(true);
    expect(u).toBe("https://fonts.googleapis.com/css2?family=Fraunces:wght@400;600;700&family=Inter+Tight:wght@400;500;600;700&display=swap");
    expect((u.match(/family=/g) ?? []).length).toBe(2);
    expect(u.endsWith("&display=swap")).toBe(true);
  });
  it("si títulos y cuerpo son la misma familia va una sola, con la unión de pesos", () => {
    const u = urlFuentes(tokens("Inter", "inter"));
    expect((u.match(/family=/g) ?? []).length).toBe(1);
    expect(u).toContain("wght@400;500;600;700");
  });
  it("ajusta al peso más cercano que la familia tiene (Bebas-like con solo 400 y 700)", () => {
    const con = CATALOGO_FUENTES.find((f) => !f.variable && f.pesos.length >= 3 && !f.pesos.includes(600))!;
    const pesos = pesosParaFamilia(con.familia, PESOS_USADOS.titulos);
    for (const p of pesos) expect(con.pesos).toContain(p);
    expect(new Set(pesos).size).toBe(pesos.length);
  });
  it("las de la biblioteca fuera del catálogo piden su único peso; una desconocida se pide sin wght", () => {
    expect(urlFuentes(tokens("DM Serif Display", "DM Sans"))).toContain("family=DM+Serif+Display:wght@400&");
    expect(urlFuentes(tokens("Fuente Rara", "Inter"))).toContain("family=Fuente+Rara&family=Inter:");
  });
  it("codifica nombres con espacios y no deja pasar comillas", () => {
    const u = urlFuentes(tokens('Space "Grotesk"', "IBM Plex Sans"));
    expect(u).toContain("family=Space+Grotesk:");
    expect(u).toContain("family=IBM+Plex+Sans:");
    expect(u).not.toContain('"');
  });
  it("los orígenes para preconnect son los de Google Fonts", () => {
    expect(ORIGENES_FUENTES).toEqual(["https://fonts.googleapis.com", "https://fonts.gstatic.com"]);
  });
});

describe("validador de tipografía (amarillo, no rojo)", () => {
  const conFuente = (titulos: string, cuerpo: string): LandingDoc => {
    const d = structuredClone(landingEjemplo);
    d.tokens.tipografia = { ...d.tokens.tipografia, titulos, cuerpo };
    return d;
  };
  it("una familia del catálogo o de la biblioteca no da aviso de tipografía", () => {
    const { resultado } = validarEsquema(conFuente("Playfair Display", "Instrument Serif"));
    expect(resultado.problemas.filter((p) => p.ruta.startsWith("tokens.tipografia"))).toEqual([]);
  });
  it("una familia desconocida avisa en amarillo con su ruta y no vuelve el esquema rojo", () => {
    const base = validarEsquema(structuredClone(landingEjemplo)).resultado.estado;
    const { resultado } = validarEsquema(conFuente("Fuente Inventada Xyz", "Inter"));
    const p = resultado.problemas.filter((x) => x.ruta.startsWith("tokens.tipografia"));
    expect(p).toHaveLength(1);
    expect(p[0].ruta).toBe("tokens.tipografia.titulos");
    expect(p[0].mensaje).toContain("Fuente Inventada Xyz");
    expect(resultado.estado).not.toBe("rojo");
    if (base === "verde") expect(resultado.estado).toBe("amarillo");
  });
});
