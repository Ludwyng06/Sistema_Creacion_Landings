// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ResultadoValidador } from "@/lib/contratos";
import { deBrief } from "@/componentes/crear/borrador";
import { PasoConstruir } from "@/componentes/crear/PasoConstruir";
import { EJEMPLOS } from "@/datos/ejemplos";
import { landingEjemplo } from "../fixtures/landing-ejemplo";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const BRIEF = EJEMPLOS[0].brief;
const SALUD: ResultadoValidador[] = [
  { id: "esquema", estado: "verde", problemas: [] },
  { id: "lista-negra", estado: "verde", problemas: [] },
];

function respuestaJson(cuerpo: unknown, estado = 200): Response {
  return new Response(JSON.stringify(cuerpo), { status: estado, headers: { "Content-Type": "application/json" } });
}

function respuestaNdjson(lineas: string[]): Response {
  const codificador = new TextEncoder();
  return new Response(
    new ReadableStream<Uint8Array>({
      async start(c) {
        for (const l of lineas) {
          c.enqueue(codificador.encode(l + "\n"));
          await new Promise((r) => setTimeout(r, 0));
        }
        c.close();
      },
    }),
    { status: 200, headers: { "Content-Type": "application/x-ndjson" } },
  );
}

const critica = (puntaje: number) => ({ puntaje, porCriterio: [], problemas: [], correcciones: [] });
const ladoDuelo = (proveedor: string, nombre: string) => ({
  doc: { ...landingEjemplo, meta: { ...landingEjemplo.meta, nombre } },
  salud: SALUD,
  vueltasCritico: 1,
  proveedores: { landing: proveedor },
  avisos: [],
  proveedorLanding: proveedor,
});

function flujoDuelo(ganador: "a" | "b" | "empate" = "b"): string[] {
  return [
    JSON.stringify({ tipo: "tarea", tarea: "landing", estado: "en-curso", lado: "a" }),
    JSON.stringify({ tipo: "tarea", tarea: "landing", estado: "en-curso", lado: "b" }),
    JSON.stringify({ tipo: "tarea", tarea: "landing", estado: "ok", proveedor: "gemini", ms: 4000, lado: "a" }),
    JSON.stringify({ tipo: "tarea", tarea: "landing", estado: "ok", proveedor: "groq", ms: 2500, lado: "b" }),
    JSON.stringify({
      tipo: "duelo",
      a: ladoDuelo("gemini", "Versión de Gemini"),
      b: ladoDuelo("groq", "Versión de Groq"),
      juez: { a: critica(7.4), b: critica(8.8), ganador, razon: "La opción B tiene un titular más concreto." },
      ganador,
      proveedores: { a: "gemini", b: "groq", juez: "cerebras" },
      avisos: [],
    }),
  ];
}

const propiedades = () => ({
  brief: deBrief(BRIEF),
  tecnicas: [] as never[],
  numeroSemilla: undefined,
  prompt: { rol: "r", tarea: "t", contexto: "c", formato: "f", aportes: [] },
  autoIniciar: false,
  onAbrirEditor: vi.fn(),
});

describe("Construir en duelo", () => {
  it("está activo y llama a /api/construir-duelo con el brief", async () => {
    const fetchFalso = vi.fn().mockResolvedValue(respuestaNdjson(flujoDuelo()));
    vi.stubGlobal("fetch", fetchFalso);
    render(<PasoConstruir {...propiedades()} />);
    const boton = screen.getByRole("button", { name: "Construir en duelo" });
    expect(boton.hasAttribute("disabled")).toBe(false);
    await act(async () => {
      fireEvent.click(boton);
    });
    await screen.findByRole("heading", { name: "Opción A" });
    expect(fetchFalso.mock.calls[0][0]).toBe("/api/construir-duelo");
    expect(JSON.parse(fetchFalso.mock.calls[0][1].body).brief.nombre).toBe(BRIEF.nombre);
  });

  it("muestra «Opción A» y «Opción B» con el puntaje del juez y la ganadora resaltada", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuestaNdjson(flujoDuelo("b"))));
    const { container } = render(<PasoConstruir {...propiedades()} />);
    fireEvent.click(screen.getByRole("button", { name: "Construir en duelo" }));
    await waitFor(() => expect(container.querySelector("[data-razon-juez]")).not.toBeNull());

    expect(screen.getByRole("heading", { name: "Opción A" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Opción B" })).toBeTruthy();
    expect(container.querySelectorAll("[data-panel-duelo] iframe")).toHaveLength(2);
    expect(container.querySelector('[data-lado="a"] [data-puntaje-juez]')?.textContent).toContain("7,4");
    expect(container.querySelector('[data-lado="b"] [data-puntaje-juez]')?.textContent).toContain("8,8");
    expect(container.querySelector('[data-lado="b"]')?.getAttribute("data-ganadora")).toBe("true");
    expect(container.querySelector('[data-lado="a"]')?.getAttribute("data-ganadora")).toBeNull();
    expect(container.querySelector('[data-lado="b"]')?.textContent).toContain("Ganadora del juez");
    expect(container.querySelector("[data-razon-juez]")?.textContent).toContain("titular más concreto");
    // Son tarjetas de comparación: ningún h1 ni héroe.
    expect(container.querySelector("[data-panel-duelo] h1")).toBeNull();
  });

  it("un empate no resalta a ninguna", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuestaNdjson(flujoDuelo("empate"))));
    const { container } = render(<PasoConstruir {...propiedades()} />);
    fireEvent.click(screen.getByRole("button", { name: "Construir en duelo" }));
    await waitFor(() => expect(container.querySelector("[data-razon-juez]")).not.toBeNull());
    expect(container.querySelector("[data-ganadora]")).toBeNull();
    expect(container.querySelector("[data-razon-juez]")?.textContent).toContain("Empate");
  });

  it("«Guardar esta» guarda la opción elegida con proveedor «duelo» y abre el editor", async () => {
    const fetchFalso = vi
      .fn()
      .mockResolvedValueOnce(respuestaNdjson(flujoDuelo("b")))
      .mockResolvedValueOnce(respuestaJson({ id: "duelo1", slug: "x" }, 201));
    vi.stubGlobal("fetch", fetchFalso);
    const props = propiedades();
    const { container } = render(<PasoConstruir {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Construir en duelo" }));
    await waitFor(() => expect(container.querySelector("[data-razon-juez]")).not.toBeNull());
    fireEvent.click(within(container.querySelector('[data-lado="b"]') as HTMLElement).getByRole("button", { name: /guardar esta/i }));
    await waitFor(() => expect(props.onAbrirEditor).toHaveBeenCalledWith("duelo1"));
    expect(fetchFalso.mock.calls[1][0]).toBe("/api/landings");
    const cuerpo = JSON.parse(fetchFalso.mock.calls[1][1].body);
    expect(cuerpo.proveedor).toBe("duelo");
    expect(cuerpo.doc.meta.nombre).toBe("Versión de Groq");
  });

  it("si fallan los dos lados muestra el error y permite reintentar el duelo", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuestaNdjson([JSON.stringify({ tipo: "error", mensaje: "Fallaron los dos proveedores del duelo." })])));
    const { container } = render(<PasoConstruir {...propiedades()} />);
    fireEvent.click(screen.getByRole("button", { name: "Construir en duelo" }));
    await screen.findByText("Fallaron los dos proveedores del duelo.");
    expect(container.querySelector("[data-error-duelo]")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Reintentar el duelo" })).toBeTruthy();
  });

  it("si la ruta responde 404 lo dice con claridad", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuestaJson({}, 404)));
    render(<PasoConstruir {...propiedades()} />);
    fireEvent.click(screen.getByRole("button", { name: "Construir en duelo" }));
    expect(await screen.findByText(/todavía no está disponible/i)).toBeTruthy();
  });
});
