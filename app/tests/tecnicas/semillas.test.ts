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
