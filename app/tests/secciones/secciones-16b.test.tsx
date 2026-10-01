// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup } from "@testing-library/react";
import type { Asset } from "@/lib/contratos";
import { ejemplos as agenda, assets as aAgenda } from "@/secciones/agenda/ejemplo";
import { ejemplos as impacto, assets as aImpacto } from "@/secciones/impacto/ejemplo";
import { ejemplos as lineaTiempo, assets as aLinea } from "@/secciones/linea-tiempo/ejemplo";
import { ejemplos as ponentes, assets as aPonentes } from "@/secciones/ponentes/ejemplo";
import { schema as schemaAgenda } from "@/secciones/agenda/schema";
import { schema as schemaImpacto } from "@/secciones/impacto/schema";
import { renderizar } from "./ayudas";

afterEach(cleanup);

const conFoto = (a: Asset): Asset => ({ ...a, ruta: `/media/prueba/${a.slot}.webp`, credito: "NASA/JPL-Caltech", licencia: "dominio-publico-nasa" });
const TODAS = [...aAgenda, ...aImpacto, ...aLinea, ...aPonentes].map(conFoto);

describe("secciones de la 16-B", () => {
  it("cada variante usa al menos una imagen de banco", () => {
    for (const mapa of [agenda, ponentes, lineaTiempo, impacto]) {
      for (const s of Object.values(mapa)) {
        const { container, unmount } = renderizar([s], { assets: TODAS });
        expect(container.querySelectorAll("img").length, `${s.tipo} ${s.variante}`).toBeGreaterThan(0);
        unmount();
      }
    }
  });

  it("sin archivo muestran el marcador de imagen pendiente, no una imagen rota", () => {
    const { container } = renderizar([agenda["lista-horas"]]);
    expect(container.querySelectorAll("img")).toHaveLength(0);
    expect(container.querySelector("[data-marcador-slot='agenda-imagen']")).not.toBeNull();
  });

  it("las horas, nombres, fechas y cifras que faltan quedan como [COMPLETAR]", () => {
    for (const s of [agenda["por-dias"], ponentes.tarjetas, lineaTiempo.vertical, impacto["cifras-con-foto"]]) {
      expect(renderizar([s], { assets: TODAS }).container.textContent, `${s.tipo}`).toContain("[COMPLETAR]");
      cleanup();
    }
  });

  it("agenda pide de 2 a 8 momentos", () => {
    const momento = (i: number) => ({ id: `m${i}`, tipo: "momento", ajustes: { cuando: "7:00 p. m.", titulo: "Algo" } });
    const aj = agenda["lista-horas"].ajustes;
    expect(schemaAgenda.safeParse({ ajustes: aj, bloques: [momento(1)] }).success).toBe(false);
    expect(schemaAgenda.safeParse({ ajustes: aj, bloques: [1, 2].map(momento) }).success).toBe(true);
    expect(schemaAgenda.safeParse({ ajustes: aj, bloques: [1, 2, 3, 4, 5, 6, 7, 8, 9].map(momento) }).success).toBe(false);
  });

  it("impacto dibuja el avance solo con dos cifras reales", () => {
    const base = impacto.meta;
    const sin = renderizar([base], { assets: TODAS });
    expect(sin.container.querySelector("[role='progressbar']")).toBeNull();
    sin.unmount();
    const con = renderizar([{ ...base, ajustes: { ...base.ajustes, logrado: 250, meta: 1000 } }], { assets: TODAS });
    expect(con.container.querySelector("[role='progressbar']")?.getAttribute("aria-valuenow")).toBe("25");
    expect(schemaImpacto.safeParse({ ajustes: { ...base.ajustes, logrado: "mucho" }, bloques: base.bloques }).success).toBe(false);
  });

  it("la línea de tiempo horizontal se desliza con scroll-snap y las cartas son accesibles con teclado", () => {
    const { container } = renderizar([lineaTiempo.horizontal], { assets: TODAS });
    const pista = container.querySelector("ol[role='region']") as HTMLElement;
    expect(pista.className).toContain("snap-x");
    expect(pista.tabIndex).toBe(0);
  });
});
