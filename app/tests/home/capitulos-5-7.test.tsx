// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RUBRICA_CRITICO } from "@/lib/tecnicas";
import { Banco } from "@/app/(home)/capitulos/Banco";
import { tarjetasDelBanco, type TarjetaBanco } from "@/app/(home)/banco-tarjetas";
import {
  PUNTAJES_ANTES,
  PUNTAJES_DESPUES,
  ejesDeRubrica,
  entreValores,
  formatearPuntaje,
  poligono,
  puntajePonderado,
  puntoDeEje,
} from "@/app/(home)/radar";
import { mezclarColor, mezclarTokens, morphEn, opacidadesDeCapas, semillasDelHome } from "@/app/(home)/semillas-home";
import { simularMedia } from "../secciones/ayudas";

afterEach(cleanup);

describe("capítulo 5 · el morph de semillas", () => {
  const semillas = semillasDelHome();

  it("usa tres semillas reales con estilos distintos", () => {
    expect(semillas).toHaveLength(3);
    expect(new Set(semillas.map((s) => s.semilla.estilo)).size).toBe(3);
    expect(new Set(semillas.map((s) => s.tokens.colores.fondo)).size).toBe(3);
  });

  it("mezclarColor respeta los extremos y da el punto medio", () => {
    expect(mezclarColor("#000000", "#ffffff", 0)).toBe("#000000");
    expect(mezclarColor("#000000", "#ffffff", 1)).toBe("#ffffff");
    expect(mezclarColor("#000000", "#ffffff", 0.5)).toBe("#808080");
  });

  it("los tokens intermedios quedan entre los de las dos semillas", () => {
    const [a, b] = semillas;
    const medio = mezclarTokens(a.tokens, b.tokens, 0.5);
    expect(medio.colores.fondo).toBe(mezclarColor(a.tokens.colores.fondo, b.tokens.colores.fondo, 0.5));
    expect(medio.colores.fondo).not.toBe(a.tokens.colores.fondo);
    expect(medio.colores.fondo).not.toBe(b.tokens.colores.fondo);
    const minusculas = (c: Record<string, string>) => Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v.toLowerCase()]));
    expect(mezclarTokens(a.tokens, b.tokens, 0).colores).toEqual(minusculas(a.tokens.colores));
    expect(mezclarTokens(a.tokens, b.tokens, 1).colores).toEqual(minusculas(b.tokens.colores));
  });

  it("morphEn sostiene cada semilla, mezcla entre ellas y no se sale del rango", () => {
    expect(morphEn(0, semillas)).toMatchObject({ indice: 0, mezcla: 0, tokens: semillas[0].tokens });
    expect(morphEn(0.5, semillas)).toMatchObject({ indice: 1, mezcla: 0, tokens: semillas[1].tokens });
    expect(morphEn(1, semillas)).toMatchObject({ indice: 2, tokens: semillas[2].tokens });
    const entre = morphEn(0.3, semillas);
    expect(entre.mezcla).toBeGreaterThan(0);
    expect(entre.mezcla).toBeLessThan(1);
    expect(entre.tokens.colores.fondo).not.toBe(semillas[0].tokens.colores.fondo);
    expect(morphEn(-3, semillas).indice).toBe(0);
    expect(morphEn(7, semillas).indice).toBe(2);
  });
});

describe("capítulo 5 · las capas apiladas", () => {
  it("la primera capa siempre se ve y las otras aparecen en su tramo, sin salirse de 0–1", () => {
    expect(opacidadesDeCapas(0)).toEqual([1, 0, 0]);
    expect(opacidadesDeCapas(0.3)).toEqual([1, expect.closeTo(0.5, 5), 0]);
    expect(opacidadesDeCapas(0.5)).toEqual([1, 1, 0]);
    expect(opacidadesDeCapas(0.7)).toEqual([1, 1, expect.closeTo(0.5, 5)]);
    expect(opacidadesDeCapas(1)).toEqual([1, 1, 1]);
    expect(opacidadesDeCapas(-2)).toEqual([1, 0, 0]);
  });
});

describe("capítulo 6 · el radar del crítico", () => {
  const ejes = ejesDeRubrica();

  it("tiene 8 ejes y sus nombres salen de la rúbrica del código", () => {
    expect(ejes).toHaveLength(8);
    for (const e of ejes) expect(RUBRICA_CRITICO).toContain(e.nombre);
    expect(ejes.map((e) => e.nombre)[0]).toBe("Claridad en 3 s");
    expect(ejes.reduce((s, e) => s + e.peso, 0)).toBe(100);
  });

  it("el puntaje pasa de 6,2 a 9,1", () => {
    expect(puntajePonderado(PUNTAJES_ANTES, ejes)).toBeCloseTo(6.2, 5);
    expect(puntajePonderado(PUNTAJES_DESPUES, ejes)).toBeCloseTo(9.1, 5);
    expect(formatearPuntaje(6.2)).toBe("6,2");
    expect(formatearPuntaje(9.1)).toBe("9,1");
  });

  it("la geometría reparte 8 ejes a 45° y el valor fija la distancia", () => {
    const arriba = puntoDeEje(0, 8, 100);
    expect(arriba.x).toBeCloseTo(0, 6);
    expect(arriba.y).toBeCloseTo(-100, 6);
    const derecha = puntoDeEje(2, 8, 100);
    expect(derecha.x).toBeCloseTo(100, 6);
    expect(puntoDeEje(0, 8, 100, 5).y).toBeCloseTo(-50, 6);
    expect(puntoDeEje(0, 8, 100, 99).y).toBeCloseTo(-100, 6);
    expect(poligono(PUNTAJES_ANTES, 100, { x: 0, y: 0 }).split(" ")).toHaveLength(8);
  });

  it("entreValores interpola entre antes y después", () => {
    expect(entreValores(PUNTAJES_ANTES, PUNTAJES_DESPUES, 0)).toEqual([...PUNTAJES_ANTES]);
    expect(entreValores(PUNTAJES_ANTES, PUNTAJES_DESPUES, 1)).toEqual([...PUNTAJES_DESPUES]);
    expect(entreValores([0], [10], 0.5)).toEqual([5]);
  });
});

describe("capítulo 7 · el banco", () => {
  const entrada = (n: number) => ({ id: `id-${n}`, nombre: `Landing ${n}`, puntaje: 8.4, tecnicas: ["Semilla"], prompt: `prompt ${n}`, href: `/l/landing-${n}` });
  const ejemplos = [1, 2, 3, 4].map((n) => ({ ...entrada(n), id: `ej-${n}`, puntaje: null, href: null }));

  it("con el banco vacío muestra 3 ejemplos marcados y sin enlace público", () => {
    const t = tarjetasDelBanco([], ejemplos);
    expect(t).toHaveLength(3);
    expect(t.every((x) => x.esEjemplo && x.href === null)).toBe(true);
  });

  it("con datos muestra las reales (hasta 6) y ningún ejemplo", () => {
    const t = tarjetasDelBanco([1, 2, 3, 4, 5, 6, 7].map(entrada), ejemplos);
    expect(t).toHaveLength(6);
    expect(t.some((x) => x.esEjemplo)).toBe(false);
  });

  function pintar(tarjetas: TarjetaBanco[], reducir = false) {
    const restaurar = simularMedia({ reducir });
    const r = render(<Banco tarjetas={tarjetas} />);
    return { ...r, restaurar };
  }

  it("la pista usa scroll-snap nativo, sin scroll horizontal fijado, y enlaza a /banco", () => {
    const { container, restaurar } = pintar(tarjetasDelBanco([], ejemplos));
    const pista = container.querySelector("[data-pista-banco]")!;
    expect(pista.className).toContain("snap-x");
    expect(pista.className).toContain("overflow-x-auto");
    expect(container.querySelector("[data-pinned], .pin-spacer")).toBeNull();
    expect(screen.getAllByText("Ejemplo")).toHaveLength(3);
    expect(screen.getByRole("link", { name: /banco/i }).getAttribute("href")).toBe("/banco");
    restaurar();
  });

  it("voltea con clic y muestra el prompt; se puede volver", () => {
    const { container, restaurar } = pintar(tarjetasDelBanco([entrada(1)], ejemplos));
    const tarjeta = container.querySelector("[data-tarjeta-banco]")!;
    expect(tarjeta.getAttribute("data-volteada")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "Ver el prompt" }));
    expect(tarjeta.getAttribute("data-volteada")).toBe("true");
    expect(screen.getByText("prompt 1")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Volver a la tarjeta" }));
    expect(tarjeta.getAttribute("data-volteada")).toBe("false");
    restaurar();
  });

  it("con reduced-motion no gira en 3D: cambia por un fundido", () => {
    const { container, restaurar } = pintar(tarjetasDelBanco([entrada(1)], ejemplos), true);
    fireEvent.click(screen.getByRole("button", { name: "Ver el prompt" }));
    expect(container.innerHTML).not.toContain("rotateY");
    expect(container.innerHTML).toContain("opacity 200ms");
    restaurar();
  });
});
