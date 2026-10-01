import "../ayudas-db";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import type { MedioBanco } from "@/lib/contratos";
import { resolverConCompetencia, type DepsCompetencia, type SlotImagen } from "@/lib/generar/imagenes-competencia";
import { ajustarAlt, altDeFuente, contarPalabras, esSlotDeIcono } from "@/lib/generar/slots";
import { promptsDeterministas } from "@/lib/vitrina/imagenes-sin-ia";
import { promptElegirImagen } from "@/lib/ia/prompts/elegir-imagen";

// 24-A entrega 2: slots de icono sin fotos, escenas distintas por slot, alt de 8 a 16 palabras, penalización de repetidas, banco gana en espacio.

const slot = (n: string, rol: SlotImagen["rol"] = "galeria"): SlotImagen => ({ slot: n, rol, origen: "banco", relacion: "1:1", seccion: rol, esProducto: false, que: n, esperado: n });
const nasa = (id: string, titulo: string): MedioBanco => ({ id, bancoId: "web", tipo: "imagen", fuente: "nasa-images", idFuente: id, ruta: `/media/bancos/web/${id}.webp`, ancho: 1600, alto: 900, orientacion: "horizontal", coloresDominantes: [], titulo, descripcion: "", etiquetas: [], credito: "NASA", licencia: "dominio-publico-nasa", usoComercial: true });
const base = (extra: Partial<DepsCompetencia>): DepsCompetencia => ({
  dirMedia: tmpdir(),
  candidatos: [],
  entrada: { claves: ["aurora"], bancos: [], tematica: "espacio" } as unknown as DepsCompetencia["entrada"],
  espacial: true,
  contexto: { nombre: "Tours de auroras", tipo: "servicio", tematica: "espacio" },
  briefTxt: "b",
  fichaTxt: "f",
  acento: "#00ff88",
  miniatura: async () => "QUJD",
  generarOpenAI: async () => ({ ruta: "/media/bancos/generadas/x.webp", modelo: "gpt-image-2" }),
  ...extra,
});

describe("24-A e2 · slots", () => {
  it("detecta slots de icono o svg", () => {
    for (const s of ["garantia.svg", "icono-envio", "sello-garantia", "garantia-icono"]) expect(esSlotDeIcono(s)).toBe(true);
    for (const s of ["heroe-imagen", "galeria-1", "escena-2"]) expect(esSlotDeIcono(s)).toBe(false);
  });
  it("no busca ni genera fotos para un slot de icono", async () => {
    let n = 0;
    const r = await resolverConCompetencia([slot("garantia.svg"), slot("galeria-1")], base({ generarOpenAI: async () => (n++, { ruta: `/media/bancos/generadas/${n}.webp`, modelo: "m" }), espacial: false }));
    expect(r.assets.map((a) => a.slot)).toEqual(["galeria-1"]);
  });
  it("alt de 8 a 16 palabras", () => {
    expect(contarPalabras(ajustarAlt("Aurora verde sobre un lago helado con montañas nevadas al fondo y un cielo despejado de estrellas brillantes esta noche")!)).toBeLessThanOrEqual(16);
    expect(ajustarAlt("Aurora verde")).toBeNull();
    const a = altDeFuente("Aurora", "Una aurora boreal vista desde la Estación Espacial Internacional sobre el océano");
    expect(contarPalabras(a)).toBeGreaterThanOrEqual(8);
    expect(contarPalabras(a)).toBeLessThanOrEqual(16);
  });
});

describe("24-A e2 · escenas", () => {
  it("un servicio de tours pide escenas distintas en cada slot", () => {
    const slots = [slot("heroe-imagen", "heroe"), slot("galeria-1"), slot("galeria-2"), slot("galeria-3"), slot("galeria-4"), slot("escena-1", "otro")];
    const p = promptsDeterministas(slots as never, { nombre: "Tours de auroras", tipo: "servicio", tematica: "espacio" });
    expect(new Set(p.slots.map((s) => s.prompt)).size).toBe(slots.length);
    expect(new Set(p.slots.map((s) => s.alt)).size).toBe(slots.length);
    for (const s of p.slots) expect(contarPalabras(s.alt)).toBeGreaterThanOrEqual(8);
    expect(p.slots.some((s) => /tripod|cabin|guide/.test(s.prompt))).toBe(true);
  });
  it("el crítico recibe las ya elegidas", () => {
    const p = promptElegirImagen({ slot: "galeria-2", seccion: "galería", que: "x", contextoBrief: "b", fichaVisual: "f", candidatas: [{ indice: 0, origen: "nasa", titulo: "t" }], yaElegidas: [{ slot: "heroe-imagen", escena: "aurora sobre un lago" }] });
    expect(p.usuario).toContain("heroe-imagen: aurora sobre un lago");
  });
  it("penaliza la composición repetida y usa el alt del crítico", async () => {
    const cands = [nasa("a", "Aurora lago"), nasa("b", "Cabaña")];
    const elegir: DepsCompetencia["elegir"] = async ({ slot: s, miniaturas }) => ({
      candidatas: miniaturas.map((m) => ({ indice: m.indice, relevancia: 8, calidad: 8, paleta: 8, aptitud: 9, escena: m.indice === 0 ? "aurora sobre un lago" : "cabaña con luz cálida", alt: m.indice === 0 ? "Aurora verde sobre un lago helado con montañas nevadas al fondo y cielo claro" : "Cabaña de madera con ventanas encendidas bajo una aurora verde rodeada de nieve", motivo: "ok" })),
      elegida: s.slot === "heroe-imagen" ? 0 : 0,
      motivo: "m",
    });
    const r = await resolverConCompetencia([slot("heroe-imagen", "heroe"), slot("galeria-1")], base({ candidatos: cands, elegir, generarOpenAI: undefined, espacial: true, entrada: { claves: ["aurora", "lago", "cabana"], bancos: [], tematica: "espacio" } as never }));
    expect(r.assets.find((a) => a.slot === "heroe-imagen")!.alt).toContain("Aurora verde sobre un lago");
    expect(contarPalabras(r.assets[0].alt)).toBeGreaterThanOrEqual(8);
    expect(r.fuentes["nasa-images"]).toBe(2);
    expect(r.assets.map((a) => a.ruta).sort()).toEqual(["/media/bancos/web/a.webp", "/media/bancos/web/b.webp"]);
  });
  it("en espacio gana la de banco con nota ≥ 7 y no se genera", async () => {
    const elegir: DepsCompetencia["elegir"] = async ({ miniaturas }) => ({ candidatas: miniaturas.map((m) => ({ indice: m.indice, relevancia: 8, calidad: 8, paleta: 8, aptitud: 8, motivo: "ok" })), elegida: miniaturas.length - 1, motivo: "m" });
    let n = 0;
    const r = await resolverConCompetencia([slot("heroe-imagen", "heroe")], base({ candidatos: [nasa("a", "Aurora"), nasa("b", "Aurora 2")], elegir, generarOpenAI: async () => (n++, { ruta: "/media/bancos/generadas/x.webp", modelo: "m" }) }));
    expect(r.assets[0].fuente).toBe("nasa-images");
    expect(n).toBe(0);
  });
});
