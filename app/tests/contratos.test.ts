import { describe, expect, it } from "vitest";
import { z } from "zod";
import { CATALOGO_EFECTOS, EFECTOS_ID, LandingDoc } from "@/lib/contratos";
import { landingEjemplo } from "./fixtures/landing-ejemplo";

const clonar = () => structuredClone(landingEjemplo);

describe("contratos LandingDoc", () => {
  it("el fixture pasa LandingDoc.parse", () => {
    expect(() => LandingDoc.parse(landingEjemplo)).not.toThrow();
  });

  it("un héroe sin variante falla", () => {
    const doc = clonar();
    delete doc.secciones[0].variante;
    expect(LandingDoc.safeParse(doc).success).toBe(false);
  });

  it("un héroe con variante 'split' falla", () => {
    const doc = clonar();
    doc.secciones[0].variante = "split";
    expect(LandingDoc.safeParse(doc).success).toBe(false);
  });

  it("5 secciones pasan", () => {
    const doc = clonar();
    doc.secciones = doc.secciones.slice(0, 5);
    expect(LandingDoc.safeParse(doc).success).toBe(true);
  });

  it("10 secciones pasan", () => {
    const doc = clonar();
    const extra = Array.from({ length: 4 }, (_, i) => ({ ...doc.secciones[1], id: `extra-${i}` }));
    doc.secciones = [...doc.secciones, ...extra];
    expect(doc.secciones).toHaveLength(10);
    expect(LandingDoc.safeParse(doc).success).toBe(true);
  });

  it("4 secciones fallan", () => {
    const doc = clonar();
    doc.secciones = doc.secciones.slice(0, 4);
    expect(LandingDoc.safeParse(doc).success).toBe(false);
  });

  it("17 secciones fallan", () => {
    const doc = clonar();
    const extra = Array.from({ length: 11 }, (_, i) => ({ ...doc.secciones[1], id: `extra-${i}` }));
    doc.secciones = [...doc.secciones, ...extra];
    expect(doc.secciones).toHaveLength(17);
    expect(LandingDoc.safeParse(doc).success).toBe(false);
  });

  it("un color que no es hex falla", () => {
    const doc = clonar();
    doc.tokens.colores.acento = "rojo";
    expect(LandingDoc.safeParse(doc).success).toBe(false);
  });

  it("z.toJSONSchema(LandingDoc) se genera sin lanzar error", () => {
    expect(() => z.toJSONSchema(LandingDoc)).not.toThrow();
  });

  it("todo EfectoId tiene entrada en CATALOGO_EFECTOS", () => {
    for (const id of EFECTOS_ID) expect(CATALOGO_EFECTOS[id]).toBeDefined();
  });
});
