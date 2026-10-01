// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { BarraSugerida } from "@/componentes/crear/BarraSugerida";
import { LandingRender } from "@/componentes/LandingRender";
import { ejemplo as ejemploFormulario } from "@/secciones/formulario-lead/ejemplo";
import { docCon } from "../secciones/ayudas";

// El entorno de pruebas de React exige esta marca para usar `act` al hidratar.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

const META = { fuentes: [{ url: "https://saludtotal.co/nota", sitio: "saludtotal.co" }], confianza: 0.8, motivo: "Aparece en varias reseñas." };

function elemento(pendiente: boolean) {
  return <BarraSugerida campo="problema" meta={META} pendiente={pendiente} selector="#x" onAceptar={() => {}} onQuitar={() => {}} />;
}

describe("hidratación de /crear · BarraSugerida", () => {
  for (const pendiente of [true, false]) {
    it(`no anida una lista dentro de un párrafo (${pendiente ? "pendiente" : "aceptado"}) y hidrata sin errores`, async () => {
      const errores = vi.spyOn(console, "error").mockImplementation(() => {});
      const contenedor = document.createElement("div");
      contenedor.innerHTML = renderToString(elemento(pendiente));
      document.body.appendChild(contenedor);
      expect(contenedor.querySelector("p ul, p ol, p div")).toBeNull();

      await act(async () => {
        hydrateRoot(contenedor, elemento(pendiente));
      });
      expect(errores).not.toHaveBeenCalled();
    });
  }
});

describe("formulario público · texto escrito antes de hidratar", () => {
  it("conserva lo escrito y lo envía al hidratar", async () => {
    const doc = docCon([ejemploFormulario]);
    const app = <LandingRender doc={doc} landingId="landing-1" />;
    const contenedor = document.createElement("div");
    contenedor.innerHTML = renderToString(app);
    document.body.appendChild(contenedor);

    // La persona escribe con el HTML del servidor, antes de que React tome el control.
    const nombre = contenedor.querySelector<HTMLInputElement>("input[name='nombre']")!;
    const telefono = contenedor.querySelector<HTMLInputElement>("input[name='telefono']")!;
    nombre.value = "Ana Torres";
    telefono.value = "3001234567";

    const envios: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      envios.push(JSON.parse(String(init.body)));
      return new Response("{}", { status: 201 });
    }));

    await act(async () => {
      hydrateRoot(contenedor, app);
    });
    expect(contenedor.querySelector<HTMLInputElement>("input[name='nombre']")!.value).toBe("Ana Torres");
    expect(contenedor.querySelector<HTMLInputElement>("input[name='telefono']")!.value).toBe("3001234567");

    fireEvent.click(screen.getByRole("button", { name: /quiero el mío/i }));
    await waitFor(() => expect(envios).toHaveLength(1));
    expect(envios[0]).toMatchObject({ landingId: "landing-1", datos: { nombre: "Ana Torres", telefono: "3001234567" } });
    vi.unstubAllGlobals();
  });
});
