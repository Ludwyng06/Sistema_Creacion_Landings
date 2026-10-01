// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { ejemplo } from "@/secciones/formulario-lead/ejemplo";
import { ajustes as esquemaAjustes } from "@/secciones/formulario-lead/schema";
import { renderizar } from "./ayudas";

afterEach(cleanup);

function escribir(etiqueta: RegExp, valor: string) {
  fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } });
}

describe("formulario-lead · schema", () => {
  it("rechaza más de 3 campos obligatorios", () => {
    const resultado = esquemaAjustes.safeParse({
      ...ejemplo.ajustes,
      campos: ["nombre", "correo", "telefono", "ciudad"],
      obligatorios: ["nombre", "correo", "telefono", "ciudad"],
    });
    expect(resultado.success).toBe(false);
  });

  it("exige un obligatorio que esté entre los campos", () => {
    const resultado = esquemaAjustes.safeParse({
      ...ejemplo.ajustes,
      campos: ["nombre", "telefono"],
      obligatorios: ["correo"],
    });
    expect(resultado.success).toBe(false);
  });

  it("exige correo o teléfono", () => {
    const resultado = esquemaAjustes.safeParse({
      ...ejemplo.ajustes,
      campos: ["nombre", "ciudad"],
      obligatorios: ["nombre"],
    });
    expect(resultado.success).toBe(false);
  });

  it("acepta el formato del fixture (campos y sin obligatorios explícitos)", () => {
    const { obligatorios, ...resto } = ejemplo.ajustes;
    void obligatorios;
    expect(esquemaAjustes.safeParse({ ...resto, campos: ["nombre", "correo", "telefono"] }).success).toBe(true);
  });
});

describe("formulario-lead · cliente", () => {
  it("muestra errores y no confirma si faltan datos obligatorios", () => {
    renderizar([ejemplo]);
    fireEvent.click(screen.getByRole("button", { name: /quiero el mío/i }));
    expect(screen.getAllByRole("alert").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByLabelText(/^nombre/i).getAttribute("aria-invalid")).toBe("true");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("valida el formato del teléfono", () => {
    renderizar([ejemplo]);
    escribir(/^nombre/i, "Ana Torres");
    escribir(/^teléfono/i, "123");
    fireEvent.click(screen.getByRole("button", { name: /quiero el mío/i }));
    expect(screen.getByText(/al menos 7 dígitos/i)).toBeTruthy();
  });

  it("no exige los campos opcionales", () => {
    renderizar([ejemplo]);
    escribir(/^nombre/i, "Ana Torres");
    escribir(/^teléfono/i, "3001234567");
    fireEvent.click(screen.getByRole("button", { name: /quiero el mío/i }));
    return waitFor(() => expect(screen.getByRole("status").textContent).toBe(ejemplo.ajustes.mensajeGracias));
  });

  it("marca como opcional lo que no es obligatorio", () => {
    renderizar([ejemplo]);
    // El ejemplo pide nombre y teléfono; correo y ciudad quedan opcionales.
    expect(screen.getAllByText(/\(opcional\)/i)).toHaveLength(2);
  });
});
