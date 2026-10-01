// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { Seccion, TIPOS_SECCION, VARIANTES_HEROE } from "@/lib/contratos";
import { registro } from "@/secciones/registro";
import { ejemplos as ejemplosBeneficios } from "@/secciones/beneficios/ejemplo";
import { ejemplo as ejemploFaq } from "@/secciones/faq/ejemplo";
import { ejemplos as ejemplosHeroe } from "@/secciones/heroe/ejemplo";
import { EJEMPLOS } from "./catalogo-ejemplos";
import { renderizar } from "./ayudas";

afterEach(cleanup);

const TIPOS_CON_CONTENIDO_PROPIO: string[] = ["dato-en-vivo", "creditos", "cta-fija"];

describe("registro", () => {
  it("registra las secciones con etiqueta, icono y maxPorLanding", () => {
    for (const tipo of TIPOS_SECCION) {
      const definicion = registro[tipo];
      expect(definicion, tipo).toBeDefined();
      expect(definicion!.etiqueta.length).toBeGreaterThan(0);
      expect(definicion!.icono.length).toBeGreaterThan(0);
      expect(definicion!.maxPorLanding).toBeGreaterThanOrEqual(1);
    }
    expect(Object.keys(registro)).toHaveLength(33); // 18 + 6 de la 12-B + 5 de la 14-B
  });

  it("heroe, faq y formulario-lead se permiten una sola vez", () => {
    expect(registro.heroe!.maxPorLanding).toBe(1);
    expect(registro.faq!.maxPorLanding).toBe(1);
    expect(registro["formulario-lead"]!.maxPorLanding).toBe(1);
  });

  it("hay al menos un ejemplo por tipo", () => {
    for (const tipo of TIPOS_SECCION) {
      expect(EJEMPLOS.some((ejemplo) => ejemplo.tipo === tipo), tipo).toBe(true);
    }
  });
});

describe.each(EJEMPLOS)("ejemplo $tipo · $nombre", ({ tipo, seccion }) => {
  it("cumple el contrato de Seccion y el schema de su tipo", () => {
    expect(Seccion.safeParse(seccion).success).toBe(true);
    const { schema } = registro[tipo]!;
    const resultado = schema.safeParse({ ajustes: seccion.ajustes, bloques: seccion.bloques });
    expect(resultado.success, JSON.stringify(resultado.error?.issues)).toBe(true);
  });

  it("se renderiza con su Componente", () => {
    const { container } = renderizar([seccion]);
    expect(container.querySelector(`[data-tipo="${tipo}"]`)).not.toBeNull();
    expect(container.textContent).not.toContain("no cumplen su esquema");
    expect(container.textContent).not.toContain("sin registrar");
    // El widget en vivo se oculta sin datos, los créditos salen de los Asset y la barra fija es corta: se prueban en secciones-12b.
    if (!TIPOS_CON_CONTENIDO_PROPIO.includes(tipo)) expect(container.textContent?.length).toBeGreaterThan(40);
  });
});

describe("heroe", () => {
  it("hay un ejemplo por cada una de las 8 variantes aprobadas", () => {
    expect(Object.keys(ejemplosHeroe).sort()).toEqual([...VARIANTES_HEROE].sort());
  });

  it.each(Object.entries(ejemplosHeroe))("«%s» tiene un solo h1 con su titular", (_, seccion) => {
    const { container } = renderizar([seccion]);
    const h1 = container.querySelectorAll("h1");
    expect(h1).toHaveLength(1);
    expect(h1[0].textContent).toBe(seccion.ajustes.titular);
  });

  // El mosaico usa una rejilla solo para las imágenes (el titular es una franja de ancho completo) y
  // el comparador sin archivos pone dos marcadores en fila; en ambos el h1 no comparte fila con la imagen.
  const EXCLUIDAS_DE_LA_REGLA_DE_COLUMNAS = ["mosaico-editorial", "antes-despues-heroe"];
  it.each(Object.entries(ejemplosHeroe).filter(([variante]) => !EXCLUIDAS_DE_LA_REGLA_DE_COLUMNAS.includes(variante)))(
    "«%s» no pone contenido en filas ni en rejillas de columnas",
    (_, seccion) => {
      const { container } = renderizar([seccion]);
      expect(container.innerHTML).not.toMatch(/(?:^|[\s"])(?:\w+:)?(?:flex-row|grid-cols-[2-9])(?=[\s"])/);
    },
  );

  it("problema-primero no pinta imagen ni marcador", () => {
    const { container } = renderizar([ejemplosHeroe["problema-primero"]]);
    expect(container.querySelector("[data-marcador-slot], img")).toBeNull();
  });

  it("las variantes con producto muestran el marcador del slot", () => {
    for (const variante of ["producto-monumental", "titular-tipografico", "orbita-beneficios"] as const) {
      const { container, unmount } = renderizar([ejemplosHeroe[variante]]);
      expect(container.querySelector('[data-marcador-slot="heroe-producto"]')).not.toBeNull();
      unmount();
    }
  });

  it("poster-a-sangre superpone el texto sobre la imagen a sangre", () => {
    const { container } = renderizar([ejemplosHeroe["poster-a-sangre"]]);
    expect(container.querySelector('[data-marcador-slot="heroe-poster"]')).not.toBeNull();
    expect(container.querySelector("section")?.className).toContain("relative");
  });

  it("antes-despues-heroe apila el titular y los dos marcadores mientras falten los archivos", () => {
    const { container } = renderizar([ejemplosHeroe["antes-despues-heroe"]], { onBuscarBancos: () => {} });
    expect(container.querySelector('[role="slider"]')).toBeNull();
    expect(screen.getAllByRole("button", { name: /buscar en bancos/i })).toHaveLength(2);
    expect(container.querySelector('[data-marcador-slot="heroe-antes"]')).not.toBeNull();
    expect(container.querySelector('[data-marcador-slot="heroe-despues"]')).not.toBeNull();
  });

  it("video-inmersivo usa un marcador de video sin archivo", () => {
    const { container } = renderizar([ejemplosHeroe["video-inmersivo"]]);
    expect(container.textContent).toContain("Video pendiente");
  });

  it("orbita-beneficios muestra los beneficios en lista y rodeando el producto", () => {
    const { container } = renderizar([ejemplosHeroe["orbita-beneficios"]]);
    const items = container.querySelectorAll("ul li");
    expect(items).toHaveLength(3);
    expect(container.innerHTML).toContain("md:absolute");
  });

  it("mosaico-editorial pinta el collage y una franja de titular que lo cruza", () => {
    const { container } = renderizar([ejemplosHeroe["mosaico-editorial"]]);
    expect(container.querySelectorAll("[data-marcador-slot]")).toHaveLength(4);
    const franja = container.querySelector("h1")?.parentElement;
    expect(franja?.className).toContain("absolute");
    expect(franja?.className).toContain("top-1/2");
  });
});

describe("beneficios", () => {
  it.each(Object.entries(ejemplosBeneficios))("«%s» muestra los 3 beneficios", (_, seccion) => {
    const { container } = renderizar([seccion]);
    expect(container.querySelectorAll("h3")).toHaveLength(3);
  });
});

describe("faq", () => {
  it("usa un <details> por pregunta", () => {
    const { container } = renderizar([ejemploFaq]);
    expect(container.querySelectorAll("details")).toHaveLength(ejemploFaq.bloques.length);
    expect(container.querySelectorAll("details > summary")).toHaveLength(ejemploFaq.bloques.length);
  });
});

describe("registro de tipos", () => {
  it("un tipo sin registrar no rompe el render", () => {
    const sinRegistrar: Seccion = { ...ejemploFaq, id: "x", tipo: "galeria", ajustes: {}, bloques: [] };
    const { container } = renderizar([sinRegistrar, ejemploFaq]);
    expect(container.querySelector('[data-tipo="faq"]')).not.toBeNull();
    expect(container.textContent).toContain("Los ajustes de la sección «galeria» no cumplen su esquema");
  });

  it("un tipo desconocido no rompe el render y avisa en desarrollo", () => {
    const desconocida = { ...ejemploFaq, id: "y", tipo: "inventada" } as unknown as Seccion;
    const { container } = renderizar([desconocida, ejemploFaq]);
    expect(container.querySelector('[data-tipo="faq"]')).not.toBeNull();
    expect(container.textContent).toContain("sin registrar");
  });

  it("las secciones ocultas no se pintan", () => {
    const { container } = renderizar([{ ...ejemploFaq, visible: false }]);
    expect(container.querySelector('[data-tipo="faq"]')).toBeNull();
  });
});
