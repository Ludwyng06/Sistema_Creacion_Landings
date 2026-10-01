// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LandingRender } from "@/componentes/LandingRender";
import { ejemplo } from "@/secciones/formulario-lead/ejemplo";
import { docCon } from "../secciones/ayudas";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const json = (cuerpo: unknown, estado: number) =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: { "Content-Type": "application/json" } });

function pintar() {
  render(<LandingRender doc={docCon([ejemplo])} landingId="lan-1" />);
}
function llenar() {
  fireEvent.change(screen.getByLabelText(/^nombre/i), { target: { value: "Ana Torres" } });
  fireEvent.change(screen.getByLabelText(/^teléfono/i), { target: { value: "3001234567" } });
  fireEvent.click(screen.getByRole("button", { name: /quiero el mío/i }));
}

describe("lead público", () => {
  it("envío válido → POST /api/leads con honeypot vacío y mensaje de éxito", async () => {
    const f = vi.fn<(url: string, init: { method: string; body: string }) => Promise<Response>>(async () => json({ ok: true }, 201));
    vi.stubGlobal("fetch", f);
    pintar();
    llenar();
    await waitFor(() => expect(screen.getByRole("status")).toBeTruthy());
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("/api/leads");
    const cuerpo = JSON.parse(init.body);
    expect(cuerpo).toMatchObject({ landingId: "lan-1", sitio: "" });
    expect(cuerpo.datos).toMatchObject({ nombre: "Ana Torres", telefono: "3001234567" });
    expect(screen.getByRole("status").textContent).toBe(ejemplo.ajustes.mensajeGracias);
  });

  it("400 → errores del servidor junto a cada campo", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "Datos inválidos", errores: ["El teléfono debe tener al menos 7 dígitos."] }, 400)));
    pintar();
    llenar();
    await waitFor(() => expect(screen.getByText(/al menos 7 dígitos/i)).toBeTruthy());
    expect(screen.getByLabelText(/^teléfono/i).getAttribute("aria-invalid")).toBe("true");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("429 → mensaje legible y sin éxito", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "Demasiados intentos. Espera un minuto e inténtalo otra vez." }, 429)));
    pintar();
    llenar();
    await waitFor(() => expect(screen.getByText(/Demasiados intentos/i)).toBeTruthy());
    expect(screen.queryByRole("status")).toBeNull();
  });
});
