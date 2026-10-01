import { describe, expect, it } from "vitest";
import { ajustesDeBloqueNuevo, erroresDeSeccion, generarFormulario } from "@/componentes/editor/esquema-form";
import { registro } from "@/secciones/registro";
import { METAS } from "@/secciones/metas";
import { EJEMPLO_POR_TIPO } from "@/secciones/ejemplos-por-tipo";
import type { TipoSeccion } from "@/lib/contratos";

const formulario = (tipo: TipoSeccion) => generarFormulario(registro[tipo]!.schema, METAS[tipo]);

describe("generador de formularios desde el schema", () => {
  it("héroe: textos; hay selects con opciones en otras secciones", () => {
    const f = formulario("heroe");
    expect(f.ajustes.length).toBeGreaterThan(2);
    const selects = (Object.keys(registro) as TipoSeccion[]).flatMap((t) => formulario(t).ajustes.filter((c) => c.clase === "select"));
    expect(selects.length).toBeGreaterThan(0);
    for (const c of selects) expect(c.opciones?.length).toBeGreaterThan(1);
    expect(f.ajustes.some((c) => c.clase === "texto" || c.clase === "textoLargo")).toBe(true);
  });

  it("beneficios: lista de bloques con límites tomados del schema", () => {
    const f = formulario("beneficios");
    expect(f.admiteBloques).toBe(true);
    expect(f.bloques).toHaveLength(1);
    const [bloque] = f.bloques;
    expect(bloque.max).toBeGreaterThanOrEqual(bloque.min);
    expect(bloque.campos.some((c) => c.clase === "texto" || c.clase === "textoLargo")).toBe(true);
    const nuevo = ajustesDeBloqueNuevo(bloque);
    for (const c of bloque.campos.filter((x) => x.requerido)) expect(nuevo).toHaveProperty(c.clave);
  });

  it("formulario-lead: multiselect de campos y sin bloques", () => {
    const f = formulario("formulario-lead");
    expect(f.ajustes.find((c) => c.clave === "campos")?.clase).toBe("multiselect");
    expect(f.ajustes.find((c) => c.clave === "obligatorios")?.clase).toBe("multiselect");
    expect(f.admiteBloques).toBe(false);
  });

  it("produce un control reconocido para cada ajuste de las 18 secciones", () => {
    for (const tipo of Object.keys(registro) as TipoSeccion[]) {
      const f = formulario(tipo);
      for (const c of [...f.ajustes, ...f.bloques.flatMap((b) => b.campos)]) {
        expect(c.clase, `${tipo}.${c.clave}`).toBeTruthy();
        expect(c.etiqueta.length).toBeGreaterThan(0);
      }
    }
  });

  it("los ejemplos de cada sección validan sin errores", () => {
    for (const tipo of Object.keys(registro) as TipoSeccion[]) {
      const s = EJEMPLO_POR_TIPO[tipo];
      expect(erroresDeSeccion(registro[tipo]!.schema, s), tipo).toEqual({});
    }
  });

  it("errores en español por ruta y respeta los límites de bloques", () => {
    const base = EJEMPLO_POR_TIPO.beneficios;
    const { max } = formulario("beneficios").bloques[0];
    const bloques = Array.from({ length: max + 1 }, (_, i) => ({ ...base.bloques[0], id: `b${i}` }));
    const errores = erroresDeSeccion(registro.beneficios!.schema, { ajustes: base.ajustes, bloques });
    expect(Object.values(errores).some((m) => /máximo/i.test(m))).toBe(true);
    const sinBloques = erroresDeSeccion(registro.beneficios!.schema, { ajustes: base.ajustes, bloques: [] });
    expect(Object.values(sinBloques).some((m) => /al menos/i.test(m))).toBe(true);
  });
});
