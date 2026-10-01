// @vitest-environment jsdom
import { useReducer } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ESTADO_INICIAL, motivoBloqueo, puedeEstarEn, reducir } from "@/componentes/crear/estado";
import { aplicarBorrador, type RespuestaInvestigar } from "@/componentes/crear/investigar";
import { PasoBrief } from "@/componentes/crear/PasoBrief";
import { BORRADOR_VACIO, deBrief } from "@/componentes/crear/borrador";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const fuente = (sitio: string) => [{ url: `https://${sitio}/nota`, sitio }];
const COLORES = ["#112233", "#445566", "#778899"];

function respuesta(extra: Partial<RespuestaInvestigar> = {}): RespuestaInvestigar {
  return {
    sugerencias: { beneficios: [], objeciones: [], preguntas: [] },
    consultas: ["corrector de postura beneficios"],
    usadas: 3,
    cuota: { usadasMes: 3, limiteMes: 250 },
    avisos: [],
    identificacion: { reconocido: true, tipoProducto: "corrector de postura", confianza: 0.9 },
    borrador: {
      categoria: { valor: "salud-y-bienestar", fuentes: fuente("saludtotal.co"), confianza: 0.9 },
      problema: { valor: "Pasas horas sentado y la espalda te pasa factura", fuentes: fuente("foro.co"), confianza: 0.6 },
      publico: { valor: "Personas que trabajan frente a un computador", fuentes: fuente("bienestar.co"), confianza: 0.4 },
      beneficios: {
        valor: ["Ayuda a mantener la espalda recta", "Se lleva bajo la ropa", "Dura 8 horas con una carga"],
        fuentes: [...fuente("saludtotal.co"), ...fuente("tecnoresenas.com")],
        confianza: 0.8,
      },
      objeciones: { valor: ["¿Incomoda al sentarse?"], fuentes: fuente("foro.co"), confianza: 0.7 },
      nivelConciencia: { valor: "solucion", fuentes: [], confianza: 0.5, motivo: "Comparan opciones antes de comprar." },
      coloresMarca: { valor: COLORES, fuentes: [], confianza: 0.9 },
    },
    precioReferencia: { min: 90000, max: 150000, fuentes: fuente("tienda.co") },
    ...extra,
  };
}

function Anfitrion() {
  const [estado, despachar] = useReducer(reducir, ESTADO_INICIAL);
  return (
    <>
      <PasoBrief
        brief={estado.brief}
        revision={estado.revision}
        onCambio={(cambios) => despachar({ tipo: "editar-brief", cambios })}
        onEjemplo={(x) => despachar({ tipo: "cargar-ejemplo", brief: deBrief(x.brief), tecnicas: x.tecnicas, numeroSemilla: x.numeroSemilla })}
        onAplicarBorrador={(datos) => despachar({ tipo: "aplicar-borrador", ...datos })}
        onAceptarSugerido={(campo) => despachar({ tipo: "aceptar-sugerido", campo })}
        onAceptarTodoSugerido={() => despachar({ tipo: "aceptar-todo-sugerido" })}
        onQuitarSugerido={(campo, cambios) => despachar({ tipo: "quitar-sugerido", campo, cambios })}
      />
      <output data-testid="bloqueo">{motivoBloqueo(estado) ?? ""}</output>
      <output data-testid="precio">{estado.brief.precio}</output>
      <output data-testid="colores">{JSON.stringify(estado.brief.coloresMarca)}</output>
    </>
  );
}

const json = (cuerpo: unknown, estado = 200) => new Response(JSON.stringify(cuerpo), { status: estado, headers: { "Content-Type": "application/json" } });

/** Sube la foto, escribe el nombre y pulsa el botón; devuelve el `fetch` simulado. */
async function llenarConFoto(respuestaApi: Response | Promise<Response>, conFoto = true) {
  const simulado = vi.fn(async () => respuestaApi);
  vi.stubGlobal("fetch", simulado);
  render(<Anfitrion />);
  if (conFoto) {
    const archivo = new File(["x"], "corrector.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Foto del producto"), { target: { files: [archivo] } });
  }
  fireEvent.change(screen.getByLabelText("¿Cómo se llama tu producto?"), { target: { value: "Corrector de postura" } });
  fireEvent.click(screen.getByRole("button", { name: "Llenar el brief con lo que encuentre" }));
  return simulado;
}

const barra = (campo: string) => document.querySelector<HTMLElement>(`[data-sugerido='${campo}']`)!;

describe("«Empieza con una foto»: flujo completo", () => {
  it("muestra los pasos con aria-live y manda la foto y el nombre a /api/investigar", async () => {
    let terminar!: (r: Response) => void;
    const espera = new Promise<Response>((res) => (terminar = res));
    const simulado = await llenarConFoto(espera);

    const estado = document.querySelector("[data-pasos-foto]")!;
    expect(estado.getAttribute("aria-live")).toBe("polite");
    await waitFor(() => expect(estado.textContent).toBe("Reconociendo el producto en la foto…"));
    expect((screen.getByRole("button", { name: "Trabajando…" }) as HTMLButtonElement).disabled).toBe(true);

    terminar(json(respuesta()));
    await waitFor(() => expect(barra("problema")).not.toBeNull());

    const [ruta, init] = simulado.mock.calls[0] as unknown as [string, RequestInit];
    expect(ruta).toBe("/api/investigar");
    const cuerpo = init.body as FormData;
    expect(cuerpo.get("nombre")).toBe("Corrector de postura");
    expect((cuerpo.get("imagen") as File).name).toBe("corrector.png");
  });

  it("pre-llena el brief como borrador con Sugerido, fuentes, confianza y las tres acciones", async () => {
    await llenarConFoto(json(respuesta()));
    await waitFor(() => expect(barra("problema")).not.toBeNull());

    expect((screen.getByLabelText(/Problema que resuelve/) as HTMLInputElement).value).toBe("Pasas horas sentado y la espalda te pasa factura");
    expect((screen.getByRole("textbox", { name: "Beneficio 3" }) as HTMLInputElement).value).toBe("Dura [COMPLETAR] horas con una carga");
    const beneficios = barra("beneficios");
    expect(within(beneficios).getByText("Sugerido")).toBeTruthy();
    expect(within(beneficios).getByRole("link", { name: "saludtotal.co" }).getAttribute("href")).toBe("https://saludtotal.co/nota");
    expect(within(beneficios).getByRole("link", { name: "tecnoresenas.com" })).toBeTruthy();
    expect(beneficios.querySelector("[data-confianza]")?.getAttribute("data-confianza")).toBe("alta");
    expect(barra("problema").querySelector("[data-confianza]")?.getAttribute("data-confianza")).toBe("media");
    expect(barra("publico").querySelector("[data-confianza]")?.getAttribute("data-confianza")).toBe("baja");
    expect(within(barra("nivelConciencia")).getByText("Comparan opciones antes de comprar.")).toBeTruthy();
    for (const nombre of ["Aceptar problema", "Editar problema", "Quitar problema"]) {
      expect(within(barra("problema")).getByRole("button", { name: nombre })).toBeTruthy();
    }
  });

  it("no deja avanzar mientras queden campos sin revisar", async () => {
    await llenarConFoto(json(respuesta()));
    await waitFor(() => expect(barra("problema")).not.toBeNull());
    expect(screen.getByTestId("bloqueo").textContent).toContain("Revisa lo sugerido");
    expect(document.querySelector("[data-por-revisar]")?.textContent).toMatch(/Faltan \d+ por revisar/);

    fireEvent.click(within(barra("problema")).getByRole("button", { name: "Aceptar problema" }));
    expect(barra("problema").getAttribute("data-estado")).toBe("aceptado");
    expect(screen.getByTestId("bloqueo").textContent).toContain("Revisa lo sugerido");
  });

  it("«Aceptar todo lo sugerido» libera el avance", async () => {
    await llenarConFoto(json(respuesta()));
    await waitFor(() => expect(barra("problema")).not.toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Aceptar todo lo sugerido" }));
    expect(document.querySelectorAll("[data-estado='pendiente']")).toHaveLength(0);
    expect(document.querySelectorAll("[data-estado='aceptado']").length).toBeGreaterThan(0);
    expect(screen.getByTestId("bloqueo").textContent).not.toContain("Revisa lo sugerido");
    expect(screen.queryByRole("button", { name: "Aceptar todo lo sugerido" })).toBeNull();
  });

  it("«Quitar» vacía el campo y deja de exigir su revisión", async () => {
    await llenarConFoto(json(respuesta()));
    await waitFor(() => expect(barra("publico")).not.toBeNull());
    fireEvent.click(within(barra("publico")).getByRole("button", { name: "Quitar público" }));
    expect((screen.getByLabelText(/Público objetivo/) as HTMLInputElement).value).toBe("");
    expect(barra("publico")).toBeNull();
    fireEvent.click(within(barra("beneficios")).getByRole("button", { name: "Quitar beneficios" }));
    expect((screen.getByRole("textbox", { name: "Beneficio 1" }) as HTMLInputElement).value).toBe("");
  });

  it("«Editar» lleva el foco al campo", async () => {
    await llenarConFoto(json(respuesta()));
    await waitFor(() => expect(barra("problema")).not.toBeNull());
    fireEvent.click(within(barra("problema")).getByRole("button", { name: "Editar problema" }));
    expect(document.activeElement).toBe(screen.getByLabelText(/Problema que resuelve/));
  });
});

describe("lo que nunca se pre-llena", () => {
  it("deja precio, prueba social, oferta y garantía vacíos aunque la API los traiga", async () => {
    const trampa = respuesta();
    Object.assign(trampa.borrador as object, {
      precio: { valor: 99000, fuentes: [], confianza: 1 },
      pruebaSocial: { valor: { calificacion: 4.9, numOpiniones: 1200 }, fuentes: [], confianza: 1 },
      oferta: { valor: "2x1", fuentes: [], confianza: 1 },
      garantia: { valor: { dias: 30 }, fuentes: [], confianza: 1 },
    });
    await llenarConFoto(json(trampa));
    await waitFor(() => expect(barra("problema")).not.toBeNull());

    expect(screen.getByTestId("precio").textContent).toBe("");
    expect((screen.getByLabelText(/^Calificación promedio/) as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText(/^Número de opiniones/) as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText(/^Días de garantía/) as HTMLInputElement).value).toBe("");
    expect(screen.queryByLabelText(/Qué incluye la oferta/)).toBeNull();
    expect(document.querySelectorAll("[data-nota-tuyo]")).toHaveLength(3);
    expect(screen.getAllByText("Esto lo pones tú: no lo tomamos de internet.")).toHaveLength(3);
  });

  it("muestra precioReferencia como dato informativo con sus fuentes, sin llenar el precio", async () => {
    await llenarConFoto(json(respuesta()));
    const nota = await waitFor(() => {
      const el = document.querySelector<HTMLElement>("[data-precio-referencia]");
      expect(el).not.toBeNull();
      return el!;
    });
    expect(nota.textContent).toContain("En el mercado se ve entre");
    expect(nota.textContent).toMatch(/90\.000/);
    expect(nota.textContent).toMatch(/150\.000/);
    expect(within(nota).getByRole("link", { name: "tienda.co" })).toBeTruthy();
    expect((document.getElementById("brief-precio") as HTMLInputElement).value).toBe("");
    expect(screen.getByTestId("precio").textContent).toBe("");
  });

  it("no pisa lo que la persona ya escribió", () => {
    const { cambios, meta } = aplicarBorrador(
      { categoria: "hogar", problema: "Mi texto", publico: "", beneficios: ["Uno", "", ""], objeciones: [], incluye: [] },
      respuesta().borrador,
    );
    expect(cambios.categoria).toBeUndefined();
    expect(cambios.problema).toBeUndefined();
    expect(cambios.beneficios).toBeUndefined();
    expect(meta.problema).toBeUndefined();
    expect(cambios.publico).toBe("Personas que trabajan frente a un computador");
  });
});

describe("errores de validación", () => {
  it("un borrador pre-llenado no muestra errores antes de tocar los campos", async () => {
    await llenarConFoto(json(respuesta()));
    await waitFor(() => expect(barra("problema")).not.toBeNull());
    const precio = document.getElementById("brief-precio") as HTMLInputElement;
    expect(precio.getAttribute("aria-invalid")).toBeNull();
    expect(document.getElementById("brief-precio-error")).toBeNull();
    expect(screen.queryByText(/Escribe el precio como número/)).toBeNull();
    expect(document.querySelectorAll("[aria-invalid='true']")).toHaveLength(0);
  });

  it("el error del precio aparece al salir del campo, no antes", async () => {
    await llenarConFoto(json(respuesta()));
    await waitFor(() => expect(barra("problema")).not.toBeNull());
    const precio = document.getElementById("brief-precio") as HTMLInputElement;
    fireEvent.focus(precio);
    expect(precio.getAttribute("aria-invalid")).toBeNull();
    fireEvent.blur(precio);
    expect(precio.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText(/Escribe el precio como número/)).toBeTruthy();
  });

  it("al intentar avanzar se muestran todos los errores", () => {
    render(<PasoBrief brief={BORRADOR_VACIO} onCambio={() => {}} onEjemplo={() => {}} intentoAvanzar />);
    expect(screen.getByText(/Escribe el precio como número/)).toBeTruthy();
    expect(screen.getByText("Escribe el nombre del producto.")).toBeTruthy();
  });
});

describe("colores de la foto", () => {
  it("propone 3 muestras que se aceptan una por una", async () => {
    await llenarConFoto(json(respuesta()));
    const zona = await waitFor(() => {
      const el = document.querySelector<HTMLElement>("[data-colores-foto]");
      expect(el).not.toBeNull();
      return el!;
    });
    expect(within(zona).getAllByRole("listitem")).toHaveLength(3);
    fireEvent.click(within(zona).getByRole("button", { name: `Usar el color ${COLORES[1]} en tu marca` }));
    expect(JSON.parse(screen.getByTestId("colores").textContent ?? "[]")).toEqual([COLORES[1]]);
    expect((within(zona).getByRole("button", { name: `Color ${COLORES[1]} ya agregado` }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("foto no reconocible y errores", () => {
  it("lo dice en una línea y sigue con el nombre", async () => {
    const r = respuesta({ identificacion: { reconocido: false, confianza: 0.1 }, avisos: ["No pudimos reconocer el producto en la foto."] });
    r.borrador = { categoria: { valor: "salud-y-bienestar", fuentes: fuente("saludtotal.co"), confianza: 0.6 } };
    await llenarConFoto(json(r));
    const aviso = await waitFor(() => {
      const el = document.querySelector<HTMLElement>("[data-foto-no-reconocida]");
      expect(el).not.toBeNull();
      return el!;
    });
    expect(aviso.textContent).toBe("No pudimos reconocer el producto en la foto. Seguimos solo con el nombre.");
    expect(document.querySelector("[data-colores-foto]")).toBeNull();
    expect((screen.getByLabelText("¿Cómo se llama tu producto?") as HTMLInputElement).value).toBe("Corrector de postura");
  });

  it("sin foto manda JSON con el nombre", async () => {
    const simulado = await llenarConFoto(json(respuesta()), false);
    await waitFor(() => expect(barra("problema")).not.toBeNull());
    const [, init] = simulado.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ nombre: "Corrector de postura" });
  });

  it("sin clave (503) avisa con calma y el resto del paso sigue igual", async () => {
    await llenarConFoto(json({ error: "Falta SERPAPI_API_KEY." }, 503));
    const aviso = await waitFor(() => {
      const el = document.querySelector<HTMLElement>("[data-sin-clave-foto]");
      expect(el).not.toBeNull();
      return el!;
    });
    expect(aviso.textContent).toContain("La investigación es opcional");
    expect(within(aviso).getByRole("link", { name: "Ir a Ajustes" }).getAttribute("href")).toBe("/ajustes");
    expect((screen.getByLabelText(/Problema que resuelve/) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByTestId("bloqueo").textContent).not.toContain("Revisa lo sugerido");
  });

  it("rechaza un archivo que no es imagen", () => {
    render(<Anfitrion />);
    const texto = new File(["x"], "notas.txt", { type: "text/plain" });
    fireEvent.change(screen.getByLabelText("Foto del producto"), { target: { files: [texto] } });
    expect(screen.getByRole("alert").textContent).toContain("no es una imagen");
  });
});

describe("estado de la revisión", () => {
  it("bloquea el paso 2 hasta revisar todo y lo libera al aceptar", () => {
    let estado = reducir(ESTADO_INICIAL, {
      tipo: "aplicar-borrador",
      cambios: { problema: "Algo" },
      meta: { problema: { fuentes: [], confianza: 0.5 } },
      precioReferencia: null,
    });
    expect(estado.revision.pendientes).toEqual(["problema"]);
    expect(puedeEstarEn(estado, 2)).toBe(false);
    estado = reducir(estado, { tipo: "aceptar-sugerido", campo: "problema" });
    expect(estado.revision.pendientes).toEqual([]);
  });
});
