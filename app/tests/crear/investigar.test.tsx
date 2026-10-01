// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { BORRADOR_VACIO, type BorradorBrief } from "@/componentes/crear/borrador";
import { PanelInvestigar } from "@/componentes/crear/PanelInvestigar";
import { neutralizarCifras, textoParaBrief, usoDelMes, type RespuestaInvestigar } from "@/componentes/crear/investigar";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const fuente = (sitio: string) => [{ url: `https://${sitio}/nota`, sitio }];

const RESPUESTA: RespuestaInvestigar = {
  sugerencias: {
    beneficios: [
      { texto: "Ayuda a mantener la espalda recta", fuentes: fuente("saludtotal.co"), tieneCifra: false },
      { texto: "Dura 8 horas con una carga", fuentes: fuente("tecnoreseñas.com"), tieneCifra: true },
    ],
    objeciones: [{ texto: "Puede incomodar bajo la ropa", fuentes: fuente("foro.co"), tieneCifra: false }],
    preguntas: [{ texto: "¿Se puede usar todo el día?", fuentes: fuente("preguntas.co"), tieneCifra: false }],
  },
  consultas: ["corrector de postura beneficios", "corrector de postura opiniones"],
  usadas: 3,
  cuota: { usadasMes: 12, limiteMes: 250 },
  avisos: [],
  borrador: {},
  identificacion: null,
  precioReferencia: null,
};

function respuestaJson(cuerpo: unknown, estado = 200): Response {
  return new Response(JSON.stringify(cuerpo), { status: estado, headers: { "Content-Type": "application/json" } });
}

function Anfitrion({ inicial }: { inicial?: Partial<BorradorBrief> }) {
  const [brief, setBrief] = useState<BorradorBrief>({ ...BORRADOR_VACIO, nombre: "Corrector de postura", categoria: "salud-y-bienestar", ...inicial });
  return (
    <>
      <PanelInvestigar brief={brief} onCambio={(c) => setBrief((b) => ({ ...b, ...c }))} />
      <output data-testid="beneficios">{JSON.stringify(brief.beneficios)}</output>
      <output data-testid="objeciones">{JSON.stringify(brief.objeciones)}</output>
    </>
  );
}

async function investigar(respuesta: Response | (() => Response) = () => respuestaJson(RESPUESTA)) {
  const fetchSimulado = vi.fn(async () => (typeof respuesta === "function" ? respuesta() : respuesta));
  vi.stubGlobal("fetch", fetchSimulado);
  fireEvent.click(screen.getByRole("button", { name: "Investigar el producto" }));
  return fetchSimulado;
}

const lista = (id: string) => JSON.parse(screen.getByTestId(id).textContent ?? "[]") as string[];

describe("reglas de fidelidad", () => {
  it("las cifras entran como [COMPLETAR]", () => {
    expect(neutralizarCifras("Dura 8 horas y cuesta $99.000", true)).toBe("Dura [COMPLETAR] horas y cuesta [COMPLETAR]");
    expect(neutralizarCifras("4,8 estrellas de 1.200 opiniones", true)).toBe("[COMPLETAR] de [COMPLETAR]");
    expect(textoParaBrief("Ayuda a la espalda", false)).toBe("Ayuda a la espalda");
    expect(textoParaBrief("Es muy duradero", true)).toBe("Es muy duradero [COMPLETAR]");
  });

  it("acepta el uso del mes como número o como objeto", () => {
    expect(usoDelMes({ usadasMes: 12, limiteMes: 250 })).toEqual({ usadas: 12, limite: 250 });
    expect(usoDelMes(null)).toBeNull();
    expect(usoDelMes(undefined)).toBeNull();
  });
});

describe("botón «Investigar el producto»", () => {
  it("está desactivado sin nombre y categoría", () => {
    render(<Anfitrion inicial={{ nombre: "", categoria: "" }} />);
    expect((screen.getByRole("button", { name: "Investigar el producto" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("muestra las consultas en curso mientras busca y el contador al terminar", async () => {
    render(<Anfitrion />);
    let terminar: (r: Response) => void = () => {};
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((r) => (terminar = r))));
    fireEvent.click(screen.getByRole("button", { name: "Investigar el producto" }));
    expect(await screen.findByText("Corrector de postura beneficios")).toBeTruthy();
    expect(document.querySelector("[data-panel-investigar] [role=status]")?.textContent).toContain("Buscando");
    terminar(respuestaJson(RESPUESTA));
    expect(await screen.findByText(/12 de 250 búsquedas este mes/)).toBeTruthy();
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["Beneficios", "Objeciones", "Preguntas frecuentes"]);
  });
});

describe("agregar, editar y descartar", () => {
  it("agrega un beneficio al brief con su fuente visible", async () => {
    render(<Anfitrion />);
    await investigar();
    const tarjeta = (await screen.findByText("Ayuda a mantener la espalda recta")).closest("li")!;
    expect(within(tarjeta).getByRole("link", { name: "saludtotal.co" }).getAttribute("href")).toBe("https://saludtotal.co/nota");
    fireEvent.click(within(tarjeta).getByRole("button", { name: "Agregar al brief" }));
    expect(lista("beneficios")).toEqual(["Ayuda a mantener la espalda recta", "", ""]);
    expect(within(tarjeta).getByText("Agregada al brief")).toBeTruthy();
  });

  it("edita antes de agregar", async () => {
    render(<Anfitrion />);
    await investigar();
    const tarjeta = (await screen.findByText("Puede incomodar bajo la ropa")).closest("li")!;
    fireEvent.click(within(tarjeta).getByRole("button", { name: "Editar" }));
    fireEvent.change(within(tarjeta).getByLabelText("Editar sugerencia"), { target: { value: "Puede incomodar al sentarse" } });
    fireEvent.click(within(tarjeta).getByRole("button", { name: "Agregar al brief" }));
    expect(lista("objeciones")).toEqual(["Puede incomodar al sentarse"]);
  });

  it("descarta sin tocar el brief", async () => {
    render(<Anfitrion />);
    await investigar();
    const tarjeta = (await screen.findByText("Puede incomodar bajo la ropa")).closest("li")!;
    fireEvent.click(within(tarjeta).getByRole("button", { name: "Descartar" }));
    expect(screen.queryByText("Puede incomodar bajo la ropa")).toBeNull();
    expect(lista("objeciones")).toEqual([]);
  });

  it("una pregunta frecuente va a las objeciones", async () => {
    render(<Anfitrion />);
    await investigar();
    const tarjeta = (await screen.findByText("¿Se puede usar todo el día?")).closest("li")!;
    fireEvent.click(within(tarjeta).getByRole("button", { name: "Agregar al brief" }));
    expect(lista("objeciones")).toEqual(["¿Se puede usar todo el día?"]);
  });

  it("no pasa de 5 beneficios y avisa que la lista está llena", async () => {
    render(<Anfitrion inicial={{ beneficios: ["uno", "dos", "tres", "cuatro", "cinco"] }} />);
    await investigar();
    const tarjeta = (await screen.findByText("Ayuda a mantener la espalda recta")).closest("li")!;
    fireEvent.click(within(tarjeta).getByRole("button", { name: "Agregar al brief" }));
    expect(lista("beneficios")).toHaveLength(5);
    expect(within(tarjeta).getByRole("alert").textContent).toContain("Ya tienes 5 beneficios");
    expect(within(tarjeta).queryByText("Agregada al brief")).toBeNull();
  });

  it("una sugerencia con cifra lleva la marca y entra con el número como [COMPLETAR]", async () => {
    render(<Anfitrion />);
    await investigar();
    const tarjeta = (await screen.findByText("Dura 8 horas con una carga")).closest("li")!;
    expect(within(tarjeta).getByText(/Tiene una cifra: verifícala con tu proveedor/)).toBeTruthy();
    fireEvent.click(within(tarjeta).getByRole("button", { name: "Agregar al brief" }));
    expect(lista("beneficios")[0]).toBe("Dura [COMPLETAR] horas con una carga");
  });
});

describe("sin clave y errores", () => {
  it("503: aviso tranquilo con enlace a /ajustes", async () => {
    render(<Anfitrion />);
    await investigar(() => respuestaJson({ error: "Falta SERPAPI_API_KEY" }, 503));
    const aviso = await waitFor(() => {
      const el = document.querySelector("[data-sin-clave]");
      if (!el) throw new Error("sin aviso");
      return el as HTMLElement;
    });
    expect(aviso.textContent).toContain("La investigación es opcional. Agrega SERPAPI_API_KEY en app/.env.local para usarla.");
    expect(within(aviso).getByRole("link", { name: "Ir a Ajustes" }).getAttribute("href")).toBe("/ajustes");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("otro error se muestra como alerta", async () => {
    render(<Anfitrion />);
    await investigar(() => respuestaJson({ error: "SerpAPI no respondió a tiempo." }, 502));
    expect((await screen.findByRole("alert")).textContent).toBe("SerpAPI no respondió a tiempo.");
  });
});
