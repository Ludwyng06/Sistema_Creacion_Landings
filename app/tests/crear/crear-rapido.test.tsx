// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { CrearRapido } from "@/componentes/crear/CrearRapido";
import { EJEMPLOS_ENCARGO, leerEventoGenerar, limpiarEncargo, type EventoGenerar } from "@/componentes/crear/encargo";
import { generarLanding } from "@/componentes/crear/generar";

const empujar = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: empujar, refresh: () => {} }) }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  empujar.mockClear();
});

const ndjson = (eventos: EventoGenerar[], estado = 200) => new Response(eventos.map((e) => JSON.stringify(e)).join("\n") + "\n", { status: estado });

const ETAPAS_BASE: EventoGenerar[] = [
  { tipo: "etapa", etapa: "intake", mensaje: "Entendiendo tu idea…" },
  { tipo: "faltantes", faltantes: [{ clave: "fecha", pregunta: "¿Qué fecha?" }, { clave: "lugar", pregunta: "¿En qué lugar?" }], detectado: { tipo: "evento", tematica: "espacio" } },
  { tipo: "etapa", etapa: "fuentes", mensaje: "Buscando datos e imágenes…" },
  { tipo: "etapa", etapa: "estrategia", mensaje: "Definiendo la estrategia…" },
  { tipo: "etapa", etapa: "redaccion", mensaje: "Escribiendo sección 1/9…", n: 1, total: 9 },
  { tipo: "etapa", etapa: "critico", mensaje: "Revisando como director creativo…" },
];

/** API de A simulada: responde cada llamada con el guion que le toque y guarda los encargos recibidos. */
function apiGenerar(guiones: EventoGenerar[][]) {
  const recibidos: Record<string, unknown>[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url !== "/api/generar") return new Response("", { status: 404 });
      recibidos.push(JSON.parse(String(init?.body)));
      return ndjson(guiones[Math.min(recibidos.length, guiones.length) - 1]);
    }),
  );
  return recibidos;
}

describe("encargo y eventos", () => {
  it("los 6 ejemplos son los de la demo del docente", () => {
    expect(EJEMPLOS_ENCARGO).toHaveLength(6);
    const textos = EJEMPLOS_ENCARGO.map((e) => e.texto);
    expect(textos).toContain("Landing para una noche de observación de la lluvia de meteoros en Villa de Leyva");
    expect(textos).toContain("Landing para una agencia de tours de auroras");
    expect(new Set(EJEMPLOS_ENCARGO.map((e) => e.tipo))).toEqual(new Set(["evento", "divulgacion", "servicio", "producto"]));
  });

  it("solo viaja lo que la persona eligió o escribió", () => {
    expect(limpiarEncargo({ descripcion: "  hola  ", fotos: [], link: " ", datos: { fecha: " ", precio: "5" } })).toEqual({ descripcion: "hola", datos: { precio: "5" } });
    expect(limpiarEncargo({ descripcion: "x", tipo: "evento", estilo: "minimal", paleta: "noche", fotos: ["a", "b", "c", "d"] }).fotos).toHaveLength(3);
  });

  it("valida los eventos del flujo", () => {
    expect(leerEventoGenerar({ tipo: "etapa", etapa: "intake", mensaje: "x" })).not.toBeNull();
    expect(leerEventoGenerar({ tipo: "etapa", etapa: "otra", mensaje: "x" })).toBeNull();
    expect(leerEventoGenerar({ tipo: "listo", id: "" })).toBeNull();
    expect((leerEventoGenerar({ tipo: "faltantes", faltantes: [1, 2, 3, 4].map((n) => ({ clave: `c${n}`, pregunta: "?" })) }) as { faltantes: unknown[] }).faltantes).toHaveLength(3);
  });
});

describe("cliente de /api/generar", () => {
  it("lee el flujo NDJSON en orden y termina con el id", async () => {
    apiGenerar([[...ETAPAS_BASE, { tipo: "listo", id: "abc" }]]);
    const vistos: string[] = [];
    await generarLanding({ descripcion: "Landing para vender una lámpara de luna" }, (e) => vistos.push(e.tipo === "etapa" ? e.etapa : e.tipo));
    expect(vistos[0]).toBe("intake");
    expect(vistos).toContain("faltantes");
    expect(vistos.indexOf("estrategia")).toBeLessThan(vistos.indexOf("redaccion"));
    expect(vistos.at(-1)).toBe("listo");
  });

  it("si el flujo se corta avisa con un error", async () => {
    apiGenerar([[{ tipo: "etapa", etapa: "intake", mensaje: "x" }]]);
    const vistos: string[] = [];
    await generarLanding({ descripcion: "x" }, (e) => vistos.push(e.tipo));
    expect(vistos.at(-1)).toBe("error");
  });

  it("con un 400 muestra el mensaje del servidor", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "Cuéntanos qué landing quieres." }), { status: 400 })));
    const vistos: EventoGenerar[] = [];
    await generarLanding({ descripcion: "x" }, (e) => vistos.push(e));
    expect(vistos).toEqual([{ tipo: "error", mensaje: "Cuéntanos qué landing quieres." }]);
  });
});

describe("/crear de un solo campo", () => {
  it("muestra la pregunta, los 6 ejemplos y los chips en Auto; los avanzados y el modo experto", () => {
    render(<CrearRapido />);
    expect(screen.getByLabelText("¿Qué landing quieres?")).toBeTruthy();
    expect(document.querySelectorAll("[data-ejemplo]")).toHaveLength(6);
    for (const grupo of ["Tipo", "Estilo", "Paleta"]) {
      expect(within(screen.getByRole("group", { name: grupo })).getByRole("button", { name: "Auto" }).getAttribute("aria-pressed")).toBe("true");
    }
    expect(screen.getByText("Ajustes avanzados").closest("details")?.open).toBe(false);
    expect(screen.getByRole("link", { name: /Modo experto/ }).getAttribute("href")).toBe("/crear?modo=experto");
  });

  it("pulsar un ejemplo llena el campo", () => {
    render(<CrearRapido />);
    fireEvent.click(document.querySelector("[data-ejemplo='asteroides']")!);
    expect((screen.getByLabelText("¿Qué landing quieres?") as HTMLTextAreaElement).value).toContain("asteroides");
  });

  it("sin descripción avisa y no genera; un link malo también", () => {
    const recibidos = apiGenerar([[{ tipo: "listo", id: "x" }]]);
    render(<CrearRapido />);
    fireEvent.click(screen.getByRole("button", { name: "Crear mi landing" }));
    expect(screen.getByRole("alert").textContent).toMatch(/al menos una frase/);
    fireEvent.change(screen.getByLabelText("¿Qué landing quieres?"), { target: { value: "Landing para vender una lámpara de luna" } });
    fireEvent.click(screen.getByRole("button", { name: /Fotos o link/ }));
    fireEvent.change(screen.getByLabelText(/Link del producto/), { target: { value: "javascript:alert(1)" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear mi landing" }));
    expect(screen.getByText(/no parece válido/)).toBeTruthy();
    expect(recibidos).toHaveLength(0);
  });

  it("manda el encargo con lo elegido y abre el visor al terminar", async () => {
    const recibidos = apiGenerar([[{ tipo: "etapa", etapa: "intake", mensaje: "Entendiendo tu idea…" }, { tipo: "listo", id: "landing-1" }]]);
    render(<CrearRapido />);
    fireEvent.change(screen.getByLabelText("¿Qué landing quieres?"), { target: { value: "Landing para una agencia de tours de auroras" } });
    fireEvent.click(screen.getByRole("button", { name: "Minimal" }));
    fireEvent.click(screen.getByRole("button", { name: "Paleta Noche" }));
    fireEvent.click(screen.getByRole("button", { name: "Crear mi landing" }));
    await waitFor(() => expect(empujar).toHaveBeenCalledWith("/ver/landing-1"));
    expect(recibidos[0]).toMatchObject({ descripcion: "Landing para una agencia de tours de auroras", estilo: "minimal", paleta: "noche" });
    expect(recibidos[0]).not.toHaveProperty("tipo");
  });

  it("los faltantes salen como chips y se pueden ignorar", async () => {
    const recibidos = apiGenerar([[...ETAPAS_BASE, { tipo: "listo", id: "landing-1" }]]);
    render(<CrearRapido />);
    fireEvent.change(screen.getByLabelText("¿Qué landing quieres?"), { target: { value: "Landing para ver en vivo el próximo lanzamiento de cohete con amigos" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear mi landing" }));
    await waitFor(() => expect(empujar).toHaveBeenCalledWith("/ver/landing-1"));
    expect(recibidos).toHaveLength(1);
  });

  it("muestra los chips mientras se escribe y, si se llenó alguno, regenera una vez con esos datos", async () => {
    let soltar: () => void = () => {};
    const parada = new Promise<void>((r) => (soltar = r));
    const recibidos: Record<string, unknown>[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        recibidos.push(JSON.parse(String(init?.body)));
        if (recibidos.length === 1) {
          // La primera pasada se queda esperando en el último paso para dar tiempo a llenar el chip.
          const codificador = new TextEncoder();
          return new Response(
            new ReadableStream({
              async start(c) {
                for (const e of ETAPAS_BASE.slice(0, 2)) c.enqueue(codificador.encode(`${JSON.stringify(e)}\n`));
                await parada;
                c.enqueue(codificador.encode(`${JSON.stringify({ tipo: "listo", id: "landing-1" })}\n`));
                c.close();
              },
            }),
          );
        }
        return ndjson([{ tipo: "etapa", etapa: "intake", mensaje: "Entendiendo tu idea…" }, { tipo: "listo", id: "landing-2" }]);
      }),
    );
    render(<CrearRapido />);
    fireEvent.change(screen.getByLabelText("¿Qué landing quieres?"), { target: { value: "Landing para ver en vivo el próximo lanzamiento de cohete con amigos" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear mi landing" }));
    expect(await screen.findByText("¿Qué fecha?")).toBeTruthy();
    expect(screen.getByText("¿En qué lugar?")).toBeTruthy();
    fireEvent.change(document.querySelector("[data-faltante='fecha']")!, { target: { value: "14 de octubre" } });
    soltar();
    await waitFor(() => expect(empujar).toHaveBeenCalledWith("/ver/landing-2"));
    expect(recibidos).toHaveLength(2);
    expect(recibidos[1]).toMatchObject({ datos: { fecha: "14 de octubre" } });
  });

  it("si el generador falla muestra el error y deja volver", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "Sin cupo de IA" }), { status: 503 })));
    render(<CrearRapido />);
    fireEvent.change(screen.getByLabelText("¿Qué landing quieres?"), { target: { value: "Landing para vender una lámpara de luna" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear mi landing" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Sin cupo de IA");
    fireEvent.click(screen.getByRole("button", { name: "Volver y reintentar" }));
    expect(screen.getByLabelText("¿Qué landing quieres?")).toBeTruthy();
    expect(empujar).not.toHaveBeenCalled();
  });
  it("con el crítico pendiente o secciones sin cuota se queda en /crear con el aviso y no pierde la landing", async () => {
    apiGenerar([[{ tipo: "etapa", etapa: "intake", mensaje: "Entendiendo tu idea…" }, { tipo: "listo", id: "landing-9", criticoPendiente: true, seccionesPorCompletar: ["faq", "oferta"] } as EventoGenerar]]);
    render(<CrearRapido />);
    fireEvent.change(screen.getByLabelText("¿Qué landing quieres?"), { target: { value: "Landing para una agencia de tours de auroras" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear mi landing" }));
    expect(await screen.findByText(/Tu landing está guardada/)).toBeTruthy();
    expect(screen.getByText(/2 secciones quedaron por completar/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reintentar el crítico" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ver la landing" }).getAttribute("href")).toBe("/ver/landing-9");
    expect(empujar).not.toHaveBeenCalled();
  });
});
