// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup } from "@testing-library/react";
import type { EfectoId, Seccion, Tokens } from "@/lib/contratos";
import { efectosAplicables, efectosGlobales } from "@/efectos/aplicables";
import { ejemplos as galeria } from "@/secciones/galeria/ejemplo";
import { ejemplos as heroes } from "@/secciones/heroe/ejemplo";
import { ejemplo as cinta } from "@/secciones/cinta-anuncio/ejemplo";
import { ejemplo as faq } from "@/secciones/faq/ejemplo";
import { ejemplo as formulario } from "@/secciones/formulario-lead/ejemplo";
import { ejemplo as incluye } from "@/secciones/incluye/ejemplo";
import { ejemplo as oferta } from "@/secciones/oferta/ejemplo";
import { landingEjemplo } from "../fixtures/landing-ejemplo";
import { renderizar, simularMedia } from "./ayudas";

let restaurar: (() => void) | null = null;

afterEach(() => {
  cleanup();
  restaurar?.();
  restaurar = null;
});

const tokens = (intensidad: Tokens["intensidad"]): Tokens => ({ ...landingEjemplo.tokens, intensidad });
const con = (seccion: Seccion, ...efectos: EfectoId[]): Seccion => ({ ...seccion, efectos });

const heroeProblema = heroes["problema-primero"];
const heroeMonumental = heroes["producto-monumental"];

describe("filtro de efectos (catálogo, sección e intensidad)", () => {
  it("un efecto de nivel 2 con intensidad 1 no se aplica", () => {
    expect(efectosAplicables(con(heroeProblema, "titular-cinetico"), tokens(1))).toEqual([]);
    expect(efectosAplicables(con(heroeProblema, "titular-cinetico"), tokens(2))).toEqual(["titular-cinetico"]);
  });

  it("un efecto no permitido para la sección se ignora", () => {
    expect(efectosAplicables(con(heroeMonumental, "precio-cae"), tokens(3))).toEqual([]);
    expect(efectosAplicables(con(faq, "mascara-circular"), tokens(3))).toEqual([]);
    expect(efectosAplicables(con(galeria.mosaico, "mascara-circular"), tokens(2))).toEqual(["mascara-circular"]);
    expect(efectosAplicables(con(oferta, "precio-cae"), tokens(1))).toEqual(["precio-cae"]);
  });

  it("un efecto fuera del catálogo se ignora en silencio", () => {
    const inventado = { ...heroeProblema, efectos: ["efecto-inventado"] } as unknown as Seccion;
    expect(efectosAplicables(inventado, tokens(3))).toEqual([]);
  });

  it("los de nivel 3 se aplican con intensidad 3 y se ignoran con menos", () => {
    expect(efectosAplicables(con(heroeMonumental, "video-scroll"), tokens(3))).toEqual(["video-scroll"]);
    expect(efectosAplicables(con(heroeMonumental, "video-scroll"), tokens(2))).toEqual([]);
    expect(efectosAplicables(con(heroeProblema, "video-scroll"), tokens(3))).toEqual([]); // variante no permitida
  });

  it("los efectos globales se activan una vez por landing, si el nivel lo permite", () => {
    const secciones = [con(heroeMonumental, "grano", "cursor-vivo"), con(faq, "grano")];
    expect(efectosGlobales({ secciones, tokens: tokens(2) }).sort()).toEqual(["cursor-vivo", "grano"]);
    expect(efectosGlobales({ secciones, tokens: tokens(1) })).toEqual(["grano"]);
    expect(efectosAplicables(secciones[0], tokens(2))).toEqual([]);
  });
});

describe("LandingRender aplica los efectos filtrados", () => {
  it("con intensidad 1 el titular-cinetico no se pinta; con 2 sí", () => {
    const sobria = renderizar([con(heroeProblema, "titular-cinetico")], { tokens: { intensidad: 1 } });
    expect(sobria.container.querySelector('[data-efecto="titular-cinetico"]')).toBeNull();
    sobria.unmount();

    const audaz = renderizar([con(heroeProblema, "titular-cinetico")], { tokens: { intensidad: 2 } });
    expect(audaz.container.querySelector('[data-efecto="titular-cinetico"]')).not.toBeNull();
    // Accesible: el texto completo sigue disponible para lectores de pantalla.
    expect(audaz.container.querySelector("h1 .sr-only")?.textContent).toBe(heroeProblema.ajustes.titular);
  });

  it("un efecto no permitido para la sección no deja rastro en el DOM", () => {
    const { container } = renderizar([con(faq, "mascara-circular")]);
    expect(container.querySelector("[data-efecto]")).toBeNull();
    expect(container.querySelector("[data-efectos]")).toBeNull();
  });

  it("cada efecto permitido se pinta en su sección", () => {
    const casos: [Seccion, EfectoId][] = [
      [con(faq, "revelar-suave"), "revelar-suave"],
      [con(galeria.mosaico, "mascara-circular"), "mascara-circular"],
      [con(incluye, "mascara-persiana"), "mascara-persiana"],
      [con(cinta, "marquee-reactivo"), "marquee-reactivo"],
      [con(heroeMonumental, "grano"), "grano"],
    ];
    for (const [seccion, efecto] of casos) {
      const { container, unmount } = renderizar([seccion]);
      expect(container.querySelector(`[data-efecto="${efecto}"]`), efecto).not.toBeNull();
      unmount();
    }
  });

  it("el grano queda al 5 % de opacidad", () => {
    const { container } = renderizar([con(heroeMonumental, "grano")]);
    expect(container.querySelector('[data-efecto="grano"] > div')?.className).toContain("opacity-[0.05]");
  });

  it("el precio-cae anima desde el precio anterior con Intl.NumberFormat", () => {
    const numerica: Seccion = {
      ...oferta,
      efectos: ["precio-cae"],
      ajustes: { ...oferta.ajustes, precio: 100, precioAnterior: 200, moneda: "USD" },
      bloques: [{ id: "o1", tipo: "opcion-cantidad", ajustes: { unidades: 1, precio: 100 } }],
    };
    const { container } = renderizar([numerica]);
    expect(container.querySelector('[data-efecto="precio-cae"]')).not.toBeNull();
    expect(container.textContent).toMatch(/100/);
  });
});

describe("respaldo prefers-reduced-motion", () => {
  it("con movimiento reducido cada efecto renderiza su versión estática", () => {
    restaurar = simularMedia({ reducir: true, punteroFino: true });

    const titular = renderizar([con(heroeProblema, "titular-cinetico")], { tokens: { intensidad: 2 } });
    expect(titular.container.querySelector('[data-efecto="titular-cinetico"]')).toBeNull();
    expect(titular.container.querySelector("h1")?.textContent).toBe(heroeProblema.ajustes.titular);
    titular.unmount();

    const revelar = renderizar([con(faq, "revelar-suave")]);
    expect(revelar.container.querySelector('[data-efecto="revelar-suave"]')?.getAttribute("data-estado")).toBe("estatico");
    expect(revelar.container.querySelector(".opacity-0")).toBeNull();
    revelar.unmount();

    const circular = renderizar([con(galeria.mosaico, "mascara-circular")]);
    expect(circular.container.querySelector('[data-efecto="mascara-circular"]')).toBeNull();
    expect(circular.container.querySelectorAll("[data-marcador-slot]").length).toBeGreaterThan(0);
    circular.unmount();

    const persiana = renderizar([con(incluye, "mascara-persiana")]);
    expect(persiana.container.querySelector('[data-efecto="mascara-persiana"]')).toBeNull();
    persiana.unmount();

    const marquee = renderizar([con(cinta, "marquee-reactivo")]);
    const cintaEstatica = marquee.container.querySelector('[data-efecto="marquee-reactivo"]');
    expect(cintaEstatica?.getAttribute("data-estado")).toBe("estatico");
    for (const texto of cinta.ajustes.textos as string[]) {
      expect(marquee.container.textContent).toContain(texto);
    }
    marquee.unmount();

    const grano = renderizar([con(heroeMonumental, "grano")]);
    expect(grano.container.querySelector('[data-efecto="grano"]')?.getAttribute("data-estado")).toBe("estatico");
    expect(grano.container.querySelector(".grano-capa")).toBeNull();
    grano.unmount();

    const cursor = renderizar([con(heroeMonumental, "cursor-vivo")]);
    expect(cursor.container.querySelector('[data-efecto="cursor-vivo"]')).toBeNull();
    cursor.unmount();

    const imantado = renderizar([con(heroeMonumental, "boton-magnetico")]);
    expect(imantado.container.querySelector('[data-efecto="boton-magnetico"]')).toBeNull();
  });

  it("con movimiento reducido el precio se ve final y sin animación", () => {
    restaurar = simularMedia({ reducir: true });
    const numerica: Seccion = {
      ...oferta,
      efectos: ["precio-cae"],
      ajustes: { ...oferta.ajustes, precio: 100, precioAnterior: 200, moneda: "USD" },
      bloques: [{ id: "o1", tipo: "opcion-cantidad", ajustes: { unidades: 1, precio: 100 } }],
    };
    const { container } = renderizar([numerica]);
    expect(container.querySelector('[data-efecto="precio-cae"]')).toBeNull();
    expect(container.textContent).toMatch(/100/);
  });

  it("la simulación de la página de revisión (reducirMovimiento) equivale al sistema", () => {
    const { container } = renderizar([con(heroeProblema, "titular-cinetico")], {
      tokens: { intensidad: 2 },
      reducirMovimiento: true,
    });
    expect(container.querySelector('[data-efecto="titular-cinetico"]')).toBeNull();
    expect(container.querySelector("h1")?.textContent).toBe(heroeProblema.ajustes.titular);
  });
});

describe("puntero fino", () => {
  it("cursor-vivo y boton-magnetico solo se activan con pointer: fine", () => {
    restaurar = simularMedia({ punteroFino: false });
    const sin = renderizar([con(heroeMonumental, "cursor-vivo"), con(formulario, "boton-magnetico")]);
    expect(sin.container.querySelector('[data-efecto="cursor-vivo"]')).toBeNull();
    expect(sin.container.querySelector('[data-efecto="boton-magnetico"]')).toBeNull();
    sin.unmount();
    restaurar();

    restaurar = simularMedia({ punteroFino: true });
    const con2 = renderizar([con(heroeMonumental, "cursor-vivo"), con(formulario, "boton-magnetico")]);
    expect(con2.container.querySelector('[data-efecto="cursor-vivo"]')).not.toBeNull();
    expect(con2.container.querySelector('[data-efecto="boton-magnetico"]')).not.toBeNull();
  });
});
