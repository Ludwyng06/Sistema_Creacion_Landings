// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import type { Asset, Seccion } from "@/lib/contratos";
import { ejemplos as galeria } from "@/secciones/galeria/ejemplo";
import { ASSETS_DE_VARIANTES_CON_IMAGEN, VARIANTES_CON_IMAGEN } from "@/secciones/ejemplos-imagen";
import { ejemplos as paraQuien, assets as assetsParaQuien } from "@/secciones/para-quien/ejemplo";
import { ejemplos as mecanismo, assets as assetsMecanismo } from "@/secciones/mecanismo/ejemplo";
import { ejemplos as historia, assets as assetsHistoria } from "@/secciones/historia/ejemplo";
import { ejemplos as resumen, assets as assetsResumen } from "@/secciones/resumen/ejemplo";
import { ejemplos as escena, assets as assetsEscena } from "@/secciones/escena-uso/ejemplo";
import { schema as schemaMecanismo } from "@/secciones/mecanismo/schema";
import { schema as schemaParaQuien } from "@/secciones/para-quien/schema";
import { idsConFondoSuave } from "@/secciones/presentacion";
import { tieneVariantes, variantesDe } from "@/secciones/catalogo-variantes";
import { landingEjemplo } from "../fixtures/landing-ejemplo";
import { renderizar, simularMedia } from "./ayudas";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const conFoto = (a: Asset, i: number): Asset => ({ ...a, ruta: `/media/prueba/${a.slot}.webp`, alt: `Foto ${i}`, credito: "NASA/JPL-Caltech", licencia: "dominio-publico-nasa" });
const TODAS = [...assetsParaQuien, ...assetsMecanismo, ...assetsHistoria, ...assetsResumen, ...assetsEscena, ...ASSETS_DE_VARIANTES_CON_IMAGEN];

describe("las 5 secciones nuevas de la 14-B", () => {
  const NUEVAS: [string, Record<string, Seccion>][] = [
    ["para-quien", paraQuien],
    ["mecanismo", mecanismo],
    ["historia", historia],
    ["resumen", resumen],
    ["escena-uso", escena],
  ];

  it.each(NUEVAS)("%s: cada variante trae al menos una imagen en su composición", (_, mapa) => {
    for (const seccion of Object.values(mapa)) {
      const sinFotos = renderizar([seccion]);
      expect(sinFotos.container.querySelectorAll("[data-marcador-slot]").length, `${seccion.variante} sin archivos`).toBeGreaterThan(0);
      sinFotos.unmount();
      const conFotos = renderizar([seccion], { assets: TODAS.map(conFoto) });
      expect(conFotos.container.querySelectorAll("img").length, `${seccion.variante} con archivos`).toBeGreaterThan(0);
      conFotos.unmount();
    }
  });

  it("para-quien: «dos perfiles» separa a quién sí y a quién no, y se apila en móvil", () => {
    const { container } = renderizar([paraQuien["dos-perfiles"]]);
    expect(container.querySelector("[data-perfil='si']")?.textContent).toContain("Pasas horas sentado");
    expect(container.querySelector("[data-perfil='no']")?.textContent).toContain("tratamiento médico");
    expect(container.innerHTML).toMatch(/flex flex-col gap-4 md:grid md:grid-cols-2/);
  });

  it("para-quien: la lista muestra los «no» aparte y el schema pide de 3 a 8 puntos", () => {
    const { container } = renderizar([paraQuien["lista-check"]]);
    expect(container.textContent).toContain("No es para ti si…");
    const punto = (i: number) => ({ id: `p${i}`, tipo: "punto", ajustes: { texto: "Texto", aplica: true } });
    expect(schemaParaQuien.safeParse({ ajustes: { titulo: "x" }, bloques: [punto(1), punto(2)] }).success).toBe(false);
    expect(schemaParaQuien.safeParse({ ajustes: { titulo: "x" }, bloques: [punto(1), punto(2), punto(3)] }).success).toBe(true);
  });

  it("mecanismo: «zoom detalle» numera las anotaciones sobre la imagen y limita a 4", () => {
    const { container } = renderizar([mecanismo["zoom-detalle"]]);
    expect(container.querySelectorAll("[data-punto]")).toHaveLength(3);
    expect(container.querySelectorAll("ol li")).toHaveLength(3);
    const nota = (i: number) => ({ id: `n${i}`, tipo: "nota", ajustes: { titulo: "Nota" } });
    const base = mecanismo["zoom-detalle"].ajustes;
    expect(schemaMecanismo.safeParse({ ajustes: base, bloques: [1, 2, 3, 4, 5].map(nota) }).success).toBe(false);
    expect(schemaMecanismo.safeParse({ ajustes: base, bloques: [1, 2, 3, 4].map(nota) }).success).toBe(true);
  });

  it("mecanismo: «antes/después de la creencia» tacha lo que se creía", () => {
    const { container } = renderizar([mecanismo["antes-despues-creencia"]]);
    expect(container.querySelector("[data-creencia]")?.textContent).toContain("Pensabas que");
    expect(container.querySelector("[data-realidad]")?.textContent).toContain("Pero en realidad");
  });

  it("historia: la escena pone la imagen de fondo con velo y la carta no", () => {
    expect(renderizar([historia.escena]).container.querySelector("[data-velo]")).not.toBeNull();
    cleanup();
    const carta = renderizar([historia.carta]);
    expect(carta.container.querySelector("[data-velo]")).toBeNull();
    expect(carta.container.textContent).toContain("No es falta de voluntad");
  });

  it("escena-uso: el mosaico muestra 3 fotos con pie y crédito; la banda se mueve con el scroll salvo con reduced-motion", () => {
    const mosaico = renderizar([escena["mosaico-3"]], { assets: assetsEscena.map(conFoto) });
    expect(mosaico.container.querySelectorAll("figure")).toHaveLength(3);
    expect(mosaico.container.querySelectorAll("[data-credito]")).toHaveLength(3);
    mosaico.unmount();
    const banda = renderizar([escena["banda-a-sangre"]], { assets: assetsEscena.map(conFoto) });
    expect(banda.container.querySelector("[data-parallax]")).not.toBeNull();
    banda.unmount();
    const restaurar = simularMedia({ reducir: true });
    const quieta = renderizar([escena["banda-a-sangre"]], { assets: assetsEscena.map(conFoto) });
    expect((quieta.container.querySelector("[data-parallax]") as HTMLElement).style.transform).toBe("translateY(0px)");
    restaurar();
  });

  it("resumen: la tarjeta final lleva la lista de lo que recibe y el cierre", () => {
    const { container } = renderizar([resumen["tarjeta-final"]]);
    expect(container.querySelectorAll("li")).toHaveLength(5);
    expect(container.textContent).toContain("Pídelo hoy");
  });
});

describe("variantes con imagen de las secciones existentes", () => {
  it("beneficios «imagen alterna» pone una foto por beneficio y alterna el lado", () => {
    const { container } = renderizar([VARIANTES_CON_IMAGEN.beneficios["imagen-alterna"]], { assets: ASSETS_DE_VARIANTES_CON_IMAGEN.map(conFoto) });
    const filas = container.querySelectorAll("[data-fila-imagen]");
    expect(filas).toHaveLength(3);
    expect(container.querySelectorAll("img")).toHaveLength(3);
    expect(filas[1].firstElementChild?.className).toContain("md:order-2");
    expect(filas[0].firstElementChild?.className).not.toContain("md:order-2");
  });

  it("garantía, oferta, FAQ y cómo funciona: la variante con imagen suma la foto y la estándar no", () => {
    const assets = ASSETS_DE_VARIANTES_CON_IMAGEN.map(conFoto);
    const casos: [string, Seccion | null, Seccion][] = [
      ["como-funciona", null, VARIANTES_CON_IMAGEN["como-funciona"]["pasos-con-imagen"]],
      ["garantia", VARIANTES_CON_IMAGEN.garantia.estandar, VARIANTES_CON_IMAGEN.garantia["con-imagen"]],
      ["oferta", VARIANTES_CON_IMAGEN.oferta.estandar, VARIANTES_CON_IMAGEN.oferta["con-imagen"]],
      ["faq", VARIANTES_CON_IMAGEN.faq.estandar, VARIANTES_CON_IMAGEN.faq["con-imagen"]],
    ];
    for (const [tipo, estandar, conImagen] of casos) {
      if (estandar) {
        expect(renderizar([estandar], { assets }).container.querySelector("[data-con-imagen]"), `${tipo} estándar`).toBeNull();
        cleanup();
      }
      const r = renderizar([conImagen], { assets });
      expect(r.container.querySelector("[data-con-imagen='lado'] img"), `${tipo} con imagen`).not.toBeNull();
      cleanup();
    }
  });

  it("incluye «fondo de banco» usa la foto de fondo con velo", () => {
    const { container } = renderizar([VARIANTES_CON_IMAGEN.incluye["fondo-banco"]], { assets: ASSETS_DE_VARIANTES_CON_IMAGEN.map(conFoto) });
    expect(container.querySelector("[data-con-imagen='fondo'] [data-velo]")).not.toBeNull();
    expect(container.querySelectorAll("img")).toHaveLength(1);
  });

  it("todas se ofrecen como variantes en el editor", () => {
    for (const tipo of ["beneficios", "como-funciona", "garantia", "oferta", "faq", "incluye", "para-quien", "mecanismo", "historia", "resumen", "escena-uso"] as const) {
      expect(tieneVariantes(tipo), tipo).toBe(true);
    }
    expect(variantesDe("galeria").map((v) => v.clave)).toContain("carrusel-deslizante");
  });
});

describe("galería «carrusel deslizante»", () => {
  it("tiene scroll-snap, una miniatura por foto y las miniaturas mueven el carrusel", () => {
    const assets = ["galeria-1", "galeria-2", "galeria-3", "galeria-4"].map((slot, i) => conFoto({ slot, tipo: "imagen", relacion: "4:5", promptGrok: "", alt: "x" }, i));
    const { container } = renderizar([galeria["carrusel-deslizante"]], { assets });
    const pista = container.querySelector("[data-carrusel-deslizante] ul") as HTMLElement & { scrollTo: unknown };
    expect(pista.className).toContain("snap-x");
    const miniaturas = screen.getAllByRole("button", { name: /Ver la imagen/ });
    expect(miniaturas).toHaveLength(4);
    expect(miniaturas[0].getAttribute("aria-current")).toBe("true");
    const desplazar = vi.fn();
    pista.scrollTo = desplazar;
    fireEvent.click(miniaturas[2]);
    expect(miniaturas[2].getAttribute("aria-current")).toBe("true");
    expect(desplazar).toHaveBeenCalled();
  });
});

describe("ritmo de fondos", () => {
  it("alterna el fondo suave entre las secciones de cuerpo y no toca héroe ni formulario", () => {
    const ids = idsConFondoSuave(landingEjemplo.secciones);
    const tipos = landingEjemplo.secciones.filter((s) => ids.has(s.id)).map((s) => s.tipo);
    expect(tipos.length).toBeGreaterThan(0);
    expect(tipos).not.toContain("heroe");
    expect(tipos).not.toContain("formulario-lead");
  });

  it("el render lo aplica y pone una transición de color junto a una sección de fondo acento", () => {
    const base = landingEjemplo.secciones[3];
    const acento: Seccion = { ...base, ajustes: { ...base.ajustes, presentacion: { fondo: "acento" } } };
    const secciones = [landingEjemplo.secciones[0], landingEjemplo.secciones[1], acento, landingEjemplo.secciones[4], landingEjemplo.secciones[5]];
    const { container } = renderizar(secciones);
    expect(container.querySelectorAll("[data-divisor]").length).toBeGreaterThanOrEqual(2);
    expect(container.innerHTML).not.toMatch(/(?:color|background)[^;">]*#[0-9a-f]{3,8}/i);
  });
});
