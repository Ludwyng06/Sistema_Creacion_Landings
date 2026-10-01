// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { PanelEntrega } from "@/componentes/entrega/PanelEntrega";
import { listaDeRevision } from "@/lib/entrega/revision";
import type { ItemVisor } from "@/lib/visor";
import { landingEjemplo } from "../fixtures/landing-ejemplo";
import { datosPorCompletar } from "@/lib/entrega/completar";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function item(doc = structuredClone(landingEjemplo), extra: Partial<ItemVisor> = {}): ItemVisor {
  return {
    id: "abc",
    slug: "corrector-postura",
    nombre: "Corrector",
    producto: "Corrector",
    puntaje: 8,
    tematica: "producto",
    secciones: doc.secciones.length,
    fuentes: [],
    prompt: { rol: "", tarea: "", contexto: "", formato: "" },
    critica: { puntaje: 8, porCriterio: [], problemas: [], correcciones: ["Se acortó el titular", "Se quitó una frase vacía"] },
    creditos: [],
    estado: "borrador",
    mejoras: ["Se acortó el titular", "Se quitó una frase vacía"],
    completar: datosPorCompletar(doc),
    revision: listaDeRevision(doc),
    ...extra,
  };
}

/** El panel con su destino, como lo monta el visor (los detalles se dibujan en un elemento aparte). */
function Panel({ item: it, abierto: inicial = false }: { item: ItemVisor; abierto?: boolean }) {
  const [abierto, setAbierto] = useState(inicial);
  const [destino, setDestino] = useState<HTMLElement | null>(null);
  return (
    <>
      <PanelEntrega item={it} abierto={abierto} onAlternar={() => setAbierto((a) => !a)} destino={destino} />
      <aside ref={setDestino} hidden={!abierto} />
    </>
  );
}

describe("panel de entrega del visor", () => {
  it("copiar link pone la dirección pública /l/slug en el portapapeles", async () => {
    const escribir = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText: escribir } });
    render(<Panel item={item()} />);
    fireEvent.click(screen.getByRole("button", { name: /Copiar link/ }));
    await waitFor(() => expect(escribir).toHaveBeenCalledWith(`${window.location.origin}/l/corrector-postura`));
    expect((await screen.findByRole("status")).textContent).toBe("Link copiado");
  });

  it("descargar HTML apunta a la ruta del servidor con el nombre del archivo", () => {
    render(<Panel item={item()} />);
    const a = screen.getByRole("link", { name: /Descargar HTML/ });
    expect(a.getAttribute("href")).toBe("/api/entrega/abc/html");
    expect(a.getAttribute("download")).toBe("corrector-postura.html");
  });

  it("plegado solo muestra las acciones; al abrirlo salen lo que mejoró el revisor, los datos por completar con su enlace y la revisión", () => {
    render(<Panel item={item()} />);
    expect(document.querySelector("[data-mejoras]")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Revisión/ }));
    const mejoras = within(document.querySelector("[data-mejoras]") as HTMLElement);
    expect(mejoras.getByText("Se acortó el titular")).toBeTruthy();
    const pendientes = document.querySelector("[data-por-completar]") as HTMLElement;
    const enlaces = within(pendientes).getAllByRole("link", { name: "Completar" });
    expect(enlaces).toHaveLength(3);
    expect(enlaces[0].getAttribute("href")).toBe("/editor/abc?seccion=sec-faq");
    expect(document.querySelectorAll("[data-revision]")).toHaveLength(6);
  });

  it("con un punto crítico la lista de revisión bloquea «Guardar en el banco» y no llama a la API", () => {
    const doc = structuredClone(landingEjemplo);
    doc.secciones[0].ajustes.titular = "[COMPLETAR]";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<Panel item={item(doc)} />);
    fireEvent.click(screen.getByRole("button", { name: "Guardar en el banco" }));
    const modal = screen.getByRole("dialog");
    expect(within(modal).getByText(/1 punto que bloquea/)).toBeTruthy();
    const confirmar = within(modal).getByRole("button", { name: "Guardar en el banco" }) as HTMLButtonElement;
    expect(confirmar.disabled).toBe(true);
    fireEvent.click(confirmar);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(within(modal).getAllByRole("link", { name: "Corregir" })[0].getAttribute("href")).toBe("/editor/abc?seccion=sec-heroe");
  });

  it("sin puntos críticos deja guardar y avisa al terminar", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "abc", estado: "en-banco" }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    render(<Panel item={item()} />);
    fireEvent.click(screen.getByRole("button", { name: "Guardar en el banco" }));
    const modal = screen.getByRole("dialog");
    expect(within(modal).getByText(/Nada bloquea/)).toBeTruthy();
    fireEvent.click(within(modal).getByRole("button", { name: "Guardar en el banco" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/landings/abc/banco", expect.objectContaining({ method: "POST" })));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("button", { name: "Actualizar en el banco" })).toBeTruthy();
  });
});
