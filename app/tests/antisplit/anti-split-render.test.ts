// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  ANCHO_MINIMO_ANTI_SPLIT,
  evaluarAntiSplit,
  medirPrimerViewport,
  solapamientoVertical,
  validarAntiSplitRender,
  type Rectangulo,
} from "@/lib/validadores/anti-split-render";

const caja = (left: number, top: number, ancho: number, alto: number): Rectangulo => ({ left, top, right: left + ancho, bottom: top + alto });

const evaluar = (h1: Rectangulo | null, medio: Rectangulo | null, anchoVentana = 1280) => evaluarAntiSplit({ anchoVentana, h1, medio });

describe("anti-split (render) · función pura", () => {
  it("título a la izquierda e imagen a la derecha → falla", () => {
    const r = evaluar(caja(80, 200, 520, 160), caja(680, 100, 520, 500));
    expect(r).toMatchObject({ aplica: true, split: true });
  });

  it("el caso límite: solapamiento vertical apenas sobre el 50 % sigue fallando", () => {
    const h1 = caja(80, 0, 400, 100);
    const medio = caja(700, 48, 400, 300); // 52 px de 100 del título dentro del rango de la imagen
    expect(solapamientoVertical(h1, medio)).toBeCloseTo(0.52, 2);
    expect(evaluar(h1, medio)).toMatchObject({ split: true });
  });

  it("solapamiento vertical de 50 % o menos → pasa", () => {
    expect(evaluar(caja(80, 0, 400, 100), caja(700, 50, 400, 300))).toMatchObject({ aplica: true, split: false });
  });

  it("héroe centrado con la imagen debajo (apilado) → pasa", () => {
    expect(evaluar(caja(240, 120, 800, 140), caja(240, 300, 800, 420))).toMatchObject({ aplica: true, split: false });
  });

  it("título centrado sobre la imagen a sangre (superpuesto) → pasa", () => {
    expect(evaluar(caja(240, 260, 800, 160), caja(0, 0, 1280, 760))).toMatchObject({ aplica: true, split: false });
  });

  it("título superpuesto alineado a la izquierda sobre una imagen ancha → pasa (no está lado a lado)", () => {
    expect(evaluar(caja(60, 300, 500, 140), caja(0, 0, 1280, 760))).toMatchObject({ aplica: true, split: false });
  });

  it("imagen a la izquierda y título a la derecha no es el patrón vetado → pasa", () => {
    expect(evaluar(caja(700, 200, 500, 160), caja(80, 100, 520, 500))).toMatchObject({ aplica: true, split: false });
  });

  it("menos de 1024 px → no aplica, aunque estén lado a lado", () => {
    const r = evaluar(caja(20, 200, 160, 60), caja(200, 100, 160, 300), ANCHO_MINIMO_ANTI_SPLIT - 1);
    expect(r).toEqual({ aplica: false, motivo: "ancho", split: false });
    expect(evaluar(caja(80, 200, 520, 160), caja(680, 100, 520, 500), ANCHO_MINIMO_ANTI_SPLIT)).toMatchObject({ aplica: true, split: true });
  });

  it("sin título o sin imagen en el primer viewport → no aplica", () => {
    expect(evaluar(null, caja(0, 0, 500, 500))).toMatchObject({ aplica: false, motivo: "sin-h1" });
    expect(evaluar(caja(0, 0, 500, 100), null)).toMatchObject({ aplica: false, motivo: "sin-medio" });
  });
});

// ── Medidor de DOM (con rectángulos simulados: jsdom no tiene diseño) ──────

function montar(html: string, ancho: number, rects: Record<string, Rectangulo>) {
  document.body.innerHTML = html;
  Object.defineProperty(window, "innerWidth", { configurable: true, value: ancho });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 760 });
  for (const [selector, r] of Object.entries(rects)) {
    const el = document.querySelector(selector)!;
    el.getBoundingClientRect = () => ({ ...r, width: r.right - r.left, height: r.bottom - r.top, x: r.left, y: r.top, toJSON: () => r }) as DOMRect;
  }
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("anti-split (render) · medidor de DOM", () => {
  it("html-libre en dos columnas: h1 a la izquierda e img a la derecha → falla", () => {
    montar(
      '<div data-html-libre><h1>Un título</h1><img alt="" src="x.png"></div>',
      1280,
      { h1: caja(80, 200, 520, 120), img: caja(680, 80, 520, 520) },
    );
    expect(validarAntiSplitRender(document)).toMatchObject({ aplica: true, split: true });
  });

  it("elige la imagen más grande del primer viewport e ignora las diminutas y las de fuera", () => {
    montar(
      '<h1>Título</h1><img id="chica" alt="" src="a.png"><img id="grande" alt="" src="b.png"><img id="lejos" alt="" src="c.png">',
      1280,
      { h1: caja(240, 300, 800, 120), "#chica": caja(0, 0, 40, 40), "#grande": caja(240, 440, 800, 300), "#lejos": caja(0, 2000, 1000, 1000) },
    );
    const { h1, medio } = medirPrimerViewport(document);
    expect(h1).toMatchObject({ top: 300 });
    expect(medio).toMatchObject({ top: 440, right: 1040 });
    expect(validarAntiSplitRender(document)).toMatchObject({ aplica: true, split: false });
  });

  it("a 390 px el medidor no aplica", () => {
    montar("<h1>Título</h1><img alt='' src='x.png'>", 390, { h1: caja(20, 100, 300, 80), img: caja(20, 200, 300, 300) });
    expect(validarAntiSplitRender(document)).toEqual({ aplica: false, motivo: "ancho", split: false });
  });

  it("un marcador de asset cuenta como imagen principal", () => {
    montar('<h1>Título</h1><div data-marcador-slot="hero"></div>', 1280, { h1: caja(80, 200, 520, 120), "[data-marcador-slot]": caja(680, 100, 520, 520) });
    expect(validarAntiSplitRender(document)).toMatchObject({ aplica: true, split: true });
  });
});
