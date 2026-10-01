// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AccionesDetalle } from "@/componentes/banco/AccionesDetalle";
import { EstadoVacio, Galeria } from "@/componentes/banco/Galeria";
import { Versiones } from "@/componentes/banco/Versiones";
import { VistaDividida } from "@/componentes/banco/VistaDividida";
import type { TarjetaBanco } from "@/lib/banco";

const empujar = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: empujar, refresh: () => {} }) }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  empujar.mockClear();
});

function tarjeta(id: string, extra: Partial<TarjetaBanco> = {}): TarjetaBanco {
  return {
    id,
    slug: id,
    nombre: `Landing ${id}`,
    producto: `Producto ${id}`,
    proveedor: "gemini",
    creadoEn: "2026-09-29T12:00:00.000Z",
    tecnicas: ["semilla"],
    puntaje: 8,
    intensidad: 3,
    miniatura: null,
    imagenHeroe: null,
    tematica: "producto",
    secciones: 12,
    fuentes: [],
    favorita: false,
    resumen: { rol: `rol de ${id}`, tarea: `tarea de ${id}`, contexto: `contexto de ${id}`, formato: `formato de ${id}` },
    ...extra,
  };
}

const BANCO = [
  tarjeta("colageno", { nombre: "Colágeno hidrolizado", producto: "Colágeno", tecnicas: ["semilla", "ambicioso"], intensidad: 2, puntaje: 8.1 }),
  tarjeta("timbre", { nombre: "Timbre con cámara", producto: "Timbre", proveedor: "openrouter", tecnicas: ["video"], puntaje: 6.5, creadoEn: "2026-09-29T13:00:00.000Z" }),
  tarjeta("llavero", { nombre: "Llavero 3 en 1", producto: "Llavero", puntaje: null, miniatura: "/media/llavero/miniatura.webp", creadoEn: "2026-09-29T14:00:00.000Z" }),
];

const visibles = () => Array.from(document.querySelectorAll("[data-tarjeta]"));

describe("Galeria", () => {
  it("muestra una tarjeta por landing con miniatura, producto, proveedor, técnicas y puntaje", () => {
    render(<Galeria tarjetas={BANCO} />);
    expect(visibles()).toHaveLength(3);
    const llavero = document.querySelector('[data-id="llavero"]') as HTMLElement;
    expect((within(llavero).getByAltText("Vista previa de Llavero 3 en 1")).getAttribute("src")).toBe("/media/llavero/miniatura.webp");
    expect(within(llavero).getByText("Sin crítico")).toBeTruthy();
    const colageno = document.querySelector('[data-id="colageno"]') as HTMLElement;
    expect(within(colageno).getByText("Crítico 8,1/10")).toBeTruthy();
    expect(within(colageno).getByText("Colágeno")).toBeTruthy();
    expect(within(colageno).getAllByText(/Semilla|Prompt ambicioso/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Mostrando 3 de 3 landings")).toBeTruthy();
    // la más reciente primero
    expect((visibles()[0]).getAttribute("data-id")).toBe("llavero");
  });

  it("filtra por técnica, proveedor e intensidad y por búsqueda sin tildes; se pueden limpiar", () => {
    render(<Galeria tarjetas={BANCO} />);
    fireEvent.change(screen.getByLabelText("Técnica"), { target: { value: "video" } });
    expect(visibles().map((l) => l.getAttribute("data-id"))).toEqual(["timbre"]);
    expect(screen.getByText("Mostrando 1 de 3 landings")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect(visibles()).toHaveLength(3);

    fireEvent.change(screen.getByLabelText("Proveedor"), { target: { value: "gemini" } });
    expect(visibles()).toHaveLength(2);
    fireEvent.change(screen.getByLabelText("Intensidad"), { target: { value: "2" } });
    expect(visibles().map((l) => l.getAttribute("data-id"))).toEqual(["colageno"]);

    fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    fireEvent.change(screen.getByLabelText("Buscar"), { target: { value: "colageno" } });
    expect(visibles().map((l) => l.getAttribute("data-id"))).toEqual(["colageno"]);
  });

  it("sin coincidencias lo dice y ofrece limpiar", () => {
    render(<Galeria tarjetas={BANCO} />);
    fireEvent.change(screen.getByLabelText("Buscar"), { target: { value: "zzz" } });
    expect(screen.getByText(/Ninguna landing coincide/)).toBeTruthy();
    expect(visibles()).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect(visibles()).toHaveLength(3);
  });

  it("solo ofrece las técnicas y proveedores que hay en el banco", () => {
    render(<Galeria tarjetas={BANCO} />);
    const tecnicas = within(screen.getByLabelText("Técnica")).getAllByRole("option").map((o) => o.textContent);
    expect(tecnicas).toHaveLength(1 + 3); // Todas + semilla, ambicioso, video
    const proveedores = within(screen.getByLabelText("Proveedor")).getAllByRole("option").map((o) => o.textContent);
    expect(proveedores).toEqual(["Todos", "gemini", "openrouter"]);
  });

  it("una tarjeta se voltea con clic o Enter y muestra el prompt de 4 bloques; «Volver» la regresa", () => {
    render(<Galeria tarjetas={BANCO} />);
    const t = document.querySelector('[data-id="timbre"]') as HTMLElement;
    expect((t).getAttribute("data-volteada")).toBe("false");
    const frente = within(t).getByRole("article", { name: "Timbre con cámara: landing", hidden: true });
    const reverso = within(t).getByRole("article", { name: "Timbre con cámara: prompt", hidden: true });
    expect((reverso).hasAttribute("inert")).toBe(true);
    expect((frente).hasAttribute("inert")).toBe(false);

    // Enter sobre un botón nativo dispara el clic: aquí se comprueba con ambos.
    const boton = within(t).getByRole("button", { name: /^Ver el prompt de\s*Timbre con cámara/ });
    expect(boton.tagName).toBe("BUTTON");
    fireEvent.click(boton);
    expect((t).getAttribute("data-volteada")).toBe("true");
    expect((frente).hasAttribute("inert")).toBe(true);
    expect((reverso).hasAttribute("inert")).toBe(false);
    for (const b of ["rol", "tarea", "contexto", "formato"]) expect(within(reverso).getByText(`${b} de timbre`)).toBeTruthy();
    expect(reverso.querySelectorAll("[data-bloque]")).toHaveLength(4);
    expect((within(reverso).getByRole("link", { name: "Abrir" })).getAttribute("href")).toBe("/banco/timbre");

    fireEvent.click(within(reverso).getByRole("button", { name: "Volver" }));
    expect((t).getAttribute("data-volteada")).toBe("false");
  });

  it("con prefers-reduced-motion el giro se cambia por un fundido (clases motion-reduce)", () => {
    render(<Galeria tarjetas={[BANCO[0]]} />);
    const t = document.querySelector("[data-tarjeta]") as HTMLElement;
    const giro = t.firstElementChild as HTMLElement;
    expect(giro.className).toContain("motion-reduce:[transform:none]");
    expect(giro.className).toContain("motion-reduce:transition-none");
    const [frente, reverso] = Array.from(giro.children) as HTMLElement[];
    expect(frente.className).toContain("motion-reduce:transition-opacity");
    expect(reverso.className).toContain("motion-reduce:opacity-0"); // sin voltear, el reverso se desvanece
    expect(reverso.className).toContain("motion-reduce:[transform:none]");
    fireEvent.click(within(t).getByRole("button", { name: /Ver el prompt/ }));
    expect(frente.className).toContain("motion-reduce:opacity-0"); // volteada, el frente se desvanece
    expect(reverso.className).not.toContain("motion-reduce:opacity-0");
  });
});

describe("estado vacío", () => {
  it("sin landings explica cómo sembrar el banco y enlaza a /crear", () => {
    render(<Galeria tarjetas={[]} />);
    expect(screen.getByRole("heading", { name: "El banco está vacío" })).toBeTruthy();
    expect((screen.getByRole("link", { name: "Crear mi primera landing" })).getAttribute("href")).toBe("/crear");
    expect(screen.getAllByText(/npm run db:semilla/).length).toBeGreaterThan(0);
    expect(screen.queryByRole("search")).toBeNull();
  });

  it("EstadoVacio se puede usar solo", () => {
    render(<EstadoVacio />);
    expect(screen.getByText(/--desde-json/)).toBeTruthy();
  });
});

describe("VistaDividida", () => {
  it("en móvil son dos pestañas que muestran un panel a la vez y se mueven con las flechas", () => {
    render(<VistaDividida landing={<p>LANDING</p>} prompt={<p>PROMPT</p>} />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["Landing", "Prompt"]);
    const panel = (n: string) => document.querySelector(`[data-panel="${n}"]`) as HTMLElement;
    expect((tabs[0]).getAttribute("aria-selected")).toBe("true");
    expect(panel("landing").className).toContain("block");
    expect(panel("prompt").className).toContain("hidden");
    // en escritorio los dos paneles son visibles a la vez
    expect(panel("prompt").className).toContain("lg:block");

    fireEvent.click(tabs[1]);
    expect((tabs[1]).getAttribute("aria-selected")).toBe("true");
    expect(panel("prompt").className).toMatch(/(^| )block/);
    expect(panel("landing").className).toContain("hidden");

    fireEvent.keyDown(tabs[1], { key: "ArrowLeft" });
    expect((tabs[0]).getAttribute("aria-selected")).toBe("true");
  });
});

describe("Versiones", () => {
  const versiones = [
    { id: "v2", landingId: "l1", nota: "Antes de restaurar", creadoEn: "2026-09-29T15:00:00.000Z" },
    { id: "v1", landingId: "l1", nota: "Generada por IA", creadoEn: "2026-09-29T12:00:00.000Z" },
  ];

  it("lista las versiones y «Restaurar» llama a la API de esa versión", async () => {
    const recargar = vi.fn();
    const original = window.location;
    Object.defineProperty(window, "location", { value: { ...original, reload: recargar }, configurable: true });
    const fetchSim = vi.fn(async () => new Response(JSON.stringify({ id: "l1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchSim);

    render(<Versiones landingId="l1" versiones={versiones} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText(/la más reciente/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Restaurar la versión «Generada por IA»/ }));
    await waitFor(() => expect(recargar).toHaveBeenCalled());
    expect(fetchSim).toHaveBeenCalledWith("/api/landings/l1/versiones/v1/restaurar", { method: "POST" });
    Object.defineProperty(window, "location", { value: original, configurable: true });
  });

  it("si la API falla muestra el error y no recarga", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "No existe la versión." }), { status: 404 })));
    render(<Versiones landingId="l1" versiones={versiones} />);
    fireEvent.click(screen.getAllByRole("button", { name: /Restaurar/ })[0]);
    expect((await screen.findByRole("alert")).textContent).toContain("No existe la versión.");
  });

  it("sin versiones lo dice", () => {
    render(<Versiones landingId="l1" versiones={[]} />);
    expect(screen.getByText("Todavía no hay versiones guardadas.")).toBeTruthy();
  });
});

describe("AccionesDetalle", () => {
  it("enlaza al editor y «Duplicar como nueva» abre la copia en el editor", async () => {
    const fetchSim = vi.fn(async () => new Response(JSON.stringify({ id: "copia1" }), { status: 201 }));
    vi.stubGlobal("fetch", fetchSim);
    render(<AccionesDetalle id="l1" />);
    expect((screen.getByRole("link", { name: "Abrir en el editor" })).getAttribute("href")).toBe("/editor/l1");
    fireEvent.click(screen.getByRole("button", { name: "Duplicar como nueva" }));
    await waitFor(() => expect(empujar).toHaveBeenCalledWith("/editor/copia1"));
    expect(fetchSim).toHaveBeenCalledWith("/api/landings/l1/duplicar", { method: "POST" });
  });

  it("si duplicar falla muestra el error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "No existe la landing." }), { status: 404 })));
    render(<AccionesDetalle id="l1" />);
    fireEvent.click(screen.getByRole("button", { name: "Duplicar como nueva" }));
    expect((await screen.findByRole("alert")).textContent).toContain("No existe la landing.");
    expect(empujar).not.toHaveBeenCalled();
  });
});

describe("Galeria · vitrina (12-B)", () => {
  const VITRINA = [
    tarjeta("proyector", { nombre: "Proyector de galaxias", tematica: "espacio", secciones: 14, fuentes: ["NASA", "NOAA"], puntaje: 8.4, imagenHeroe: "/media/vitrina/proyector/heroe.webp", miniatura: "/media/vitrina/proyector/captura.png" }),
    tarjeta("serum", { nombre: "Sérum de vitamina C", tematica: "producto", secciones: 12, fuentes: ["Open Beauty Facts", "Wikimedia"], creadoEn: "2026-09-29T13:00:00.000Z" }),
  ];

  it("cada tarjeta muestra la temática, el número de secciones, el puntaje y las fuentes", () => {
    render(<Galeria tarjetas={VITRINA} />);
    const proyector = document.querySelector('[data-id="proyector"]') as HTMLElement;
    expect(proyector.querySelector("[data-tematica]")?.textContent).toBe("Espacio");
    expect(proyector.querySelector("[data-secciones]")?.textContent).toBe("14 secciones");
    expect(proyector.querySelector("[data-fuentes]")?.textContent).toBe("Fuentes: NASA · NOAA");
    expect(within(proyector).getByText("Crítico 8,4/10")).toBeTruthy();
    const serum = document.querySelector('[data-id="serum"]') as HTMLElement;
    expect(serum.querySelector("[data-tematica]")?.textContent).toBe("Producto");
    expect(serum.querySelector("[data-fuentes]")?.textContent).toBe("Fuentes: Open Beauty Facts · Wikimedia");
  });

  it("el filtro «Temática» ofrece Espacio y Producto y filtra", () => {
    render(<Galeria tarjetas={VITRINA} />);
    const opciones = within(screen.getByLabelText("Temática")).getAllByRole("option").map((o) => o.textContent);
    expect(opciones).toEqual(["Todas", "Espacio", "Producto"]);
    fireEvent.change(screen.getByLabelText("Temática"), { target: { value: "espacio" } });
    expect(visibles().map((l) => l.getAttribute("data-id"))).toEqual(["proyector"]);
    fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect(visibles()).toHaveLength(2);
  });

  it("la miniatura es la captura; si no carga, cae a la imagen del héroe", () => {
    render(<Galeria tarjetas={VITRINA} />);
    const proyector = document.querySelector('[data-id="proyector"]') as HTMLElement;
    const captura = within(proyector).getByAltText("Vista previa de Proyector de galaxias");
    expect(captura.getAttribute("src")).toBe("/media/vitrina/proyector/captura.png");
    expect(captura.getAttribute("data-miniatura")).toBe("captura");
    fireEvent.error(captura);
    const heroe = within(proyector).getByAltText("Vista previa de Proyector de galaxias");
    expect(heroe.getAttribute("src")).toBe("/media/vitrina/proyector/heroe.webp");
    expect(heroe.getAttribute("data-miniatura")).toBe("heroe");
    fireEvent.error(heroe);
    expect(within(proyector).queryByAltText("Vista previa de Proyector de galaxias")).toBeNull();
    expect(within(proyector).getByText(/Vista previa pendiente/)).toBeTruthy();
  });

  it("cada tarjeta enlaza al visor a pantalla completa", () => {
    render(<Galeria tarjetas={VITRINA} />);
    const proyector = document.querySelector('[data-id="proyector"]') as HTMLElement;
    expect(within(proyector).getAllByRole("link", { name: "Ver Proyector de galaxias en pantalla completa", hidden: true })[0].getAttribute("href")).toBe("/ver/proyector");
  });
});
