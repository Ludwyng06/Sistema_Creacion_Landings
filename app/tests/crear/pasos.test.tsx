// @vitest-environment jsdom
import { useReducer } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { EventoConstruccion, ResultadoValidador } from "@/lib/contratos";
import { deBrief } from "@/componentes/crear/borrador";
import { EJEMPLOS } from "@/datos/ejemplos";
import { ESTADO_INICIAL, reducir, type RespuestaPrompt } from "@/componentes/crear/estado";
import { PasoBrief } from "@/componentes/crear/PasoBrief";
import { PasoConstruir } from "@/componentes/crear/PasoConstruir";
import { PasoPrompt } from "@/componentes/crear/PasoPrompt";
import { PasoTecnicas } from "@/componentes/crear/PasoTecnicas";
import { MENSAJE_DOC, VistaPreviaLanding } from "@/componentes/crear/VistaPreviaLanding";
import { combinar } from "@/lib/tecnicas/combinador";
import { tirarSemilla, tokensParaBrief } from "@/lib/tecnicas/semillas";
import { landingEjemplo } from "../fixtures/landing-ejemplo";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const BRIEF_EJEMPLO = EJEMPLOS[0].brief;
const brief = deBrief(BRIEF_EJEMPLO);

function respuestaReal(tecnicas: Parameters<typeof combinar>[1] = ["semilla", "ambicioso"]): RespuestaPrompt {
  const { semilla } = tirarSemilla(11, 3);
  return {
    prompt: combinar(BRIEF_EJEMPLO, tecnicas, semilla),
    texto: "prompt completo",
    semilla,
    tokens: tokensParaBrief(semilla, BRIEF_EJEMPLO),
  };
}

function respuestaJson(cuerpo: unknown, estado = 200): Response {
  return new Response(JSON.stringify(cuerpo), { status: estado, headers: { "Content-Type": "application/json" } });
}

/** Flujo NDJSON con cada trozo como un chunk; el lector puede recibir líneas partidas. */
function respuestaNdjson(trozos: string[]): Response {
  const codificador = new TextEncoder();
  return new Response(
    new ReadableStream<Uint8Array>({
      async start(c) {
        for (const t of trozos) {
          c.enqueue(codificador.encode(t));
          await new Promise((r) => setTimeout(r, 0));
        }
        c.close();
      },
    }),
    { status: 200, headers: { "Content-Type": "application/x-ndjson" } },
  );
}

const linea = (e: EventoConstruccion) => JSON.stringify(e) + "\n";

const SALUD: ResultadoValidador[] = [
  { id: "esquema", estado: "verde", problemas: [] },
  { id: "estructura", estado: "verde", problemas: [] },
  { id: "anti-split", estado: "verde", problemas: [] },
  { id: "anti-split-render", estado: "pendiente", problemas: [] },
  { id: "lista-negra", estado: "verde", problemas: [] },
  { id: "datos", estado: "amarillo", problemas: [{ ruta: "secciones.3.ajustes.precio", mensaje: "Falta el precio del brief" }] },
  { id: "a11y", estado: "verde", problemas: [] },
  { id: "efectos", estado: "rojo", problemas: [{ ruta: "secciones.0.efectos", mensaje: "Efecto fuera del catálogo" }] },
];

const DOC = { ...landingEjemplo, critica: { puntaje: 8.6, porCriterio: [], problemas: [], correcciones: [] } };

describe("Paso 1 · brief", () => {
  function Arnes() {
    const [estado, despachar] = useReducer(reducir, ESTADO_INICIAL);
    return (
      <PasoBrief
        brief={estado.brief}
        onCambio={(cambios) => despachar({ tipo: "editar-brief", cambios })}
        onEjemplo={(x) => despachar({ tipo: "cargar-ejemplo", brief: deBrief(x.brief), tecnicas: x.tecnicas, numeroSemilla: x.numeroSemilla })}
      />
    );
  }

  it("«Rellenar ejemplo» ofrece los 5 briefs de @/datos/ejemplos y carga el elegido sin errores", () => {
    render(<Arnes />);
    const selector = screen.getByLabelText("Ejemplo") as HTMLSelectElement;
    expect(selector.options).toHaveLength(EJEMPLOS.length);
    expect(EJEMPLOS).toHaveLength(5);
    for (const ejemplo of EJEMPLOS) {
      fireEvent.change(selector, { target: { value: ejemplo.id } });
      fireEvent.click(screen.getByRole("button", { name: "Rellenar ejemplo" }));
      expect((screen.getByLabelText(/nombre del producto/i) as HTMLInputElement).value).toBe(ejemplo.brief.nombre);
      expect(screen.queryAllByRole("alert"), ejemplo.id).toHaveLength(0);
    }
  });

  it("muestra el precio formateado con Intl.NumberFormat según la moneda", () => {
    render(<Arnes />);
    fireEvent.change(screen.getByLabelText(/^precio \*/i), { target: { value: "129000" } });
    expect(document.querySelector("[data-vista-precio]")?.textContent).toMatch(/129\.000/);
    fireEvent.change(screen.getByLabelText(/moneda/i), { target: { value: "USD" } });
    expect(document.querySelector("[data-vista-precio]")?.textContent).toMatch(/US\$|USD|\$/);
  });

  it("valida al salir del campo y escribe el error bajo él", () => {
    render(<Arnes />);
    const nombre = screen.getByLabelText(/nombre del producto/i);
    fireEvent.change(nombre, { target: { value: "Algo" } });
    fireEvent.change(nombre, { target: { value: "" } });
    expect(nombre.getAttribute("aria-invalid")).toBeNull();
    fireEvent.blur(nombre);
    expect(nombre.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("Escribe el nombre del producto.")).toBeTruthy();
    expect(nombre.getAttribute("aria-describedby")).toContain("brief-nombre-error");
  });

  it("los beneficios se pueden agregar, quitar y reordenar con botones, entre 3 y 5", () => {
    render(<Arnes />);
    fireEvent.click(screen.getByRole("button", { name: "Rellenar ejemplo" }));
    const primero = screen.getByLabelText("Beneficio 1") as HTMLInputElement;
    const original = primero.value;
    fireEvent.click(screen.getByRole("button", { name: "Bajar beneficio 1" }));
    expect((screen.getByLabelText("Beneficio 2") as HTMLInputElement).value).toBe(original);
    fireEvent.click(screen.getByRole("button", { name: "Agregar beneficio" }));
    fireEvent.click(screen.getByRole("button", { name: "Agregar beneficio" }));
    expect(screen.getByRole("button", { name: "Agregar beneficio" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getAllByLabelText(/^Beneficio \d$/)).toHaveLength(5);
    fireEvent.click(screen.getByRole("button", { name: "Quitar beneficio 5" }));
    fireEvent.click(screen.getByRole("button", { name: "Quitar beneficio 4" }));
    expect(screen.getByRole("button", { name: "Quitar beneficio 3" }).hasAttribute("disabled")).toBe(true);
  });

  it("«Proponer 5 con IA» agrega las objeciones como editables", async () => {
    const fetchFalso = vi.fn().mockResolvedValue(respuestaJson({ objeciones: ["¿Se nota?", "¿Cuánto dura?", "¿Y si no me sirve?", "¿Es cómodo?", "¿Llega rápido?"] }));
    vi.stubGlobal("fetch", fetchFalso);
    render(<Arnes />);
    fireEvent.click(screen.getByRole("button", { name: "Rellenar ejemplo" }));
    fireEvent.click(screen.getByRole("button", { name: "Proponer 5 con IA" }));
    const previas = EJEMPLOS[0].brief.objeciones.length;
    await waitFor(() => expect(screen.getAllByLabelText(/^Objeción \d+$/)).toHaveLength(previas + 5));
    const valores = screen.getAllByLabelText(/^Objeción \d+$/).map((i) => (i as HTMLInputElement).value);
    expect(valores).toEqual(expect.arrayContaining(["¿Se nota?", "¿Llega rápido?"]));
    expect(fetchFalso.mock.calls[0][0]).toBe("/api/objeciones");
  });

  it("si /api/objeciones responde 404 muestra un error legible", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuestaJson({}, 404)));
    render(<Arnes />);
    fireEvent.click(screen.getByRole("button", { name: "Rellenar ejemplo" }));
    fireEvent.click(screen.getByRole("button", { name: "Proponer 5 con IA" }));
    expect((await screen.findByText(/todavía no está disponible/i)).getAttribute("role")).toBe("alert");
  });

  it("recuerda que sin testimonios reales la landing mostrará [COMPLETAR]", () => {
    render(<Arnes />);
    expect(screen.getByText(/la landing mostrará \[COMPLETAR\]/)).toBeTruthy();
  });

  it("la intensidad «De otro mundo» viene marcada por defecto", () => {
    render(<Arnes />);
    expect((screen.getByRole("radio", { name: /de otro mundo/i }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getAllByRole("radio", { name: /sobria|audaz|de otro mundo/i })).toHaveLength(3);
  });
});

describe("Paso 2 · técnicas", () => {
  it("muestra las 8 técnicas con su número, fase y descripción", () => {
    render(<PasoTecnicas tecnicas={[]} onCambio={() => {}} />);
    expect(screen.getAllByRole("checkbox")).toHaveLength(8);
    expect(screen.getAllByText(/^(Descubrir|Definir|Entregar)$/).length).toBe(8);
  });

  it("la técnica 7 aparece siempre activa y no se puede desmarcar", () => {
    render(<PasoTecnicas tecnicas={[]} onCambio={() => {}} />);
    const negativas = screen.getAllByRole("checkbox").find((c) => (c as HTMLInputElement).disabled) as HTMLInputElement;
    expect(negativas.checked).toBe(true);
    expect(screen.getByText("Siempre activa")).toBeTruthy();
  });

  it("sin selección avisa que se usará Esencial; el botón lo preselecciona", () => {
    const cambios: string[][] = [];
    render(<PasoTecnicas tecnicas={[]} onCambio={(t) => cambios.push(t)} />);
    expect(screen.getByText(/usaremos el perfil Esencial/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Usar perfil Esencial" }));
    expect(cambios[0]).toEqual(expect.arrayContaining(["ambicioso", "sustractivo", "negativas"]));
  });

  it("muestra el orden de aplicación como chips numerados", () => {
    render(<PasoTecnicas tecnicas={["critico", "semilla", "ambicioso"]} onCambio={() => {}} />);
    const chips = document.querySelectorAll("[data-orden-tecnicas] li");
    expect(chips.length).toBe(4);
    expect(chips[0].textContent).toMatch(/^1/);
    expect(chips[chips.length - 1].textContent).toMatch(/^4/);
  });
});

describe("Paso 3 · prompt", () => {
  function Arnes({ inicial = null as RespuestaPrompt | null }) {
    const [estado, despachar] = useReducer(reducir, { ...ESTADO_INICIAL, brief, paso: 3 as const, prompt: inicial });
    return (
      <PasoPrompt
        brief={estado.brief}
        tecnicas={estado.tecnicas}
        numeroSemilla={estado.numeroSemilla}
        respuesta={estado.prompt}
        mejorado={estado.promptMejorado}
        onPrompt={(prompt) => despachar({ tipo: "prompt", prompt })}
        onOtraSemilla={(numero) => despachar({ tipo: "otra-semilla", numero })}
        onUsarMejorado={(prompt) => despachar({ tipo: "usar-mejorado", prompt })}
        onDescartarMejorado={() => despachar({ tipo: "descartar-mejorado" })}
        onConstruir={() => {}}
      />
    );
  }

  it("pide /api/prompt y pinta los 4 bloques y la tabla de aportes", async () => {
    const r = respuestaReal();
    const fetchFalso = vi.fn().mockResolvedValue(respuestaJson(r));
    vi.stubGlobal("fetch", fetchFalso);
    const { container } = render(<Arnes />);
    await waitFor(() => expect(container.querySelector("[data-bloques]")).not.toBeNull());

    expect(fetchFalso.mock.calls[0][0]).toBe("/api/prompt");
    const cuerpo = JSON.parse(fetchFalso.mock.calls[0][1].body);
    expect(cuerpo.brief.nombre).toBe(brief.nombre);

    for (const bloque of ["rol", "tarea", "contexto", "formato"]) {
      expect(container.querySelector(`[data-bloque="${bloque}"]`), bloque).not.toBeNull();
    }
    expect(screen.getByRole("heading", { name: "Rol" })).toBeTruthy();
    expect(container.querySelectorAll("[data-aporte]")).toHaveLength(r.prompt.aportes.length);
    expect(r.prompt.aportes.length).toBeGreaterThan(0);
  });

  it("los colores de los bloques salen de tokens de la app, no de valores fijos", () => {
    const { container } = render(<Arnes inicial={respuestaReal()} />);
    const html = container.innerHTML;
    for (const token of ["bg-rol-suave", "bg-tarea-suave", "bg-contexto-suave", "bg-formato-suave"]) {
      expect(html).toContain(token);
    }
    // El texto del prompt trae hex de la semilla (es contenido); lo que no puede tener hex son las clases.
    expect(html).not.toMatch(/class="[^"]*#[0-9a-fA-F]{3,6}/);
  });

  it("al pasar el cursor por una fila se resalta su fragmento en el bloque", () => {
    const r = respuestaReal();
    const aporte = r.prompt.aportes.find((a) => r.prompt[a.bloque].includes(a.texto.trim()));
    expect(aporte, "hay un aporte cuyo texto está en su bloque").toBeTruthy();
    const { container } = render(<Arnes inicial={r} />);
    const filas = Array.from(container.querySelectorAll("[data-aporte]"));
    const fila = filas[r.prompt.aportes.indexOf(aporte!)];
    expect(container.querySelector("mark")).toBeNull();
    fireEvent.mouseEnter(fila);
    expect(container.querySelector(`[data-bloque="${aporte!.bloque}"] mark`)?.textContent).toBe(aporte!.texto.trim());
    fireEvent.mouseLeave(fila);
    expect(container.querySelector("mark")).toBeNull();
    fireEvent.focus(fila);
    expect(container.querySelector("mark")).not.toBeNull();
  });

  it("muestra el chip de la semilla, su paleta y «Otra semilla» pide un nuevo prompt", async () => {
    const primera = respuestaReal();
    const segunda = respuestaReal(["semilla"]);
    const fetchFalso = vi.fn().mockResolvedValueOnce(respuestaJson(primera)).mockResolvedValueOnce(respuestaJson(segunda));
    vi.stubGlobal("fetch", fetchFalso);
    const { container } = render(<Arnes />);
    await waitFor(() => expect(container.querySelector("[data-semilla]")).not.toBeNull());
    expect(container.querySelector("[data-semilla]")?.textContent).toContain(primera.semilla.estilo);
    expect(container.querySelectorAll('[aria-label="Paleta de la semilla"] li')).toHaveLength(7);

    fireEvent.click(screen.getByRole("button", { name: "Otra semilla" }));
    await waitFor(() => expect(fetchFalso).toHaveBeenCalledTimes(2));
    expect(typeof JSON.parse(fetchFalso.mock.calls[1][1].body).numeroSemilla).toBe("number");
  });

  it("«Copiar prompt» copia el texto completo", async () => {
    const escribir = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText: escribir } });
    const r = respuestaReal();
    render(<Arnes inicial={r} />);
    fireEvent.click(screen.getByRole("button", { name: "Copiar prompt" }));
    await waitFor(() => expect(escribir).toHaveBeenCalled());
    const copiado: string = escribir.mock.calls[0][0];
    for (const bloque of ["rol", "tarea", "contexto", "formato"] as const) expect(copiado).toContain(r.prompt[bloque].slice(0, 30));
  });

  it("«Mejorar» muestra el diff por bloque y los cambios; «Usar mejorado» lo deja en uso", async () => {
    const r = respuestaReal();
    const mejorado = { ...r.prompt, rol: r.prompt.rol + "\nTrabajas con criterio de conversión." };
    const fetchFalso = vi.fn().mockResolvedValue(respuestaJson({ prompt: mejorado, cambios: ["Se reforzó el rol"] }));
    vi.stubGlobal("fetch", fetchFalso);
    const { container } = render(<Arnes inicial={r} />);
    fireEvent.click(screen.getByRole("button", { name: "Mejorar" }));
    await screen.findByRole("heading", { name: "Prompt mejorado" });
    expect(screen.getByText("Se reforzó el rol")).toBeTruthy();
    expect(container.querySelector('[data-diff="rol"]')?.textContent).toContain("Trabajas con criterio de conversión.");
    expect(container.querySelector('[data-diff="tarea"]')).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Usar mejorado" }));
    expect(screen.getByText("Prompt mejorado en uso")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Prompt mejorado" })).toBeNull();
  });

  it("«Descartar» cierra el diff sin cambiar el prompt", async () => {
    const r = respuestaReal();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuestaJson({ prompt: { ...r.prompt, rol: "Otro rol" }, cambios: [] })));
    render(<Arnes inicial={r} />);
    fireEvent.click(screen.getByRole("button", { name: "Mejorar" }));
    await screen.findByRole("heading", { name: "Prompt mejorado" });
    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
    expect(screen.queryByRole("heading", { name: "Prompt mejorado" })).toBeNull();
    expect(screen.queryByText("Prompt mejorado en uso")).toBeNull();
  });

  it("si /api/prompt falla muestra el error y permite reintentar", async () => {
    const fetchFalso = vi
      .fn()
      .mockResolvedValueOnce(respuestaJson({ error: "El brief no es válido" }, 400))
      .mockResolvedValueOnce(respuestaJson(respuestaReal()));
    vi.stubGlobal("fetch", fetchFalso);
    const { container } = render(<Arnes />);
    expect((await screen.findByText("El brief no es válido")).closest("[role=alert]")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(container.querySelector("[data-bloques]")).not.toBeNull());
  });
});

describe("Paso 4 · construir", () => {
  const propiedades = () => ({
    brief,
    tecnicas: [] as never[],
    numeroSemilla: undefined,
    prompt: respuestaReal().prompt,
    autoIniciar: true,
    onAbrirEditor: vi.fn(),
  });

  it("la secuencia tarea → resultado pinta las filas, los chips de salud y la vista previa", async () => {
    const eventos = [
      linea({ tipo: "tarea", tarea: "landing", estado: "en-curso" }),
      linea({ tipo: "tarea", tarea: "prompts-grok", estado: "en-curso" }),
      linea({ tipo: "tarea", tarea: "landing", estado: "ok", proveedor: "gemini", ms: 4200 }),
      linea({ tipo: "tarea", tarea: "critico", estado: "omitida" }),
      linea({ tipo: "resultado", doc: DOC, salud: SALUD, vueltasCritico: 1, proveedores: { landing: "gemini" }, avisos: ["Se corrigió un texto"] }),
    ];
    // Un chunk parte una línea por la mitad para probar la lectura del flujo.
    const todo = eventos.join("");
    const trozos = [todo.slice(0, 30), todo.slice(30, 200), todo.slice(200)];
    const fetchFalso = vi.fn().mockResolvedValue(respuestaNdjson(trozos));
    vi.stubGlobal("fetch", fetchFalso);

    const { container } = render(<PasoConstruir {...propiedades()} />);
    await screen.findByRole("heading", { name: "Tu landing está lista" });

    expect(fetchFalso.mock.calls[0][0]).toBe("/api/construir");
    const cuerpo = JSON.parse(fetchFalso.mock.calls[0][1].body);
    expect(cuerpo.brief.nombre).toBe(brief.nombre);
    expect(cuerpo.prompt.rol).toBeTruthy();

    const filas = container.querySelectorAll("[data-progreso] li");
    expect(Array.from(filas).map((f) => f.getAttribute("data-tarea"))).toEqual(["landing", "prompts-grok", "critico"]);
    const landing = container.querySelector('[data-tarea="landing"]')!;
    expect(landing.getAttribute("data-estado")).toBe("ok");
    expect(landing.textContent).toContain("gemini");
    expect(landing.textContent).toContain("4,2 s");
    expect(container.querySelector('[data-tarea="prompts-grok"]')?.getAttribute("data-estado")).toBe("en-curso");
    expect(container.querySelector('[data-tarea="critico"]')?.getAttribute("data-estado")).toBe("omitida");

    const chips = container.querySelectorAll("[data-salud] li");
    expect(chips).toHaveLength(8);
    expect(container.querySelector('[data-validador="datos"]')?.getAttribute("data-estado")).toBe("amarillo");
    expect(container.querySelector('[data-validador="efectos"]')?.textContent).toMatch(/Error/);
    expect(container.querySelector("[data-puntaje]")?.textContent).toContain("8,6");
    expect(container.querySelector("[data-avisos]")?.textContent).toContain("Se corrigió un texto");
    expect(screen.getByText(/Efecto fuera del catálogo/)).toBeTruthy();

    const marco = container.querySelector("iframe")!;
    expect(marco.getAttribute("title")).toMatch(/390/);
    fireEvent.click(screen.getByRole("button", { name: /1280 px/ }));
    expect(container.querySelector("iframe")!.getAttribute("title")).toMatch(/1280/);
  });

  it("el progreso vive en una región aria-live", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuestaNdjson([linea({ tipo: "tarea", tarea: "landing", estado: "en-curso" })])));
    const { container } = render(<PasoConstruir {...propiedades()} />);
    await waitFor(() => expect(container.querySelector("[data-progreso]")).not.toBeNull());
    expect(container.querySelector('[aria-live="polite"][aria-label="Progreso de la construcción"]')).not.toBeNull();
  });

  it("la vista previa manda el documento al iframe cuando carga", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(respuestaNdjson([linea({ tipo: "resultado", doc: DOC, salud: SALUD, vueltasCritico: 0, proveedores: {}, avisos: [] })])),
    );
    const { container } = render(<PasoConstruir {...propiedades()} />);
    await screen.findByRole("heading", { name: "Tu landing está lista" });
    const marco = container.querySelector("iframe")!;
    const espia = vi.spyOn(marco.contentWindow!, "postMessage");
    fireEvent.load(marco);
    expect(espia).toHaveBeenCalledWith({ tipo: MENSAJE_DOC, doc: DOC }, window.location.origin);
  });

  it("«Guardar y abrir en el editor» guarda la landing y abre /editor/[id]", async () => {
    const fetchFalso = vi
      .fn()
      .mockResolvedValueOnce(respuestaNdjson([linea({ tipo: "resultado", doc: DOC, salud: SALUD, vueltasCritico: 0, proveedores: { landing: "groq" }, avisos: [] })]))
      .mockResolvedValueOnce(respuestaJson({ id: "abc123", slug: "corrector" }));
    vi.stubGlobal("fetch", fetchFalso);
    const props = propiedades();
    render(<PasoConstruir {...props} />);
    fireEvent.click(await screen.findByRole("button", { name: "Guardar y abrir en el editor" }));
    await waitFor(() => expect(props.onAbrirEditor).toHaveBeenCalledWith("abc123"));
    expect(fetchFalso.mock.calls[1][0]).toBe("/api/landings");
    const cuerpo = JSON.parse(fetchFalso.mock.calls[1][1].body);
    expect(cuerpo.doc.meta.slug).toBe(DOC.meta.slug);
    expect(cuerpo.proveedor).toBe("groq");
  });

  it("una landing pegada a mano se guarda con proveedor «manual»", async () => {
    const fetchFalso = vi
      .fn()
      .mockResolvedValueOnce(respuestaNdjson([linea({ tipo: "resultado", doc: DOC, salud: SALUD, vueltasCritico: 0, proveedores: {}, avisos: [] })]))
      .mockResolvedValueOnce(respuestaJson({ id: "m1", slug: "x" }, 201));
    vi.stubGlobal("fetch", fetchFalso);
    const props = propiedades();
    render(<PasoConstruir {...props} />);
    fireEvent.click(await screen.findByRole("button", { name: "Guardar y abrir en el editor" }));
    await waitFor(() => expect(props.onAbrirEditor).toHaveBeenCalledWith("m1"));
    expect(JSON.parse(fetchFalso.mock.calls[1][1].body).proveedor).toBe("manual");
  });

  it("si /api/landings responde 404 muestra un error legible y no navega", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(respuestaNdjson([linea({ tipo: "resultado", doc: DOC, salud: SALUD, vueltasCritico: 0, proveedores: {}, avisos: [] })]))
        .mockResolvedValueOnce(respuestaJson({}, 404)),
    );
    const props = propiedades();
    render(<PasoConstruir {...props} />);
    fireEvent.click(await screen.findByRole("button", { name: "Guardar y abrir en el editor" }));
    expect((await screen.findByText(/todavía no está disponible/i)).getAttribute("role")).toBe("alert");
    expect(props.onAbrirEditor).not.toHaveBeenCalled();
  });

  it("el evento manual muestra el panel; pegar un JSON válido llega al resultado", async () => {
    const fetchFalso = vi
      .fn()
      .mockResolvedValueOnce(
        respuestaNdjson([
          linea({
            tipo: "manual",
            prompt: { sistema: "Eres director de arte", usuario: "Construye la landing del corrector" },
            intentos: [{ proveedor: "gemini", tipo: "limite", mensaje: "Límite de cuota" }],
          }),
        ]),
      )
      .mockResolvedValueOnce(respuestaJson({ doc: DOC, salud: SALUD }));
    vi.stubGlobal("fetch", fetchFalso);
    const escribir = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText: escribir } });

    const { container } = render(<PasoConstruir {...propiedades()} />);
    await screen.findByRole("heading", { name: /sigue a mano/i });
    expect(container.querySelector("[data-panel-manual]")).not.toBeNull();
    expect(screen.getByText("Eres director de arte")).toBeTruthy();
    expect(container.querySelector("[data-intentos]")?.textContent).toContain("Límite de cuota");

    fireEvent.click(screen.getByRole("button", { name: /copiar prompt de usuario/i }));
    await waitFor(() => expect(escribir).toHaveBeenCalledWith("Construye la landing del corrector"));

    const validar = screen.getByRole("button", { name: "Validar y ver la landing" });
    expect(validar.hasAttribute("disabled")).toBe(true);
    fireEvent.change(screen.getByLabelText("JSON de la respuesta"), { target: { value: JSON.stringify(DOC) } });
    fireEvent.click(validar);

    await screen.findByRole("heading", { name: "Tu landing está lista" });
    expect(fetchFalso.mock.calls[1][0]).toBe("/api/construir/manual");
    expect(JSON.parse(fetchFalso.mock.calls[1][1].body).texto).toContain(DOC.meta.slug);
    expect(container.querySelectorAll("[data-salud] li")).toHaveLength(8);
  });

  it("un JSON manual inválido muestra los errores legibles de la validación", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(respuestaNdjson([linea({ tipo: "manual", prompt: { sistema: "s", usuario: "u" }, intentos: [] })]))
        .mockResolvedValueOnce(respuestaJson({ error: "secciones: se esperaban entre 5 y 10 secciones" }, 400)),
    );
    render(<PasoConstruir {...propiedades()} />);
    await screen.findByRole("heading", { name: /sigue a mano/i });
    fireEvent.change(screen.getByLabelText("JSON de la respuesta"), { target: { value: "{}" } });
    fireEvent.click(screen.getByRole("button", { name: "Validar y ver la landing" }));
    const alerta = await screen.findByText(/entre 5 y 10 secciones/);
    expect(alerta.getAttribute("role")).toBe("alert");
    expect(screen.queryByRole("heading", { name: "Tu landing está lista" })).toBeNull();
  });

  it("el evento error muestra un mensaje humano y «Reintentar» vuelve a construir", async () => {
    const fetchFalso = vi
      .fn()
      .mockResolvedValueOnce(respuestaNdjson([linea({ tipo: "error", mensaje: "No pudimos construir la landing esta vez." })]))
      .mockResolvedValueOnce(respuestaNdjson([linea({ tipo: "resultado", doc: DOC, salud: SALUD, vueltasCritico: 0, proveedores: {}, avisos: [] })]));
    vi.stubGlobal("fetch", fetchFalso);
    const { container } = render(<PasoConstruir {...propiedades()} />);
    await screen.findByText("No pudimos construir la landing esta vez.");
    expect(container.querySelector("[data-error-construccion]")).not.toBeNull();
    fireEvent.click(within(container.querySelector("[data-error-construccion]") as HTMLElement).getByRole("button", { name: "Reintentar" }));
    await screen.findByRole("heading", { name: "Tu landing está lista" });
    expect(fetchFalso).toHaveBeenCalledTimes(2);
  });

  it("si la ruta responde 404 dice que la función no está disponible", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuestaJson({}, 404)));
    render(<PasoConstruir {...propiedades()} />);
    expect(await screen.findByText(/todavía no está disponible/i)).toBeTruthy();
  });

  it("sin autoIniciar espera a que la persona pulse «Construir»", async () => {
    const fetchFalso = vi.fn().mockResolvedValue(respuestaNdjson([]));
    vi.stubGlobal("fetch", fetchFalso);
    render(<PasoConstruir {...propiedades()} autoIniciar={false} />);
    expect(fetchFalso).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Construir" }));
    });
    expect(fetchFalso).toHaveBeenCalledTimes(1);
  });
});

describe("/crear/vista-previa", () => {
  it("pinta con LandingRender el documento que recibe por postMessage", async () => {
    const { container } = render(<VistaPreviaLanding />);
    expect(container.textContent).toMatch(/Cargando la vista previa/);
    act(() => {
      window.dispatchEvent(new MessageEvent("message", { data: { tipo: MENSAJE_DOC, doc: DOC }, origin: window.location.origin }));
    });
    await waitFor(() => expect(container.querySelector('[data-tipo="heroe"]')).not.toBeNull());
  });

  it("ignora mensajes de otro origen", () => {
    const { container } = render(<VistaPreviaLanding />);
    act(() => {
      window.dispatchEvent(new MessageEvent("message", { data: { tipo: MENSAJE_DOC, doc: DOC }, origin: "https://otro.example" }));
    });
    expect(container.querySelector('[data-tipo="heroe"]')).toBeNull();
  });
});
