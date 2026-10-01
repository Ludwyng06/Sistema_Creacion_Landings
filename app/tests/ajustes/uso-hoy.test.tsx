// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { UsoHoy, leerUsoHoy } from "@/componentes/ajustes/UsoHoy";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("leerUsoHoy", () => {
  it("acepta { proveedores } o una lista y suma el total si falta", () => {
    expect(leerUsoHoy({ proveedores: [{ proveedor: "openai", usd: 0.5 }, { proveedor: "gemini", usd: 0.25 }] })?.totalUsd).toBe(0.75);
    expect(leerUsoHoy([{ proveedor: "groq" }])?.proveedores).toHaveLength(1);
    expect(leerUsoHoy({ otra: 1 })).toBeNull();
    expect(leerUsoHoy({ proveedores: [{ nada: 1 }] })?.proveedores).toHaveLength(0);
  });
});

describe("UsoHoy", () => {
  it("muestra tokens, costo y el avance del presupuesto", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ proveedores: [{ proveedor: "openai", modelo: "gpt-5.4-mini", llamadas: 12, tokensEntrada: 34000, tokensSalida: 9000, usd: 0.5, presupuestoUsd: 2 }] }), { status: 200 })));
    render(<UsoHoy />);
    await waitFor(() => expect(screen.getByTestId("tabla-uso-hoy")).toBeTruthy());
    expect(screen.getByText(/34\.000/)).toBeTruthy();
    expect(screen.getByText(/25 % de USD 2,00 al día/)).toBeTruthy();
  });
  it("no aparece mientras la ruta no exista (404)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 404 })));
    const { container } = render(<UsoHoy />);
    await waitFor(() => expect(container.querySelector("[data-uso-hoy]")).toBeNull());
  });
  it("con un error avisa sin romper la página", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 500 })));
    render(<UsoHoy />);
    expect((await screen.findByRole("alert")).textContent).toMatch(/No pudimos leer el uso de hoy/);
  });
});
