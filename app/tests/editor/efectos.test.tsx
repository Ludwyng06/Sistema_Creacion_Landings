// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CATALOGO_EFECTOS, EFECTOS_ID, MAX_EFECTOS_NIVEL_3, type EfectoId, type LandingDoc } from "@/lib/contratos";
import { contarNivel3, estadoInicial, reducirEditor } from "@/componentes/editor/estado-editor";
import { efectosPermitidos, PanelEfectos, puedeActivarEfecto } from "@/componentes/editor/PanelEfectos";
import { landingEjemplo } from "../fixtures/landing-ejemplo";
import { EJEMPLO_POR_TIPO } from "@/secciones/ejemplos-por-tipo";
import type { TipoSeccion } from "@/lib/contratos";

const TIPOS: TipoSeccion[] = ["heroe", "beneficios", "como-funciona", "galeria", "antes-despues", "testimonios", "formulario-lead"];
const SECCIONES = TIPOS.map((t) => ({ ...EJEMPLO_POR_TIPO[t], efectos: [] as EfectoId[] }));

afterEach(cleanup);

const nivel = (id: EfectoId) => CATALOGO_EFECTOS[id].nivel;
const nivel3 = EFECTOS_ID.filter((id) => nivel(id) === 3);

/** Documento con `n` efectos de nivel 3 repartidos en las secciones que los admiten. */
function docConNivel3(n: number): LandingDoc {
  const secciones = SECCIONES.map((s) => ({ ...s, efectos: [] as EfectoId[] }));
  let puestos = 0;
  for (const id of nivel3) {
    if (puestos >= n) break;
    const s = secciones.find((x) => efectosPermitidos(x).includes(id) && !x.efectos.includes(id));
    if (s) {
      s.efectos.push(id);
      puestos += 1;
    }
  }
  expect(puestos).toBe(n);
  return { ...landingEjemplo, secciones };
}

describe("efectos · límite de nivel 3", () => {
  it("hay más de 3 efectos de nivel 3 en el catálogo para probar el tope", () => {
    expect(nivel3.length).toBeGreaterThan(MAX_EFECTOS_NIVEL_3);
  });

  it("con 3 activos no se puede activar un cuarto, pero sí conservar uno activo", () => {
    const doc = docConNivel3(3);
    expect(contarNivel3(doc, nivel)).toBe(3);
    const cuarto = nivel3.find((id) => !doc.secciones.some((s) => s.efectos?.includes(id)))!;
    const destino = doc.secciones.find((s) => efectosPermitidos(s).includes(cuarto))!;
    expect(puedeActivarEfecto(doc, destino, cuarto)).toBe(false);
    const activa = doc.secciones.find((s) => s.efectos?.some((e) => nivel(e) === 3))!;
    const idActivo = activa.efectos!.find((e) => nivel(e) === 3)!;
    expect(puedeActivarEfecto(doc, activa, idActivo)).toBe(true);
  });

  it("con menos de 3 sí se puede activar", () => {
    const doc = docConNivel3(2);
    const otro = nivel3.find((id) => !doc.secciones.some((s) => s.efectos?.includes(id)))!;
    const destino = doc.secciones.find((s) => efectosPermitidos(s).includes(otro))!;
    expect(puedeActivarEfecto(doc, destino, otro)).toBe(true);
  });

  it("el panel muestra «3 de 3» y deshabilita los demás de nivel 3", () => {
    const doc = docConNivel3(3);
    const seccion = doc.secciones.find((s) => nivel3.some((id) => efectosPermitidos(s).includes(id) && !s.efectos?.includes(id)))!;
    const onAccion = vi.fn();
    render(<PanelEfectos doc={doc} seccion={seccion} onAccion={onAccion} />);
    expect(screen.getByText(/3 de 3/)).toBeTruthy();
    const libres = nivel3.filter((id) => efectosPermitidos(seccion).includes(id) && !seccion.efectos?.includes(id));
    expect(libres.length).toBeGreaterThan(0);
    for (const id of libres) {
      const caja = screen.getByText(id, { selector: "span.font-medium" }).closest("label")!.querySelector("input")!;
      expect(caja.disabled).toBe(true);
      fireEvent.click(caja);
    }
    expect(onAccion).not.toHaveBeenCalled();
  });

  it("el reducer acepta activar un efecto permitido", () => {
    const base = { ...landingEjemplo, secciones: SECCIONES };
    const s = base.secciones[0];
    const id = efectosPermitidos(s)[0];
    const e = reducirEditor(estadoInicial(base), { tipo: "editar-efectos", id: s.id, efectos: [id] });
    expect(e.doc.secciones[0].efectos).toEqual([id]);
  });
});
