import { describe, expect, it } from "vitest";
import type { LandingDoc } from "@/lib/contratos";
import { datosPorCompletar, enlaceASeccion } from "@/lib/entrega/completar";
import { estimarLighthouse, listaDeRevision } from "@/lib/entrega/revision";
import { landingEjemplo } from "../fixtures/landing-ejemplo";

const copia = (): LandingDoc => structuredClone(landingEjemplo);
const item = (doc: LandingDoc, id: string) => listaDeRevision(doc).items.find((i) => i.id === id)!;

describe("datos por completar", () => {
  it("lista cada [COMPLETAR] con su sección, su campo y un enlace al editor", () => {
    const d = datosPorCompletar(copia());
    const faq = d.filter((x) => x.tipo === "faq");
    expect(faq).toHaveLength(3);
    expect(faq[0]).toMatchObject({ seccionId: "sec-faq", campo: "respuesta", critico: false });
    expect(faq[0].ruta).toBe("bloques.faq-1.respuesta");
    expect(enlaceASeccion("abc", "sec-faq")).toBe("/editor/abc?seccion=sec-faq");
  });

  it("el héroe y el precio son críticos; el resto no", () => {
    const doc = copia();
    doc.secciones[0].ajustes.titular = "[COMPLETAR]";
    const oferta = doc.secciones.find((s) => s.tipo === "oferta")!;
    oferta.ajustes.precio = "[COMPLETAR]";
    oferta.ajustes.precioAnterior = "[COMPLETAR]";
    const d = datosPorCompletar(doc);
    expect(d.find((x) => x.campo === "titular")!.critico).toBe(true);
    expect(d.find((x) => x.campo === "precio")!.critico).toBe(true);
    expect(d.find((x) => x.campo === "precioAnterior")!.critico).toBe(false);
  });

  it("las secciones ocultas no cuentan", () => {
    const doc = copia();
    doc.secciones.find((s) => s.tipo === "faq")!.visible = false;
    expect(datosPorCompletar(doc).filter((x) => x.tipo === "faq")).toHaveLength(0);
  });
});

describe("lista de revisión", () => {
  it("un [COMPLETAR] fuera del héroe y del precio avisa pero no bloquea", () => {
    const r = listaDeRevision(copia());
    expect(item(copia(), "completar").estado).toBe("aviso");
    expect(r.bloquea).toBe(false);
  });

  it("un [COMPLETAR] en el héroe bloquea y lleva a su sección", () => {
    const doc = copia();
    doc.secciones[0].ajustes.titular = "[COMPLETAR]";
    const r = listaDeRevision(doc);
    expect(r.bloquea).toBe(true);
    expect(item(doc, "completar")).toMatchObject({ estado: "bloquea", seccionId: doc.secciones[0].id });
  });

  it("sin precio en la oferta bloquea; sin oferta, no aplica", () => {
    const doc = copia();
    doc.secciones.find((s) => s.tipo === "oferta")!.ajustes.precio = "[COMPLETAR]";
    expect(item(doc, "precio").estado).toBe("bloquea");
    doc.secciones = doc.secciones.filter((s) => s.tipo !== "oferta");
    expect(item(doc, "precio")).toMatchObject({ estado: "ok" });
    expect(item(doc, "precio").detalle).toMatch(/No aplica/);
  });

  it("el contraste por debajo de AA bloquea", () => {
    const doc = copia();
    doc.tokens.colores.texto = "#CCCCCC";
    expect(item(doc, "contraste").estado).toBe("bloquea");
    expect(listaDeRevision(doc).bloquea).toBe(true);
    expect(item(copia(), "contraste").estado).toBe("ok");
  });

  it("formulario sin correo ni teléfono, o ausente, solo avisa", () => {
    const doc = copia();
    expect(item(doc, "formulario").estado).toBe("ok");
    doc.secciones.find((s) => s.tipo === "formulario-lead")!.ajustes.campos = ["nombre"];
    expect(item(doc, "formulario").estado).toBe("aviso");
    doc.secciones = doc.secciones.filter((s) => s.tipo !== "formulario-lead");
    expect(item(doc, "formulario").estado).toBe("aviso");
  });

  it("una imagen con archivo y sin texto alternativo avisa", () => {
    const doc = copia();
    doc.assets = [{ slot: "x", tipo: "imagen", relacion: "4:5", promptGrok: "", alt: " ", ruta: "/media/x.webp" }];
    expect(item(doc, "alt").estado).toBe("aviso");
    doc.assets[0].alt = "Un corrector de postura";
    expect(item(doc, "alt").estado).toBe("ok");
  });

  it("Lighthouse estimado baja con el peso de la página y nunca bloquea", () => {
    const doc = copia();
    const base = estimarLighthouse(doc).puntaje;
    doc.assets = Array.from({ length: 20 }, (_, i) => ({ slot: `i${i}`, tipo: "imagen" as const, relacion: "4:5" as const, promptGrok: "", alt: "a", ruta: `/media/${i}.webp` }));
    const pesado = estimarLighthouse(doc).puntaje;
    expect(pesado).toBeLessThan(base);
    expect(item(doc, "lighthouse").estado).toBe(pesado >= 90 ? "ok" : "aviso");
    expect(listaDeRevision(doc).items.find((i) => i.id === "lighthouse")!.estado).not.toBe("bloquea");
  });
});

describe("correcciones del revisor legibles", () => {
  const doc = structuredClone(landingEjemplo);
  it("cambia la ruta técnica por el nombre de la sección", async () => {
    const { humanizarCorreccion } = await import("@/lib/visor");
    expect(humanizarCorreccion("secciones[0].ajustes.titular: Más corto", doc)).toBe("Héroe · titular: Más corto");
    expect(humanizarCorreccion("secciones[2].bloques: Reemplazar imágenes", doc)).toMatch(/^Beneficios · bloques: Reemplazar imágenes$/);
    expect(humanizarCorreccion("secciones[1].ajustes.valor: 6-12", doc)).toMatch(/· valor: 6-12$/);
  });
  it("deja igual lo que ya es una frase", async () => {
    const { humanizarCorreccion } = await import("@/lib/visor");
    expect(humanizarCorreccion("Se acortó el pie de página", doc)).toBe("Se acortó el pie de página");
    expect(humanizarCorreccion("secciones[99].ajustes.x: algo", doc)).toBe("Sección 100 · x: algo");
  });
});
