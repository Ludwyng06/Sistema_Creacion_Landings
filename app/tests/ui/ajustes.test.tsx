// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { PanelAjustes } from "@/componentes/ajustes/PanelAjustes";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

interface Proveedor {
  id: string;
  nombre: string;
  modelo: string;
  tieneClave: boolean;
  estado: string;
  usoHoy: number;
  limiteDiario: number | null;
  porcentaje: number | null;
  ultimoError?: string;
}

const proveedor = (id: string, extra: Partial<Proveedor> = {}): Proveedor => ({
  id,
  nombre: id[0].toUpperCase() + id.slice(1),
  modelo: `${id}-modelo`,
  tieneClave: true,
  estado: "sin-probar",
  usoHoy: 0,
  limiteDiario: 1000,
  porcentaje: 0,
  ...extra,
});

const TAREAS = { objeciones: "groq", landing: "gemini", "prompts-grok": "groq", "corregir-lista-negra": "groq", humanizar: "cerebras", critico: "groq", "mejorar-prompt": "gemini", "juez-duelo": "groq" };

interface Estado {
  proveedores: Proveedor[];
  llamadas: { url: string; metodo: string; cuerpo?: unknown }[];
  probar?: unknown;
}

function simular(estado: Estado) {
  const responder = (cuerpo: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(cuerpo), { status, headers: { "Content-Type": "application/json" } }));
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const metodo = init?.method ?? "GET";
      const cuerpo = init?.body ? JSON.parse(init.body as string) : undefined;
      estado.llamadas.push({ url, metodo, cuerpo });
      if (url === "/api/ajustes/proveedores") return responder({ proveedores: estado.proveedores });
      if (url === "/api/ajustes/probar") return responder(estado.probar ?? { resultados: [] });
      if (url === "/api/ajustes/modo") return responder(metodo === "PUT" ? cuerpo : { modo: "cascada", cascada: ["gemini", "cerebras", "groq", "openrouter"] });
      if (url === "/api/ajustes/tareas") return responder({ tareas: metodo === "PUT" ? cuerpo.tareas : TAREAS });
      if (url.startsWith("/api/uso")) {
        return responder({
          dias: 7,
          porProveedor: [],
          porDiaProveedor: [{ fecha: "2026-09-30", proveedor: "groq", total: 12, errores: 2, msPromedio: 340 }],
          errores: [{ proveedor: "groq", tipo: "limite", cantidad: 2, ultimo: "limite: 429" }],
          avisos: [],
        });
      }
      return responder({ error: "ruta inesperada" }, 404);
    }),
  );
}

let estado: Estado;
beforeEach(() => {
  estado = { proveedores: [], llamadas: [] };
});

const tarjeta = (id: string) => document.querySelector(`[data-proveedor="${id}"]`) as HTMLElement;

describe("/ajustes · proveedores", () => {
  it("sin ninguna clave muestra la ayuda con los pasos y los enlaces, y nunca pide claves", async () => {
    estado.proveedores = [
      proveedor("gemini", { tieneClave: false, estado: "sin-clave" }),
      proveedor("groq", { tieneClave: false, estado: "sin-clave" }),
      proveedor("manual", { limiteDiario: null, estado: "conectado", modelo: "—" }),
    ];
    simular(estado);
    render(<PanelAjustes />);
    expect(await screen.findByText("Todavía no hay ninguna clave")).toBeTruthy();
    expect(screen.getByText(".env.example")).toBeTruthy();
    expect(screen.getAllByText(".env.local").length).toBeGreaterThan(0);
    expect(document.querySelector('a[href="https://aistudio.google.com"]')).toBeTruthy();
    expect(document.querySelector('a[href="https://console.groq.com"]')).toBeTruthy();
    expect(screen.getAllByText("Sin clave").length).toBe(2);
    // ningún campo para escribir claves
    expect(document.querySelector('input[type="password"], input[type="text"], textarea')).toBeNull();
  });

  it("muestra el semáforo, el modelo, la barra de uso y el aviso al 80 %", async () => {
    estado.proveedores = [
      proveedor("gemini", { estado: "conectado", limiteDiario: null, porcentaje: null, usoHoy: 4 }),
      proveedor("groq", { estado: "limite", usoHoy: 850, porcentaje: 85, ultimoError: "limite: groq: límite de peticiones alcanzado (429)." }),
      proveedor("openrouter", { estado: "error", limiteDiario: 50, usoHoy: 10, porcentaje: 20, ultimoError: "auth: clave rechazada." }),
    ];
    simular(estado);
    render(<PanelAjustes />);
    await screen.findByText("Modelo: groq-modelo");
    expect(within(tarjeta("gemini")).getByText("Conectado")).toBeTruthy();
    expect(within(tarjeta("gemini")).getByText(/no tiene un límite diario fijo/)).toBeTruthy();
    const groq = tarjeta("groq");
    expect(within(groq).getByText("Límite alcanzado")).toBeTruthy();
    expect(within(groq).getByRole("progressbar").getAttribute("aria-valuenow")).toBe("85");
    expect(within(groq).getByText(/Vas por el 85 % del límite de hoy/)).toBeTruthy();
    expect(within(groq).getByTestId("ultimo-error").textContent).toContain("429");
    expect(within(tarjeta("openrouter")).getByText("Con error")).toBeTruthy();
    expect(within(tarjeta("openrouter")).queryByText(/Vas por el/)).toBeNull();
  });

  it("«Probar todos» y «Probar» llaman a la API, muestran carga y el resultado en ms", async () => {
    estado.proveedores = [proveedor("gemini"), proveedor("groq")];
    estado.probar = { resultados: [{ id: "gemini", ok: true, ms: 412 }, { id: "groq", ok: false, ms: 90, error: "limite: 429" }] };
    simular(estado);
    render(<PanelAjustes />);
    await screen.findByText("Modelo: gemini-modelo");
    fireEvent.click(screen.getByRole("button", { name: "Probar todos" }));
    expect(await screen.findByText("Respondió bien en 412 ms.")).toBeTruthy();
    expect(screen.getByText(/No respondió \(90 ms\): limite: 429/)).toBeTruthy();
    const llamada = estado.llamadas.find((l) => l.url === "/api/ajustes/probar")!;
    expect(llamada).toMatchObject({ metodo: "POST", cuerpo: {} });

    estado.probar = { resultados: [{ id: "gemini", ok: true, ms: 55 }] };
    fireEvent.click(screen.getByRole("button", { name: "Probar Gemini" }));
    await waitFor(() => expect(screen.getByText("Respondió bien en 55 ms.")).toBeTruthy());
    expect(estado.llamadas.filter((l) => l.url === "/api/ajustes/probar").at(-1)!.cuerpo).toEqual({ proveedor: "gemini" });
  });

  it("si la API falla, muestra el error legible", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "La base de datos no responde." }), { status: 500 })));
    render(<PanelAjustes />);
    expect((await screen.findAllByText("La base de datos no responde.")).length).toBeGreaterThan(0);
  });
});

describe("/ajustes · modo, tareas e historial", () => {
  it("cambia el orden de la cascada con las flechas y guarda con PUT /api/ajustes/modo", async () => {
    estado.proveedores = [proveedor("gemini")];
    simular(estado);
    render(<PanelAjustes />);
    await screen.findByText("Cascada");
    const orden = () => within(screen.getByTestId("orden-cascada")).getAllByRole("listitem").map((li) => li.textContent);
    await waitFor(() => expect(orden()[0]).toContain("Google Gemini"));
    fireEvent.click(screen.getByRole("button", { name: "Bajar Google Gemini" }));
    expect(orden()[0]).toContain("Cerebras");
    fireEvent.click(screen.getByRole("radio", { name: /Simultáneo/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: "OpenRouter" })); // fuera de la cascada
    fireEvent.click(screen.getByRole("button", { name: "Guardar modo" }));
    expect(await screen.findByText(/Guardado: modo simultaneo con Cerebras, Google Gemini, Groq\./)).toBeTruthy();
    const put = estado.llamadas.find((l) => l.url === "/api/ajustes/modo" && l.metodo === "PUT")!;
    expect(put.cuerpo).toEqual({ modo: "simultaneo", cascada: ["cerebras", "gemini", "groq"] });
  });

  it("no deja guardar una cascada vacía", async () => {
    estado.proveedores = [proveedor("gemini")];
    simular(estado);
    render(<PanelAjustes />);
    await screen.findByText("Cascada");
    for (const n of ["Google Gemini", "Cerebras", "Groq", "OpenRouter"]) fireEvent.click(await screen.findByRole("checkbox", { name: n }));
    expect((screen.getByRole("button", { name: "Guardar modo" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Deja al menos un proveedor en la cascada.")).toBeTruthy();
  });

  it("edita la tabla tarea → proveedor con su motivo y la guarda con PUT /api/ajustes/tareas", async () => {
    estado.proveedores = [proveedor("gemini")];
    simular(estado);
    render(<PanelAjustes />);
    const selectLanding = (await screen.findByLabelText("Generar la landing")) as HTMLSelectElement;
    await waitFor(() => expect(selectLanding.value).toBe("gemini"));
    expect(screen.getByText(/Evalúa rápido y con un modelo distinto al creador/)).toBeTruthy();
    fireEvent.change(selectLanding, { target: { value: "cerebras" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar tabla" }));
    expect(await screen.findByText("Tabla guardada.")).toBeTruthy();
    const put = estado.llamadas.find((l) => l.url === "/api/ajustes/tareas" && l.metodo === "PUT")!;
    expect((put.cuerpo as { tareas: Record<string, string> }).tareas).toMatchObject({ landing: "cerebras", critico: "groq" });
    expect(Object.keys((put.cuerpo as { tareas: object }).tareas)).toHaveLength(8);
  });

  it("el historial muestra llamadas, errores y ms promedio por día y proveedor", async () => {
    estado.proveedores = [proveedor("groq")];
    simular(estado);
    render(<PanelAjustes />);
    const tabla = await screen.findByTestId("tabla-uso");
    const fila = within(tabla).getByText("2026-09-30").closest("tr")!;
    expect(fila.textContent).toContain("Groq");
    expect(fila.textContent).toContain("12");
    expect(fila.textContent).toContain("340");
    expect(within(fila).getByText("2")).toBeTruthy();
    expect(screen.getByText(/limite · 2 veces: limite: 429/)).toBeTruthy();
    expect(estado.llamadas.some((l) => l.url === "/api/uso?dias=7")).toBe(true);
  });
});
