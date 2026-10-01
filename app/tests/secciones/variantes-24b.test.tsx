// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup } from "@testing-library/react";
import { TIPOS_SECCION } from "@/lib/contratos";
import { tieneVariantes, variantesDe, variantesPorTipo, varianteActual, conVariante } from "@/secciones/catalogo-variantes";
import { ASSETS_POR_TIPO } from "@/secciones/ejemplos-por-tipo";
import { FONDOS_POR_ESTILO, fondosDeRitmo } from "@/secciones/fondos";
import { ESTILOS } from "@/lib/tecnicas/semillas";
import { landingEjemplo } from "../fixtures/landing-ejemplo";
import { renderizar } from "./ayudas";

afterEach(cleanup);

describe("24-B · cada tipo de sección tiene al menos 2 variantes", () => {
  it("todos los tipos salvo html-libre", () => {
    const sin = (TIPOS_SECCION as readonly string[]).filter((t) => t !== "html-libre" && !tieneVariantes(t as never));
    expect(sin).toEqual([]);
    expect(Object.keys(variantesPorTipo()).length).toBe(TIPOS_SECCION.length - 1);
  });

  it("cada variante nueva dibuja algo distinto y lo marca con data-variante", () => {
    for (const [tipo, claves] of [
      ["cifras", ["franja", "tarjetas"]],
      ["problema-solucion", ["columna", "dividida"]],
      ["antes-despues", ["deslizador", "lado-a-lado"]],
      ["video", ["centrado", "lado"]],
      ["formulario-lead", ["tarjeta", "dividido"]],
    ] as const) {
      const htmls = claves.map((clave) => {
        const v = variantesDe(tipo).find((x) => x.clave === clave)!;
        const r = renderizar([v.seccion], { assets: ASSETS_POR_TIPO[tipo] });
        const html = r.container.querySelector("[data-seccion-id]")?.innerHTML ?? "";
        r.unmount();
        return html;
      });
      expect(htmls[0], `${tipo}: no hay dos variantes distintas`).not.toBe(htmls[1]);
      expect(htmls[1], `${tipo}/${claves[1]} sin data-variante`).toContain(`data-variante="${claves[1]}"`);
    }
  });

  it("conVariante cambia solo el campo de la variante (estilo, variante o disposición)", () => {
    const cinta = variantesDe("cinta-anuncio")[0].seccion;
    expect(conVariante(cinta, "contorno").ajustes.estilo).toBe("contorno");
    expect(varianteActual(conVariante(cinta, "contorno"))).toBe("contorno");
    const cifras = variantesDe("cifras")[0].seccion;
    expect(conVariante(cifras, "tarjetas").variante).toBe("tarjetas");
  });
});

describe("24-B · fondos con personalidad", () => {
  it("cada estilo de la semilla tiene su tratamiento", () => {
    for (const e of ESTILOS) expect(FONDOS_POR_ESTILO[e], e).toBeTruthy();
  });
  it("estilos distintos reparten fondos distintos y el número de la semilla cambia el punto de partida", () => {
    const s = landingEjemplo.secciones;
    const a = [...fondosDeRitmo(s, "Memphis contenido", 0).values()];
    const b = [...fondosDeRitmo(s, "brutalismo tipográfico", 0).values()];
    const c = [...fondosDeRitmo(s, "Memphis contenido", 1).values()];
    expect(a).not.toEqual(b);
    expect(a).not.toEqual(c);
    expect(a.length).toBe(b.length);
  });
  it("un estilo desconocido cae al fondo suave de siempre", () => {
    expect([...new Set(fondosDeRitmo(landingEjemplo.secciones, "otro", 3).values())]).toEqual(["suave"]);
  });
});
