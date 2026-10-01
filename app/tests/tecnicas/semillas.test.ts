import { describe, expect, it } from "vitest";
import { Tokens } from "@/lib/contratos";
import {
  CONTRASTE_SUAVE,
  CONTRASTE_TEXTO,
  ESTILOS,
  INDUSTRIAS,
  PALETAS,
  TIPOGRAFIAS,
  aplicarColoresMarca,
  cambiosDeEstilo,
  deltaE,
  otraSemillaDistinta,
  contraste,
  semillaManual,
  tirarSemilla,
  tokensParaBrief,
} from "@/lib/tecnicas/semillas";
import { briefCorrector } from "./briefs";

describe("biblioteca de semillas", () => {
  it("tiene las cantidades de docs/04 §1", () => {
    expect(ESTILOS).toHaveLength(12);
    expect(INDUSTRIAS).toHaveLength(10);
    expect(PALETAS.length).toBeGreaterThanOrEqual(8);
    expect(TIPOGRAFIAS.length).toBeGreaterThanOrEqual(5);
    expect(new Set(PALETAS.map((p) => p.id)).size).toBe(PALETAS.length);
  });

  it("contraste() sigue la fórmula WCAG", () => {
    expect(contraste("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contraste("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 5);
    expect(contraste("#777777", "#FFFFFF")).toBeCloseTo(4.48, 1);
    expect(contraste("#fff", "#000")).toBeCloseTo(21, 5);
  });

  it.each(PALETAS.map((p) => [p.id, p] as const))("la paleta %s cumple AA", (_id, p) => {
    const c = p.colores;
    expect(contraste(c.texto, c.fondo)).toBeGreaterThanOrEqual(CONTRASTE_TEXTO);
    expect(contraste(c.acentoTexto, c.acento)).toBeGreaterThanOrEqual(CONTRASTE_TEXTO);
    expect(contraste(c.textoSuave, c.fondo)).toBeGreaterThanOrEqual(CONTRASTE_SUAVE);
  });
});

describe("tirarSemilla", () => {
  it("es reproducible: el mismo número da la misma semilla y los mismos tokens", () => {
    expect(tirarSemilla(42)).toEqual(tirarSemilla(42));
    expect(tirarSemilla(42).semilla.numero).toBe(42);
  });

  it("números distintos dan semillas distintas (al menos varias)", () => {
    const ids = new Set(Array.from({ length: 30 }, (_, i) => JSON.stringify(tirarSemilla(i).semilla)));
    expect(ids.size).toBeGreaterThan(20);
  });

  it("100 números distintos producen tokens que pasan Tokens.parse", () => {
    for (let n = 0; n < 100; n++) {
      const { tokens, semilla } = tirarSemilla(n * 7919);
      expect(() => Tokens.parse(tokens)).not.toThrow();
      expect(ESTILOS).toContain(semilla.estilo);
      expect(INDUSTRIAS).toContain(semilla.industria);
    }
  });

  it("sin número genera uno y queda registrado en la semilla", () => {
    const { semilla, tokens } = tirarSemilla();
    expect(Number.isInteger(semilla.numero)).toBe(true);
    expect(tirarSemilla(semilla.numero).tokens).toEqual(tokens);
  });

  it("la intensidad sale del argumento (por defecto 3)", () => {
    expect(tirarSemilla(1).tokens.intensidad).toBe(3);
    expect(tirarSemilla(1, 1).tokens.intensidad).toBe(1);
  });
});

describe("semillaManual", () => {
  it("usa la elección explícita y es reproducible", () => {
    const o = { estilo: ESTILOS[0], industria: INDUSTRIAS[0], paletaId: "deco-01", tipografiaId: "syne-manrope", numero: 5 };
    const r = semillaManual(o);
    expect(r).toEqual(semillaManual(o));
    expect(r.semilla).toEqual({ ...o });
    expect(r.tokens.colores.fondo).toBe("#0F2A2B");
    expect(r.tokens.tipografia).toMatchObject({ titulos: "Syne", cuerpo: "Manrope" });
    expect(() => Tokens.parse(r.tokens)).not.toThrow();
  });

  it("rechaza ids que no están en la biblioteca", () => {
    const base = { estilo: "x", industria: "y", paletaId: "nada", tipografiaId: "syne-manrope" };
    expect(() => semillaManual(base)).toThrow(/Paleta/);
    expect(() => semillaManual({ ...base, paletaId: "deco-01", tipografiaId: "nada" })).toThrow(/Tipograf/);
  });
});

describe("aplicarColoresMarca", () => {
  const base = tirarSemilla(3).tokens;

  it("sin colores devuelve los mismos valores", () => {
    expect(aplicarColoresMarca(base, [])).toEqual(base);
  });

  it("un color reemplaza el acento y normaliza el hex", () => {
    const t = aplicarColoresMarca(base, ["#f00"]);
    expect(t.colores.acento).toBe("#FF0000");
    expect(t.colores.fondo).toBe(base.colores.fondo);
  });

  it("recalcula acentoTexto cuando el contraste AA se rompe", () => {
    const t = aplicarColoresMarca(
      { ...base, colores: { ...base.colores, acentoTexto: "#FFFFFF" } },
      ["#777777"],
    );
    expect(t.colores.acentoTexto).toBe("#000000");
    expect(contraste(t.colores.acentoTexto, t.colores.acento)).toBeGreaterThanOrEqual(CONTRASTE_TEXTO);
  });

  it("dos o más colores también reemplazan el fondo y mantienen legible el texto", () => {
    for (const fondo of ["#101820", "#FFF5E0", "#3366CC", "#FFFF00"]) {
      const t = aplicarColoresMarca(base, ["#D9381E", fondo]);
      expect(t.colores.fondo).toBe(fondo.toUpperCase());
      expect(contraste(t.colores.texto, t.colores.fondo)).toBeGreaterThanOrEqual(CONTRASTE_TEXTO);
      expect(contraste(t.colores.textoSuave, t.colores.fondo)).toBeGreaterThanOrEqual(CONTRASTE_SUAVE);
      expect(() => Tokens.parse(t)).not.toThrow();
    }
  });

  it("tokensParaBrief aplica intensidad y colores de marca del brief", () => {
    const { semilla } = tirarSemilla(9);
    const t = tokensParaBrief(semilla, { ...briefCorrector, intensidad: 2, coloresMarca: ["#0055AA"] });
    expect(t.intensidad).toBe(2);
    expect(t.colores.acento).toBe("#0055AA");
  });
});

describe("tarea 25 · colores que cambian", () => {
  const marca = { intensidad: 3 as const, coloresMarca: ["#ffb454", "#0b1020"] };
  const semilla = tirarSemilla(1).semilla;

  it("respetarMarca: false ignora los colores de marca; por defecto los respeta", () => {
    const conMarca = tokensParaBrief(semilla, marca);
    const sinMarca = tokensParaBrief(semilla, marca, { respetarMarca: false });
    expect(conMarca.colores.acento).toBe("#FFB454");
    expect(conMarca.colores.fondo).toBe("#0B1020");
    const paletaBase = PALETAS.find((p) => p.id === semilla.paletaId)!;
    expect(sinMarca.colores.fondo).toBe(paletaBase.colores.fondo);
    expect(sinMarca.colores.acento).toBe(paletaBase.colores.acento);
  });

  it("hay al menos 30 paletas, 10 oscuras, todas con AA y tono coherente", () => {
    expect(PALETAS.length).toBeGreaterThanOrEqual(30);
    expect(PALETAS.filter((p) => p.tono === "oscuro").length).toBeGreaterThanOrEqual(10);
    for (const p of PALETAS) {
      expect(contraste(p.colores.texto, p.colores.fondo)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(p.colores.acentoTexto, p.colores.acento)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(p.colores.textoSuave, p.colores.fondo)).toBeGreaterThanOrEqual(CONTRASTE_SUAVE);
    }
  });

  it("la temática espacio prefiere paletas oscuras sin excluir las claras", () => {
    const tonos = Array.from({ length: 600 }, (_, i) => PALETAS.find((p) => p.id === tirarSemilla(i, 3, Math.random, "espacio").semilla.paletaId)!.tono);
    const oscuras = tonos.filter((t) => t === "oscuro").length;
    const base = PALETAS.filter((p) => p.tono === "oscuro").length / PALETAS.length;
    expect(oscuras / 600).toBeGreaterThan(base + 0.1);
    expect(oscuras).toBeLessThan(600);
  });

  it("una temática con etiqueta pondera esas paletas y la firma sin temática no cambia", () => {
    const belleza = Array.from({ length: 600 }, (_, i) => PALETAS.find((p) => p.id === tirarSemilla(i, 3, Math.random, "belleza").semilla.paletaId)!);
    const base = PALETAS.filter((p) => p.etiquetas?.includes("belleza")).length / PALETAS.length;
    expect(belleza.filter((p) => p.etiquetas?.includes("belleza")).length / 600).toBeGreaterThan(base + 0.1);
    expect(tirarSemilla(7)).toEqual(tirarSemilla(7, 3, Math.random, undefined));
  });
});

describe("otraSemillaDistinta", () => {
  it("cada clic cambia paleta (ΔE ≥ 20), tipografía, estilo y ≥ 3 de 5 tokens de estilo", () => {
    for (let arranque = 0; arranque < 8; arranque++) {
      let actual = tirarSemilla(arranque * 977);
      for (let i = 0; i < 5; i++) {
        const nueva = otraSemillaDistinta(actual, { intensidad: 3 });
        expect(nueva.semilla.estilo).not.toBe(actual.semilla.estilo);
        expect(nueva.semilla.tipografiaId).not.toBe(actual.semilla.tipografiaId);
        expect(cambiosDeEstilo(actual.tokens, nueva.tokens)).toBeGreaterThanOrEqual(3);
        for (const k of ["fondo", "superficie", "texto", "textoSuave", "acento", "acentoTexto", "borde"] as const) {
          expect(nueva.tokens.colores[k].toUpperCase()).not.toBe(actual.tokens.colores[k].toUpperCase());
        }
        expect(deltaE(nueva.tokens.colores.fondo, actual.tokens.colores.fondo)).toBeGreaterThanOrEqual(20);
        expect(deltaE(nueva.tokens.colores.acento, actual.tokens.colores.acento)).toBeGreaterThanOrEqual(20);
        actual = nueva;
      }
    }
  });
});
