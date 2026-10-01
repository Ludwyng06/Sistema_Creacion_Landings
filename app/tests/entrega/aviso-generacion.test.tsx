// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AvisoGeneracion } from "@/componentes/entrega/AvisoGeneracion";
import { SIN_SENAL, hayAvisoGeneracion, marcadoresSinFoto, senalDeListo, textoAviso } from "@/lib/entrega/generacion";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("generación a medias · lógica", () => {
  it("lee la señal del evento listo y tolera que falten los campos", () => {
    expect(senalDeListo({ tipo: "listo", id: "x" })).toEqual({ ...SIN_SENAL, fotosPendientes: 0 });
    expect(senalDeListo({ tipo: "listo", id: "x", criticoPendiente: true, seccionesPorCompletar: ["faq", "oferta", "galeria"] })).toEqual({ criticoPendiente: true, seccionesPendientes: 3, fotosPendientes: 0 });
    expect(senalDeListo({ seccionesPorCompletar: "x" }).seccionesPendientes).toBe(0);
    expect(senalDeListo(null)).toEqual({ ...SIN_SENAL, fotosPendientes: 0 });
  });
  it("avisa solo si falta el crítico o hay secciones por completar", () => {
    expect(hayAvisoGeneracion(SIN_SENAL)).toBe(false);
    expect(hayAvisoGeneracion({ criticoPendiente: true, seccionesPendientes: 0 })).toBe(true);
    expect(hayAvisoGeneracion({ criticoPendiente: false, seccionesPendientes: 1 })).toBe(true);
  });
  it("el texto es amable y concreto", () => {
    expect(textoAviso({ criticoPendiente: true, seccionesPendientes: 2 }).detalle).toMatch(/2 secciones quedaron por completar/);
    expect(textoAviso({ criticoPendiente: false, seccionesPendientes: 1 }).detalle).toMatch(/1 sección quedó por completar/);
    expect(textoAviso({ criticoPendiente: true, seccionesPendientes: 0 }).titulo).toMatch(/crítico/);
  });
});

describe("AvisoGeneracion", () => {
  it("reintenta el crítico, avisa y llama al callback", async () => {
    const buscar = vi.fn().mockResolvedValue(new Response(JSON.stringify({ landing: { id: "abc" }, puntaje: 8, bajoUmbral: false }), { status: 200 }));
    vi.stubGlobal("fetch", buscar);
    const alReintentar = vi.fn();
    render(<AvisoGeneracion landingId="abc" senal={{ criticoPendiente: true, seccionesPendientes: 0 }} alReintentar={alReintentar} />);
    fireEvent.click(screen.getByRole("button", { name: "Reintentar el crítico" }));
    await waitFor(() => expect(alReintentar).toHaveBeenCalled());
    expect(buscar.mock.calls[0][0]).toBe("/api/landings/abc/critico");
    expect(screen.getByText(/tu landing se actualizó/i)).toBeTruthy();
  });
  it("si falla muestra el error y deja volver a intentar", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Sin cupo", intentos: [], promptManual: "" }), { status: 503 })));
    render(<AvisoGeneracion landingId="abc" senal={{ criticoPendiente: true, seccionesPendientes: 2 }} />);
    fireEvent.click(screen.getByRole("button", { name: "Reintentar el crítico" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/Todavía no hay cupo/);
    expect((screen.getByRole("button", { name: "Reintentar el crítico" }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByRole("link", { name: "Completar en el editor" }).getAttribute("href")).toBe("/editor/abc");
  });
  it("sin crítico pendiente no ofrece el botón", () => {
    render(<AvisoGeneracion landingId="abc" senal={{ criticoPendiente: false, seccionesPendientes: 1 }} />);
    expect(screen.queryByRole("button", { name: "Reintentar el crítico" })).toBeNull();
  });
});

describe("Buscar fotos", () => {
  it("cuenta los slots sin archivo y avisa aunque el crítico y las secciones estén bien", () => {
    expect(marcadoresSinFoto({ assets: [] })).toBe(1);
    expect(marcadoresSinFoto({ assets: [{ slot: "a", ruta: "/x.webp" }, { slot: "b" }] as never })).toBe(1);
    expect(hayAvisoGeneracion({ criticoPendiente: false, seccionesPendientes: 0, fotosPendientes: 2 })).toBe(true);
    expect(textoAviso({ criticoPendiente: false, seccionesPendientes: 0, fotosPendientes: 2 }).titulo).toMatch(/fotos/);
  });
  it("el botón llama a /imagenes y avisa al terminar", async () => {
    const buscar = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", buscar);
    const alReintentar = vi.fn();
    render(<AvisoGeneracion landingId="abc" senal={{ criticoPendiente: false, seccionesPendientes: 0, fotosPendientes: 3 }} alReintentar={alReintentar} />);
    fireEvent.click(screen.getByRole("button", { name: "Buscar fotos" }));
    await waitFor(() => expect(alReintentar).toHaveBeenCalled());
    expect(buscar.mock.calls[0][0]).toBe("/api/landings/abc/imagenes");
    expect(screen.queryByRole("button", { name: "Reintentar el crítico" })).toBeNull();
  });
});
