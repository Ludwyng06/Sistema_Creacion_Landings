// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { ejemplos as heroes } from "@/secciones/heroe/ejemplo";
import { ejemplo as faq } from "@/secciones/faq/ejemplo";
import { ejemplo as oferta } from "@/secciones/oferta/ejemplo";
import { ejemplo as garantia } from "@/secciones/garantia/ejemplo";
import { ejemplo as beneficios } from "@/secciones/beneficios/ejemplo";
import {
  MULT_TEXTO,
  MULT_TITULOS,
  conPresentacion,
  fontSizeDeBloque,
  leerPresentacion,
  variablesDeTamano,
  variablesGlobales,
} from "@/secciones/presentacion";
import { renderizar } from "./ayudas";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const heroe = heroes["producto-monumental"];

describe("tamaños de letra · datos", () => {
  it("descarta valores inválidos y no guarda lo que es igual al valor por defecto", () => {
    const p = leerPresentacion({ presentacion: { tamTitular: "XXL", tamTexto: "L", pesoTitular: "gordo", tamanos: { "ajustes.titular": 2, "ajustes.x": 9, "bloques.a.texto": 1.5, "ruta mala!": 1 }, global: { titulos: "L", texto: "zzz" } } });
    expect(p.tamTitular).toBe("heredado");
    expect(p.tamTexto).toBe("L");
    expect(p.pesoTitular).toBe("heredado");
    expect(p.tamanos).toEqual({ "ajustes.titular": 2 });
    expect(p.global).toBeUndefined();
    const s = conPresentacion(faq, { tamTitular: "XL" });
    expect(conPresentacion(s, { tamTitular: "heredado" }).ajustes.presentacion).toBeUndefined();
  });

  it("los pasos crecen de XS a XL y el cuerpo nunca baja de 16 px", () => {
    const texto = [MULT_TEXTO.XS, MULT_TEXTO.S, MULT_TEXTO.M, MULT_TEXTO.L, MULT_TEXTO.XL];
    expect([...texto].sort((a, b) => a - b)).toEqual(texto);
    const titulos = [MULT_TITULOS.XS, MULT_TITULOS.S, MULT_TITULOS.M, MULT_TITULOS.L, MULT_TITULOS.XL];
    expect([...titulos].sort((a, b) => a - b)).toEqual(titulos);
    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).toMatch(/--text-cuerpo:\s*max\(1rem,/);
    // Incluso con el paso más pequeño (0,9) el cuerpo queda en 16 px.
    expect(Math.max(16, 16 * MULT_TEXTO.XS)).toBe(16);
  });

  it("un bloque de texto usa clamp() y el cuerpo no baja de 16 px", () => {
    expect(fontSizeDeBloque(16, -3)).toMatch(/^clamp\(16\.0px, /);
    expect(fontSizeDeBloque(40, 2)).toMatch(/^clamp\(/);
    expect(fontSizeDeBloque(14, -3)).toMatch(/^clamp\(/);
    const y = 16 * 1.12 ** 3;
    expect(fontSizeDeBloque(16, 3)).toBe(`clamp(${Math.max(16, y * 0.85).toFixed(1)}px, ${y.toFixed(1)}px, ${(y * 1.15).toFixed(1)}px)`);
  });

  it("variables de la sección y de toda la landing", () => {
    const sec = conPresentacion(faq, { tamTitular: "L", tamTexto: "S", pesoTitular: "semi" });
    expect(variablesDeTamano(leerPresentacion(sec.ajustes))).toEqual({ "--escala-t": String(MULT_TITULOS.L), "--escala": String(MULT_TEXTO.S), "--escala-s": String(MULT_TEXTO.S), "--peso-titulo": "600" });
    const conSub = conPresentacion(faq, { tamSubtitulo: "XL" });
    expect(variablesDeTamano(leerPresentacion(conSub.ajustes))).toEqual({ "--escala-s": String(MULT_TEXTO.XL) });
    const h = conPresentacion(heroe, { global: { titulos: "XL", texto: "L" } });
    expect(variablesGlobales([h, faq])).toEqual({ "--escala": String(MULT_TEXTO.L), "--escala-t": String(MULT_TITULOS.XL), "--escala-s": String(MULT_TEXTO.L) });
    expect(variablesGlobales([heroe, faq])).toEqual({});
  });
});

describe("tamaños de letra · render", () => {
  it("el tamaño global llega al contenedor de la landing", () => {
    const h = conPresentacion(heroe, { global: { titulos: "XL", texto: "S" } });
    const { container } = renderizar([h, faq]);
    const raiz = container.querySelector(".landing") as HTMLElement;
    expect(raiz.style.getPropertyValue("--escala-t")).toBe(String(MULT_TITULOS.XL));
    expect(raiz.style.getPropertyValue("--escala")).toBe(String(MULT_TEXTO.S));
  });

  it("cada sección puede cambiar el suyo sin tocar a las demás", () => {
    const a = conPresentacion(faq, { tamTitular: "XL", pesoTitular: "negrita" });
    const { container } = renderizar([heroe, a, oferta]);
    const de = (tipo: string) => container.querySelector(`[data-tipo='${tipo}']`) as HTMLElement;
    expect(de("faq").style.getPropertyValue("--escala-t")).toBe(String(MULT_TITULOS.XL));
    expect(de("faq").style.getPropertyValue("--peso-titulo")).toBe("700");
    expect(de("faq").hasAttribute("data-peso-titulo")).toBe(true);
    expect(de("oferta").style.getPropertyValue("--escala-t")).toBe("");
    expect(de("oferta").hasAttribute("data-peso-titulo")).toBe(false);
  });

  it("un bloque de texto recibe su font-size con clamp() y al quitarlo vuelve al de la sección", () => {
    vi.spyOn(window, "getComputedStyle").mockReturnValue({ fontSize: "30px" } as CSSStyleDeclaration);
    const conBloque = conPresentacion(garantia, { tamanos: { "ajustes.titulo": 2 } });
    const { container, rerender, unmount } = renderizar([heroe, conBloque]);
    void rerender;
    const titulo = container.querySelector("[data-tipo='garantia'] h2") as HTMLElement;
    expect(titulo.getAttribute("data-tam-bloque")).toBe("2");
    // jsdom reescribe clamp() como calc(); en el navegador queda clamp() (lo prueba el e2e).
    expect(titulo.style.fontSize).toMatch(/^(clamp|calc)\(/);
    unmount();
    const sin = renderizar([heroe, garantia]);
    expect((sin.container.querySelector("[data-tipo='garantia'] h2") as HTMLElement).style.fontSize).toBe("");
  });

  it("las secciones de beneficios con tamaño global XL siguen sin desbordar su contenedor (clases de ruptura)", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).toMatch(/\.landing :is\(h1, h2, h3\)\s*\{\s*overflow-wrap:\s*anywhere/);
    const h = conPresentacion(heroe, { global: { titulos: "XL", texto: "XL" } });
    const { container } = renderizar([h, beneficios]);
    expect(container.querySelectorAll("h1, h2, h3").length).toBeGreaterThan(0);
  });
});
