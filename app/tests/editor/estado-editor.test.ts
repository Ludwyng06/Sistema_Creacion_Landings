import { describe, expect, it } from "vitest";
import {
  MAX_HISTORIAL,
  estadoInicial,
  motivoNoEliminar,
  reducirEditor,
  type AccionEditor,
  type EstadoEditor,
} from "@/componentes/editor/estado-editor";
import { landingEjemplo } from "../fixtures/landing-ejemplo";
import { EJEMPLO_POR_TIPO } from "@/secciones/ejemplos-por-tipo";
import { registro } from "@/secciones/registro";
import type { LandingDoc, TipoSeccion } from "@/lib/contratos";

const con = (tipos: TipoSeccion[]): LandingDoc => ({
  ...landingEjemplo,
  secciones: tipos.map((t, i) => ({ ...EJEMPLO_POR_TIPO[t], id: `${t}-${i}` })),
});
const DOC = con(["heroe", "beneficios", "faq", "garantia", "cifras", "formulario-lead"]);
const ids = (e: EstadoEditor) => e.doc.secciones.map((s) => s.id);
const aplicar = (e: EstadoEditor, ...a: AccionEditor[]) => a.reduce(reducirEditor, e);

describe("reducer del editor", () => {
  it("reordena una sección", () => {
    const e = aplicar(estadoInicial(DOC), { tipo: "reordenar", desde: 2, hasta: 1 });
    expect(ids(e).slice(0, 3)).toEqual(["heroe-0", "faq-2", "beneficios-1"]);
  });

  it("el héroe queda fijo: no se mueve ni nadie toma su lugar", () => {
    const e0 = estadoInicial(DOC);
    expect(reducirEditor(e0, { tipo: "reordenar", desde: 0, hasta: 3 })).toBe(e0);
    const e = reducirEditor(e0, { tipo: "reordenar", desde: 3, hasta: 0 });
    expect(ids(e)[0]).toBe("heroe-0");
    expect(ids(e)[1]).toBe("garantia-3");
  });

  it("oculta y vuelve a mostrar", () => {
    const e = aplicar(estadoInicial(DOC), { tipo: "alternar-visible", id: "faq-2" });
    expect(e.doc.secciones[2].visible).toBe(false);
    expect(aplicar(e, { tipo: "alternar-visible", id: "faq-2" }).doc.secciones[2].visible).toBe(true);
  });

  it("duplica con ids nuevos y sin marca de edición humana", () => {
    const tipoMultiple = (Object.keys(registro) as TipoSeccion[]).find(
      (t) => t !== "heroe" && t !== "formulario-lead" && (registro[t]?.maxPorLanding ?? 1) > 1,
    );
    expect(tipoMultiple).toBeTruthy();
    const doc = con(["heroe", "beneficios", tipoMultiple!, "garantia", "cifras", "formulario-lead"]);
    const marcada = { ...doc.secciones[2], editadoPorHumano: ["titulo"] };
    const e0 = aplicar(estadoInicial(doc), { tipo: "editar-seccion", id: marcada.id, seccion: marcada });
    const dup = aplicar(e0, { tipo: "duplicar", id: marcada.id });
    expect(dup.doc.secciones).toHaveLength(doc.secciones.length + 1);
    expect(new Set(ids(dup)).size).toBe(ids(dup).length);
    expect(dup.doc.secciones[3].tipo).toBe(tipoMultiple);
    expect(dup.doc.secciones[3].editadoPorHumano).toBeUndefined();
    expect(dup.seleccion).toBe(dup.doc.secciones[3].id);
  });

  it("no duplica una sección que ya está en su máximo", () => {
    const e0 = estadoInicial(DOC);
    expect(reducirEditor(e0, { tipo: "duplicar", id: "beneficios-1" })).toBe(e0);
  });

  it("protege el héroe y el formulario: no se eliminan ni se duplican", () => {
    const e0 = estadoInicial(DOC);
    for (const id of ["heroe-0", "formulario-lead-5"]) {
      expect(reducirEditor(e0, { tipo: "eliminar", id })).toBe(e0);
      expect(reducirEditor(e0, { tipo: "duplicar", id })).toBe(e0);
    }
    expect(motivoNoEliminar(DOC, DOC.secciones[0])).toMatch(/héroe/i);
    expect(motivoNoEliminar(DOC, DOC.secciones[5])).toMatch(/formulario/i);
  });

  it("elimina una sección normal y respeta el mínimo de secciones", () => {
    const e = aplicar(estadoInicial(DOC), { tipo: "eliminar", id: "faq-2" });
    expect(ids(e)).not.toContain("faq-2");
    const chico = estadoInicial(con(["heroe", "beneficios", "faq", "garantia", "formulario-lead"]));
    expect(reducirEditor(chico, { tipo: "eliminar", id: "faq-2" })).toBe(chico);
  });

  it("agrega una sección antes del formulario e ignora las que ya están", () => {
    const e = aplicar(estadoInicial(DOC), { tipo: "agregar", seccionTipo: "oferta" });
    const tipos = e.doc.secciones.map((s) => s.tipo);
    expect(tipos.at(-1)).toBe("formulario-lead");
    expect(tipos.at(-2)).toBe("oferta");
    expect(aplicar(e, { tipo: "agregar", seccionTipo: "oferta" }).doc.secciones).toHaveLength(e.doc.secciones.length);
  });

  it("deshacer y rehacer recuperan los estados", () => {
    const e1 = aplicar(estadoInicial(DOC), { tipo: "alternar-visible", id: "faq-2" });
    const e2 = aplicar(e1, { tipo: "reordenar", desde: 3, hasta: 1 });
    const atras = aplicar(e2, { tipo: "deshacer" });
    expect(atras.doc).toEqual(e1.doc);
    expect(aplicar(atras, { tipo: "deshacer" }).doc).toEqual(DOC);
    expect(aplicar(atras, { tipo: "rehacer" }).doc).toEqual(e2.doc);
  });

  it("una edición nueva borra el futuro y el historial tiene tope", () => {
    const e1 = aplicar(estadoInicial(DOC), { tipo: "alternar-visible", id: "faq-2" }, { tipo: "deshacer" });
    expect(e1.futuro).toHaveLength(1);
    expect(aplicar(e1, { tipo: "alternar-visible", id: "garantia-3" }).futuro).toHaveLength(0);
    let e = estadoInicial(DOC);
    for (let i = 0; i < MAX_HISTORIAL + 20; i++) e = reducirEditor(e, { tipo: "alternar-visible", id: "faq-2" });
    expect(e.pasado).toHaveLength(MAX_HISTORIAL);
  });

  it("fusiona ediciones seguidas del mismo campo en un paso de historial", () => {
    const base = estadoInicial(DOC);
    const s = base.doc.secciones[1];
    const editar = (t: number, texto: string): AccionEditor => ({
      tipo: "editar-seccion",
      id: s.id,
      seccion: { ...s, ajustes: { ...s.ajustes, titulo: texto } },
      clave: "titulo",
      t,
    });
    const e = aplicar(base, editar(100, "a"), editar(400, "ab"), editar(700, "abc"));
    expect(e.pasado).toHaveLength(1);
    expect(aplicar(e, { tipo: "deshacer" }).doc).toEqual(DOC);
  });

  it("solo los cambios de la persona se marcan para autoguardar", () => {
    expect(estadoInicial(DOC).origen).toBe("servidor");
    expect(aplicar(estadoInicial(DOC), { tipo: "alternar-visible", id: "faq-2" }).origen).toBe("usuario");
    const sync = aplicar(estadoInicial(DOC), { tipo: "sincronizar-marcas", doc: DOC });
    expect(sync.origen).toBe("servidor");
    expect(sync.pasado).toHaveLength(0);
  });
});
