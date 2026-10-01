// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Visor } from "@/componentes/banco/Visor";
import { dispositivoDe, escalaParaCaber, vecino, type ItemVisor } from "@/lib/visor";

function item(id: string, extra: Partial<ItemVisor> = {}): ItemVisor {
  return {
    id,
    slug: `slug-${id}`,
    nombre: `Landing ${id}`,
    producto: `Producto ${id}`,
    puntaje: 8.2,
    tematica: "espacio",
    secciones: 14,
    fuentes: ["NASA", "NOAA"],
    prompt: { rol: `rol de ${id}`, tarea: `tarea de ${id}`, contexto: `contexto de ${id}`, formato: `formato de ${id}` },
    critica: {
      puntaje: 8.2,
      porCriterio: [{ criterio: "Claridad", puntaje: 8.5, evidencia: "El titular dice qué es." }],
      problemas: ["El pie es largo"],
      correcciones: ["Se acortó el pie"],
    },
    creditos: [{ credito: "NASA/JPL-Caltech", licencia: "Dominio público (NASA)", slots: ["a"], urlOrigen: "https://images.nasa.gov/x" }],
    estado: "borrador",
    mejoras: ["Se acortó el pie"],
    completar: [{ seccionId: "sec-faq", tipo: "faq", etiqueta: "Preguntas", ruta: "bloques.faq-1.respuesta", campo: "respuesta", texto: "[COMPLETAR]", critico: false }],
    revision: { items: [], bloquea: false, bloqueos: 0, avisos: 0, lighthouse: 95 },
    ...extra,
  };
}

const ITEMS = [item("uno"), item("dos", { tematica: "producto", fuentes: [], critica: null, creditos: [] }), item("tres")];

let pantallaCompletaActual: Element | null = null;
const pedirPantallaCompleta = vi.fn();
const salirPantallaCompleta = vi.fn();

beforeEach(() => {
  pantallaCompletaActual = null;
  pedirPantallaCompleta.mockReset();
  salirPantallaCompleta.mockReset();
  Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: true });
  Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => pantallaCompletaActual });
  Object.defineProperty(document, "exitFullscreen", {
    configurable: true,
    value: async () => {
      salirPantallaCompleta();
      pantallaCompletaActual = null;
      document.dispatchEvent(new Event("fullscreenchange"));
    },
  });
  Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
    configurable: true,
    // Solo el visor pide pantalla completa en estas pruebas.
    value: async () => {
      pantallaCompletaActual = document.querySelector("[data-visor]");
      pedirPantallaCompleta(pantallaCompletaActual);
      document.dispatchEvent(new Event("fullscreenchange"));
    },
  });
  window.history.replaceState(null, "", "/ver/uno");
});

afterEach(cleanup);

const raiz = () => document.querySelector<HTMLElement>("[data-visor]")!;
const iframe = () => document.querySelector<HTMLIFrameElement>("iframe")!;

describe("funciones del visor", () => {
  it("la escala hace caber el dispositivo sin agrandarlo", () => {
    expect(escalaParaCaber(414, 868, 1000, 1000)).toBe(1);
    expect(escalaParaCaber(414, 868, 1000, 434)).toBeCloseTo(0.5, 2);
    expect(escalaParaCaber(844, 1204, 422, 2000)).toBeCloseTo(0.5, 2);
    expect(escalaParaCaber(414, 868, 0, 0)).toBe(1);
  });

  it("vecino da la vuelta en los dos sentidos", () => {
    expect(vecino(0, 8, -1)).toBe(7);
    expect(vecino(7, 8, 1)).toBe(0);
    expect(vecino(3, 8, 1)).toBe(4);
    expect(vecino(0, 0, 1)).toBe(0);
  });

  it("el dispositivo de la dirección se valida", () => {
    expect(dispositivoDe("movil")).toBe("movil");
    expect(dispositivoDe("tablet")).toBe("tablet");
    expect(dispositivoDe("loquesea")).toBe("escritorio");
    expect(dispositivoDe(undefined)).toBe("escritorio");
  });
});

describe("Visor · dispositivos", () => {
  it("muestra la landing pública en un iframe y arranca en escritorio", () => {
    render(<Visor items={ITEMS} inicialId="uno" />);
    expect(iframe().getAttribute("src")).toBe("/l/slug-uno");
    expect(raiz().dataset.dispositivoActivo).toBe("escritorio");
    expect(document.querySelector("[data-marco='escritorio']")).not.toBeNull();
    expect(screen.getByText("Landing 1 de 3")).toBeTruthy();
  });

  it("el conmutador cambia entre móvil (390×844), tablet (820×1180) y escritorio", () => {
    render(<Visor items={ITEMS} inicialId="uno" />);
    const grupo = screen.getByRole("group", { name: "Dispositivo" });

    fireEvent.click(within(grupo).getByRole("button", { name: "Móvil" }));
    expect(raiz().dataset.dispositivoActivo).toBe("movil");
    const movil = document.querySelector<HTMLElement>("[data-marco='movil']")!;
    // La pantalla mide 390×844 dentro de un marco de 12 px por lado.
    expect(movil.style.width).toBe("414px");
    expect(movil.style.height).toBe("868px");
    expect((movil.querySelector("iframe")!.parentElement as HTMLElement).style.width).toBe("390px");
    expect((movil.querySelector("iframe")!.parentElement as HTMLElement).style.height).toBe("844px");
    expect(movil.querySelector("[data-notch]")).not.toBeNull();
    expect(within(grupo).getByRole("button", { name: "Móvil" }).getAttribute("aria-pressed")).toBe("true");
    expect(within(grupo).getByRole("button", { name: "Escritorio" }).getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(within(grupo).getByRole("button", { name: "Tablet" }));
    const tablet = document.querySelector<HTMLElement>("[data-marco='tablet']")!;
    expect((tablet.querySelector("iframe")!.parentElement as HTMLElement).style.width).toBe("820px");
    expect((tablet.querySelector("iframe")!.parentElement as HTMLElement).style.height).toBe("1180px");
    expect(tablet.querySelector("[data-notch]")).toBeNull();

    fireEvent.click(within(grupo).getByRole("button", { name: "Escritorio" }));
    expect(document.querySelector("[data-marco='escritorio']")).not.toBeNull();
    expect(document.querySelector("[data-marco='movil'], [data-marco='tablet']")).toBeNull();
  });

  it("arranca en el dispositivo pedido y lo deja en la dirección", () => {
    render(<Visor items={ITEMS} inicialId="uno" dispositivoInicial="movil" />);
    expect(raiz().dataset.dispositivoActivo).toBe("movil");
    expect(window.location.pathname + window.location.search).toBe("/ver/uno?dispositivo=movil");
    fireEvent.click(screen.getByRole("button", { name: "Tablet" }));
    expect(window.location.search).toBe("?dispositivo=tablet");
  });
});

describe("Visor · navegación entre las landings", () => {
  it("← → cambian de landing, dan la vuelta y actualizan la dirección sin recargar", () => {
    render(<Visor items={ITEMS} inicialId="uno" />);
    fireEvent.click(screen.getByRole("button", { name: "Landing siguiente" }));
    expect(iframe().getAttribute("src")).toBe("/l/slug-dos");
    expect(screen.getByText("Landing 2 de 3")).toBeTruthy();
    expect(window.location.pathname).toBe("/ver/dos");
    expect(document.title).toBe("Landing dos · Visor");

    fireEvent.click(screen.getByRole("button", { name: "Landing anterior" }));
    fireEvent.click(screen.getByRole("button", { name: "Landing anterior" }));
    expect(iframe().getAttribute("src")).toBe("/l/slug-tres");
    expect(screen.getByText("Landing 3 de 3")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Landing siguiente" }));
    expect(iframe().getAttribute("src")).toBe("/l/slug-uno");
  });

  it("las flechas del teclado navegan, salvo al escribir en un campo", () => {
    render(<Visor items={ITEMS} inicialId="uno" />);
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(iframe().getAttribute("src")).toBe("/l/slug-dos");
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(iframe().getAttribute("src")).toBe("/l/slug-uno");

    const campo = document.createElement("input");
    document.body.appendChild(campo);
    fireEvent.keyDown(campo, { key: "ArrowRight" });
    expect(iframe().getAttribute("src")).toBe("/l/slug-uno");
    fireEvent.keyDown(window, { key: "ArrowRight", ctrlKey: true });
    expect(iframe().getAttribute("src")).toBe("/l/slug-uno");
    campo.remove();
  });

  it("conserva el dispositivo al cambiar de landing", () => {
    render(<Visor items={ITEMS} inicialId="uno" dispositivoInicial="movil" />);
    fireEvent.click(screen.getByRole("button", { name: "Landing siguiente" }));
    expect(raiz().dataset.dispositivoActivo).toBe("movil");
    expect(window.location.search).toBe("?dispositivo=movil");
  });

  it("anuncia la landing nueva a los lectores de pantalla", () => {
    render(<Visor items={ITEMS} inicialId="uno" />);
    fireEvent.click(screen.getByRole("button", { name: "Landing siguiente" }));
    expect(document.querySelector("[data-anuncio]")?.textContent).toBe("Landing 2 de 3: Landing dos, en escritorio.");
  });
});

describe("Visor · pantalla completa", () => {
  it("pide la pantalla completa sobre el visor y deja solo los controles flotantes", async () => {
    render(<Visor items={ITEMS} inicialId="uno" />);
    expect(document.querySelector("header")).not.toBeNull();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Pantalla completa" })));
    expect(pedirPantallaCompleta).toHaveBeenCalledWith(raiz());
    expect(raiz().dataset.pantallaCompleta).toBe("true");
    expect(document.querySelector("header")).toBeNull();
    const flotantes = document.querySelector<HTMLElement>("[data-controles-flotantes]")!;
    expect(flotantes.className).toContain("opacity-60");
    expect(within(flotantes).getByRole("button", { name: "Móvil" })).toBeTruthy();
    expect(within(flotantes).getByRole("button", { name: "Salir de pantalla completa" })).toBeTruthy();
  });

  it("en pantalla completa se sigue navegando y cambiando de dispositivo", async () => {
    render(<Visor items={ITEMS} inicialId="uno" />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Pantalla completa" })));
    const flotantes = document.querySelector<HTMLElement>("[data-controles-flotantes]")!;
    fireEvent.click(within(flotantes).getByRole("button", { name: "Landing siguiente" }));
    expect(iframe().getAttribute("src")).toBe("/l/slug-dos");
    fireEvent.click(within(flotantes).getByRole("button", { name: "Tablet" }));
    expect(raiz().dataset.dispositivoActivo).toBe("tablet");
    // Sigue en pantalla completa: cambiar de landing no desmonta el visor.
    expect(raiz().dataset.pantallaCompleta).toBe("true");
  });

  it("«Salir» y Esc (el navegador dispara fullscreenchange) devuelven la barra", async () => {
    render(<Visor items={ITEMS} inicialId="uno" />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Pantalla completa" })));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Salir de pantalla completa" })));
    expect(salirPantallaCompleta).toHaveBeenCalled();
    expect(raiz().dataset.pantallaCompleta).toBe("false");
    expect(document.querySelector("header")).not.toBeNull();

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Pantalla completa" })));
    await act(async () => {
      pantallaCompletaActual = null;
      document.dispatchEvent(new Event("fullscreenchange"));
    });
    expect(raiz().dataset.pantallaCompleta).toBe("false");
  });

  it("si el navegador no permite la pantalla completa, el botón queda desactivado", async () => {
    Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: false });
    render(<Visor items={ITEMS} inicialId="uno" />);
    expect((screen.getByRole("button", { name: "Pantalla completa" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("Visor · panel de detalles", () => {
  it("está plegado al abrir y se despliega con el botón", () => {
    render(<Visor items={ITEMS} inicialId="uno" />);
    expect(document.querySelector("#visor-detalles")).toBeNull();
    const boton = screen.getByRole("button", { name: "Detalles" });
    expect(boton.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(boton);
    expect(boton.getAttribute("aria-expanded")).toBe("true");
    expect(document.querySelector("#visor-detalles")).not.toBeNull();
    fireEvent.click(boton);
    expect(document.querySelector("#visor-detalles")).toBeNull();
  });

  it("trae el prompt de 4 bloques, el informe del crítico, las fuentes y los créditos", () => {
    render(<Visor items={ITEMS} inicialId="uno" detallesInicial />);
    const panel = document.querySelector<HTMLElement>("#visor-detalles")!;
    expect(panel.querySelectorAll("[data-bloque]")).toHaveLength(4);
    for (const b of ["rol", "tarea", "contexto", "formato"]) expect(within(panel).getByText(`${b} de uno`)).toBeTruthy();
    const critico = panel.querySelector("[data-critico]")!;
    expect(critico.textContent).toContain("8,2/10");
    expect(critico.textContent).toContain("El titular dice qué es.");
    expect(critico.textContent).toContain("El pie es largo");
    expect(critico.textContent).toContain("Se acortó el pie");
    expect(panel.querySelector("[data-fuentes-panel]")?.textContent).toContain("NOAA");
    const creditos = panel.querySelector("[data-creditos-panel]")!;
    expect(creditos.textContent).toContain("NASA/JPL-Caltech");
    expect(creditos.querySelector("a")?.getAttribute("href")).toBe("https://images.nasa.gov/x");
  });

  it("el contenido cambia con la landing y avisa lo que falta", () => {
    render(<Visor items={ITEMS} inicialId="uno" detallesInicial />);
    fireEvent.click(screen.getByRole("button", { name: "Landing siguiente" }));
    const panel = document.querySelector<HTMLElement>("#visor-detalles")!;
    expect(within(panel).getByText("rol de dos")).toBeTruthy();
    expect(panel.textContent).toContain("Esta landing no tiene informe del crítico.");
    expect(panel.textContent).toContain("Sin fuentes externas");
    expect(panel.textContent).toContain("Ninguna imagen trae crédito todavía.");
  });

  it("en la barra hay salida al banco y acceso al editor de la landing actual", () => {
    render(<Visor items={ITEMS} inicialId="uno" />);
    expect(screen.getByRole("link", { name: /Salir/ }).getAttribute("href")).toBe("/banco");
    expect(screen.getByRole("link", { name: /Editar/ }).getAttribute("href")).toBe("/editor/uno");
    fireEvent.click(screen.getByRole("button", { name: "Landing siguiente" }));
    expect(screen.getByRole("link", { name: /Editar/ }).getAttribute("href")).toBe("/editor/dos");
  });
});
