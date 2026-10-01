// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ProveedorLanding } from "@/componentes/contexto-landing";
import { MarcadorAsset } from "@/componentes/MarcadorAsset";
import { tokensAVariables } from "@/componentes/tokens-css";
import { landingEjemplo } from "../fixtures/landing-ejemplo";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("tokensAVariables", () => {
  const variables = tokensAVariables(landingEjemplo.tokens) as Record<string, string>;

  it("emite las variables de color desde doc.tokens", () => {
    const { colores } = landingEjemplo.tokens;
    expect(variables["--c-fondo"]).toBe(colores.fondo);
    expect(variables["--c-superficie"]).toBe(colores.superficie);
    expect(variables["--c-texto"]).toBe(colores.texto);
    expect(variables["--c-texto-suave"]).toBe(colores.textoSuave);
    expect(variables["--c-acento"]).toBe(colores.acento);
    expect(variables["--c-acento-texto"]).toBe(colores.acentoTexto);
    expect(variables["--c-borde"]).toBe(colores.borde);
  });

  it("resuelve tipografías, radio, espacio y escala", () => {
    expect(variables["--f-titulos"]).toContain("--font-space-grotesk");
    expect(variables["--f-cuerpo"]).toContain("--font-ibm-plex-sans");
    expect(variables["--radio"]).toBe("4px");
    expect(variables["--espacio"]).toContain("clamp");
    expect(variables["--escala"]).toBe("1");
    expect(variables["--borde-ancho"]).toBe("1px");
  });

  it("aplica la escala y el espaciado elegidos", () => {
    const amplia = tokensAVariables({
      ...landingEjemplo.tokens,
      tipografia: { ...landingEjemplo.tokens.tipografia, escala: "amplia" },
      espaciado: "aireado",
      borde: "ninguno",
    }) as Record<string, string>;
    expect(Number(amplia["--escala"])).toBeGreaterThan(1);
    expect(amplia["--espacio"]).not.toBe(variables["--espacio"]);
    expect(amplia["--borde-ancho"]).toBe("0px");
  });

  it("una familia desconocida cae a una pila genérica citada", () => {
    const raro = tokensAVariables({
      ...landingEjemplo.tokens,
      tipografia: { titulos: 'Foo "Bar"', cuerpo: "Otra", escala: "normal" },
    }) as Record<string, string>;
    expect(raro["--f-titulos"]).toBe('"Foo Bar", ui-sans-serif, system-ui, sans-serif');
  });
});

describe("MarcadorAsset", () => {
  it("dice «Imagen pendiente» con el nombre del slot y sin botones en la página pública", () => {
    const { container } = render(<MarcadorAsset slot="heroe-producto" relacion="4:5" />);
    expect(screen.getByText("heroe-producto")).toBeTruthy();
    expect(screen.getByText(/imagen pendiente/i)).toBeTruthy();
    expect(screen.getByText(/relación 4:5/i)).toBeTruthy();
    expect((container.firstChild as HTMLElement).style.aspectRatio).toBe("4 / 5");
    expect(screen.queryByRole("button")).toBeNull();
    expect(container.textContent).not.toMatch(/grok/i);
  });

  it("en el editor ofrece «Buscar en bancos» y avisa con el slot", () => {
    const buscar = vi.fn();
    render(
      <ProveedorLanding value={{ assets: [], anclaFormulario: "f", onBuscarBancos: buscar }}>
        <MarcadorAsset slot="galeria-2" relacion="4:5" />
      </ProveedorLanding>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Buscar en bancos" }));
    expect(buscar).toHaveBeenCalledWith("galeria-2");
  });
});

const conBusqueda = (hijo: React.ReactNode) => (
  <ProveedorLanding value={{ assets: [], anclaFormulario: "f", onBuscarBancos: () => {} }}>{hijo}</ProveedorLanding>
);

describe("MarcadorAsset · modo compacto automático", () => {
  function simularTamano(width: number, height: number) {
    class ObservadorFalso {
      constructor(private aviso: (entradas: { contentRect: { width: number; height: number } }[]) => void) {}
      observe() {
        this.aviso([{ contentRect: { width, height } }]);
      }
      disconnect() {}
      unobserve() {}
    }
    vi.stubGlobal("ResizeObserver", ObservadorFalso);
  }

  it("en un contenedor grande usa el modo normal", () => {
    simularTamano(400, 500);
    const { container } = render(conBusqueda(<MarcadorAsset slot="galeria-1" relacion="4:5" />));
    expect((container.firstChild as HTMLElement).dataset.tamano).toBe("normal");
    expect(screen.getByRole("button").textContent).toBe("Buscar en bancos");
  });

  it("en un contenedor estrecho pasa a compacto y conserva el botón accesible", () => {
    simularTamano(200, 300);
    const { container } = render(conBusqueda(<MarcadorAsset slot="galeria-1" relacion="4:5" />));
    expect((container.firstChild as HTMLElement).dataset.tamano).toBe("compacto");
    expect(screen.queryByText(/relación/i)).toBeNull();
    expect(screen.getByRole("button", { name: /buscar en bancos/i })).toBeTruthy();
  });

  it("en una celda mínima el botón dice «Copiar» pero su nombre accesible sigue completo", () => {
    simularTamano(100, 280);
    const { container } = render(conBusqueda(<MarcadorAsset slot="heroe-mosaico-1" relacion="4:5" />));
    expect((container.firstChild as HTMLElement).dataset.tamano).toBe("minimo");
    const boton = screen.getByRole("button", { name: /buscar en bancos/i });
    expect(boton.textContent).toBe("Buscar");
  });

  it("el nombre del slot se recorta con elipsis y title, nunca a mitad de palabra", () => {
    simularTamano(100, 280);
    const { container } = render(<MarcadorAsset slot="heroe-mosaico-1" relacion="4:5" />);
    const nombre = container.querySelector("code")!;
    expect(nombre.getAttribute("title")).toBe("heroe-mosaico-1");
    expect(nombre.className).toContain("truncate");
    expect(container.innerHTML).not.toContain("break-all");
  });

  it("el recuadro recorta lo que se salga para que el botón siempre quede dentro", () => {
    simularTamano(120, 120);
    const { container } = render(conBusqueda(<MarcadorAsset slot="x" relacion="1:1" />));
    expect((container.firstChild as HTMLElement).className).toContain("overflow-hidden");
    expect(screen.getByRole("button").className).toContain("max-w-full");
  });
});
