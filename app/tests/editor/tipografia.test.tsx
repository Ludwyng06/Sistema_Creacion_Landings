// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { LandingRender } from "@/componentes/LandingRender";
import { PanelTema } from "@/componentes/editor/PanelTema";
import { FRASE_PRUEBA } from "@/componentes/editor/SelectorTipografia";
import { CATALOGO, filtrarFuentes, paresSugeridos } from "@/componentes/fuentes/catalogo";
import { urlFuentes } from "@/lib/fuentes/url";
import { EJEMPLOS } from "@/datos/ejemplos";
import type { LandingDoc } from "@/lib/contratos";
import { landingEjemplo } from "../fixtures/landing-ejemplo";

afterEach(() => {
  cleanup();
  document.head.querySelectorAll("link[data-fuente-previa]").forEach((l) => l.remove());
});

const conFuentes = (titulos: string, cuerpo: string): LandingDoc => ({
  ...landingEjemplo,
  tokens: { ...landingEjemplo.tokens, tipografia: { ...landingEjemplo.tokens.tipografia, titulos, cuerpo } },
});

describe("catálogo y pares", () => {
  it("el catálogo real trae las 200 familias con la forma de fuentes.json", () => {
    expect(CATALOGO).toHaveLength(200);
    for (const f of CATALOGO) {
      expect(Object.keys(f).sort()).toEqual(["categoria", "cursiva", "familia", "latinExt", "pesos", "popularidad", "usoSugerido", "variable"]);
    }
  });

  it("busca por nombre sin distinguir mayúsculas ni tildes y filtra por categoría", () => {
    expect(filtrarFuentes(CATALOGO, "PLAYFAIR", "todas").map((f) => f.familia)).toEqual(["Playfair Display", "Playfair"]);
    expect(filtrarFuentes(CATALOGO, "", "monospace")).toHaveLength(15);
    expect(filtrarFuentes(CATALOGO, "", "monospace").every((f) => f.categoria === "monospace")).toBe(true);
    expect(filtrarFuentes(CATALOGO, "zzz", "todas")).toEqual([]);
    const ordenadas = filtrarFuentes(CATALOGO, "", "todas").map((f) => f.popularidad);
    expect(ordenadas).toEqual([...ordenadas].sort((a, b) => a - b));
  });

  it("ofrece de 6 a 8 pares: los de la semilla y algunos curados del catálogo", () => {
    const pares = paresSugeridos();
    expect(pares.length).toBeGreaterThanOrEqual(6);
    expect(pares.length).toBeLessThanOrEqual(8);
    expect(pares.some((p) => p.origen === "semilla")).toBe(true);
    expect(pares.some((p) => p.origen === "catalogo")).toBe(true);
    // Todas las familias existen en el catálogo (DM Serif Display e Instrument Serif se cambian por su equivalente).
    for (const p of pares) for (const familia of [p.titulos, p.cuerpo]) expect(CATALOGO.some((x) => x.familia === familia)).toBe(true);
    expect(pares.map((p) => p.titulos)).toContain("Playfair Display");
    expect(pares.map((p) => p.titulos)).toContain("Cormorant Garamond");
  });
});

describe("urlFuentes y la landing pública", () => {
  it("pide solo las 2 familias del doc, con pesos y display=swap", () => {
    const url = urlFuentes({ tipografia: { titulos: "Playfair Display", cuerpo: "Source Sans 3", escala: "normal" } })!;
    expect(url.startsWith("https://fonts.googleapis.com/css2?")).toBe(true);
    expect(url.match(/family=/g)).toHaveLength(2);
    expect(url).toContain("family=Playfair+Display:wght@400;600;700");
    expect(url).toContain("family=Source+Sans+3:wght@400;500;600;700");
    expect(url).toContain("display=swap");
  });

  it("no repite una familia cuando títulos y cuerpo son la misma", () => {
    expect(urlFuentes({ tipografia: { titulos: "Lora", cuerpo: "Lora", escala: "normal" } }).match(/family=/g)).toHaveLength(1);
  });

  it("LandingRender carga solo 2 familias, con preconnect", () => {
    const html = renderToStaticMarkup(<LandingRender doc={conFuentes("Playfair Display", "Lato")} urlFuentes={urlFuentes({ tipografia: { titulos: "Playfair Display", cuerpo: "Lato", escala: "normal" } })} />);
    const enlaces = [...html.matchAll(/<link[^>]*>/g)].map((m) => m[0]);
    const hojas = enlaces.filter((l) => l.includes("fonts.googleapis.com/css2")).map((l) => /href="([^"]+)"/.exec(l)![1]);
    // La misma hoja va también dentro de <noscript>: una sola URL distinta.
    expect(new Set(hojas).size).toBe(1);
    expect(html).toContain("media=\"print\"");
    expect(hojas[0].match(/family=/g)).toHaveLength(2);
    expect(enlaces.some((l) => l.includes('rel="preconnect"') && l.includes("fonts.gstatic.com"))).toBe(true);
  });
});

describe("selector de tipografía del panel Tema", () => {
  const brief = EJEMPLOS[0].brief;
  function montar(doc: LandingDoc = landingEjemplo) {
    const onAccion = vi.fn();
    render(<PanelTema doc={doc} brief={brief} onAccion={onAccion} />);
    return onAccion;
  }
  const selector = (rol: string) => document.querySelector<HTMLElement>(`[data-selector-tipografia='${rol}']`)!;
  const abrir = (rol: string) => fireEvent.click(within(selector(rol)).getByRole("button", { name: /Cambiar/ }));

  it("hay un selector para Títulos y otro para Cuerpo con la familia actual", () => {
    montar();
    expect(selector("titulos").textContent).toContain("Space Grotesk");
    expect(selector("cuerpo").textContent).toContain("IBM Plex Sans");
  });

  it("muestra la vista previa con el titular real y la frase con ñ, ¿¡ y tildes", () => {
    montar();
    abrir("titulos");
    const vista = selector("titulos").querySelector("[data-vista-tipografia]")!;
    expect(vista.textContent).toContain("¿Terminas el día con la espalda cargada?");
    expect(vista.textContent).toContain(FRASE_PRUEBA);
    expect(FRASE_PRUEBA).toMatch(/ñ/i);
    expect(FRASE_PRUEBA).toMatch(/¿/);
    expect(FRASE_PRUEBA).toMatch(/¡/);
    expect(FRASE_PRUEBA).toMatch(/[áéíóú]/);
  });

  it("busca y filtra por categoría", () => {
    montar();
    abrir("cuerpo");
    const s = selector("cuerpo");
    fireEvent.change(within(s).getByLabelText("Buscar por nombre"), { target: { value: "lora" } });
    expect(s.querySelectorAll("[data-fuente]")).toHaveLength(1);
    expect(s.querySelector("[data-fuente='Lora']")).not.toBeNull();
    fireEvent.change(within(s).getByLabelText("Buscar por nombre"), { target: { value: "" } });
    fireEvent.click(within(s).getByRole("button", { name: "Monoespaciada" }));
    expect(s.querySelectorAll("[data-fuente]")).toHaveLength(15);
    fireEvent.change(within(s).getByLabelText("Buscar por nombre"), { target: { value: "zzz" } });
    expect(within(s).getByText(/Ninguna tipografía coincide/)).toBeTruthy();
  });

  it("pide la fuente solo al pasar por encima o al elegirla, y la vista previa la muestra", () => {
    montar();
    abrir("titulos");
    const s = selector("titulos");
    expect(document.head.querySelector("link[data-fuente-previa='Lora']")).toBeNull();
    fireEvent.pointerEnter(s.querySelector("[data-fuente='Lora']")!);
    expect(document.head.querySelectorAll("link[data-fuente-previa='Lora']")).toHaveLength(1);
    expect(s.querySelector("[data-vista-familia]")!.textContent).toBe("Lora");
    fireEvent.pointerEnter(s.querySelector("[data-fuente='Lora']")!);
    expect(document.head.querySelectorAll("link[data-fuente-previa='Lora']")).toHaveLength(1);
    expect(document.head.querySelector("link[data-fuente-previa='Pacifico']")).toBeNull();
  });

  it("al elegir una familia edita solo ese token", () => {
    const onAccion = montar();
    abrir("titulos");
    fireEvent.click(selector("titulos").querySelector("[data-fuente='Playfair Display']")!);
    const accion = onAccion.mock.calls.at(-1)![0];
    expect(accion.tipo).toBe("editar-tokens");
    expect(accion.tokens.tipografia.titulos).toBe("Playfair Display");
    expect(accion.tokens.tipografia.cuerpo).toBe("IBM Plex Sans");
    expect(accion.clave).toBe("tipografia-titulos");
  });

  it("aplica un par sugerido con un clic", () => {
    const onAccion = montar();
    fireEvent.change(screen.getByLabelText("Pares sugeridos"), { target: { value: paresSugeridos().find((p) => p.origen === "catalogo")!.id } });
    const t = onAccion.mock.calls.at(-1)![0].tokens.tipografia;
    expect([t.titulos, t.cuerpo]).toEqual(["Libre Baskerville", "Source Sans 3"]);
  });

  it("«Volver a la tipografía de la semilla» está apagado en la de la semilla y la restaura si se cambió", () => {
    montar();
    expect((document.querySelector("[data-volver-semilla]") as HTMLButtonElement).disabled).toBe(true);
    cleanup();
    const onAccion = montar(conFuentes("Lora", "Lato"));
    const volver = screen.getByRole("button", { name: "Volver a la tipografía de la semilla" }) as HTMLButtonElement;
    expect(volver.disabled).toBe(false);
    fireEvent.click(volver);
    const t = onAccion.mock.calls.at(-1)![0].tokens.tipografia;
    expect([t.titulos, t.cuerpo]).toEqual(["Space Grotesk", "IBM Plex Sans"]);
  });
});
