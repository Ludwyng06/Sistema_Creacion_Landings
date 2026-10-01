// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CrearRapido } from "@/componentes/crear/CrearRapido";
import { ETAPAS } from "@/componentes/crear/encargo";
import { aplicarEtapa, type EtapasEnCurso } from "@/componentes/crear/progreso-etapas";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: () => {} }) }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const vacio: EtapasEnCurso = { activas: [], hechas: [], mensaje: "" };

describe("etapas simultáneas", () => {
  it("con estado, varias etapas quedan activas y cada una se cierra con su fin", () => {
    let p = aplicarEtapa(vacio, { etapa: "intake", mensaje: "a", estado: "inicio" }, ETAPAS);
    p = aplicarEtapa(p, { etapa: "intake", mensaje: "a", estado: "fin" }, ETAPAS);
    p = aplicarEtapa(p, { etapa: "fuentes", mensaje: "b", estado: "inicio" }, ETAPAS);
    p = aplicarEtapa(p, { etapa: "redaccion", mensaje: "c", estado: "inicio", n: 1, total: 9 }, ETAPAS);
    expect(p.activas).toEqual(["fuentes", "redaccion"]);
    expect(p.hechas).toEqual(["intake"]);
    expect(p.mensaje).toBe("c");
    p = aplicarEtapa(p, { etapa: "fuentes", mensaje: "b", estado: "fin" }, ETAPAS);
    expect(p.activas).toEqual(["redaccion"]);
    expect(p.hechas).toEqual(["intake", "fuentes"]);
  });
  it("sin estado se comporta como antes: una activa y las anteriores hechas", () => {
    const p = aplicarEtapa(vacio, { etapa: "estrategia", mensaje: "x" }, ETAPAS);
    expect(p.activas).toEqual(["estrategia"]);
    expect(p.hechas).toEqual(["intake", "fuentes"]);
  });
  it("la pantalla pinta dos etapas activas a la vez, cada una con su spinner", async () => {
    const lineas = [
      { tipo: "etapa", etapa: "fuentes", mensaje: "Buscando…", estado: "inicio" },
      { tipo: "etapa", etapa: "estrategia", mensaje: "Definiendo…", estado: "inicio" },
      { tipo: "etapa", etapa: "fuentes", mensaje: "Buscando…", estado: "fin" },
    ].map((e) => JSON.stringify(e));
    const encoder = new TextEncoder();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new ReadableStream({ start(c) { for (const l of lineas) c.enqueue(encoder.encode(l + "\n")); } }), { status: 200 })));
    render(<CrearRapido />);
    fireEvent.change(screen.getByLabelText("¿Qué landing quieres?"), { target: { value: "Landing para una agencia de tours de auroras" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear mi landing" }));
    const activa = await screen.findByText("Definiendo la estrategia");
    expect(activa.closest("li")?.getAttribute("data-estado")).toBe("activa");
    expect(screen.getByText("Buscando datos e imágenes").closest("li")?.getAttribute("data-estado")).toBe("hecha");
  });
});
