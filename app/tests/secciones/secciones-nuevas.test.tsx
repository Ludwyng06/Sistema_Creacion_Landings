// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { calcularAhorro, formatearDinero } from "@/componentes/dinero";
import type { Asset, Seccion } from "@/lib/contratos";
import { ejemplo as antesDespues, assets as ASSETS_ANTES_DESPUES } from "@/secciones/antes-despues/ejemplo";
import { ejemplo as cifras } from "@/secciones/cifras/ejemplo";
import { partesRestantes } from "@/secciones/cuenta-regresiva/Componente";
import { ejemplo as cuentaRegresiva } from "@/secciones/cuenta-regresiva/ejemplo";
import { schema as schemaCuenta } from "@/secciones/cuenta-regresiva/schema";
import { meta as metaHtmlLibre } from "@/secciones/html-libre/schema";
import { sanitizarHtml } from "@/secciones/html-libre/sanitizar";
import { ejemplo as htmlLibre } from "@/secciones/html-libre/ejemplo";
import { ejemplo as oferta } from "@/secciones/oferta/ejemplo";
import { schema as schemaOferta } from "@/secciones/oferta/schema";
import { ejemplo as problema } from "@/secciones/problema-solucion/ejemplo";
import { ajustes as ajustesProblema } from "@/secciones/problema-solucion/schema";
import { ejemplos as testimonios } from "@/secciones/testimonios/ejemplo";
import { ejemplo as video } from "@/secciones/video/ejemplo";
import { renderizar, simularMedia } from "./ayudas";

let restaurar: (() => void) | null = null;
afterEach(() => {
  cleanup();
  restaurar?.();
  restaurar = null;
});

function ofertaNumerica(cambios: Record<string, unknown>): Seccion {
  return {
    ...oferta,
    ajustes: { ...oferta.ajustes, ...cambios },
    bloques: [
      { id: "o1", tipo: "opcion-cantidad", ajustes: { unidades: 1, precio: 129000 } },
      { id: "o2", tipo: "opcion-cantidad", ajustes: { unidades: 2, precio: 229000, etiqueta: "Más elegido" } },
    ],
  };
}

describe("oferta · ahorro calculado", () => {
  it("COP: calcula la diferencia y el porcentaje desde el precio anterior", () => {
    const texto = calcularAhorro(129000, 169000, "COP")!;
    expect(texto).toMatch(/^Ahorras/);
    expect(texto).toMatch(/40\.000/);
    expect(texto).toMatch(/24 % menos/);
  });

  it("USD: calcula con decimales de dólar", () => {
    const texto = calcularAhorro(80, 100, "USD")!;
    expect(texto).toMatch(/20/);
    expect(texto).toMatch(/20 % menos/);
    expect(formatearDinero(19.5, "USD")).toMatch(/19,5|19\.5/);
  });

  it("sin precio anterior, o sin descuento real, no hay ahorro", () => {
    expect(calcularAhorro(100, undefined, "COP")).toBeNull();
    expect(calcularAhorro(100, 100, "COP")).toBeNull();
    expect(calcularAhorro(150, 100, "COP")).toBeNull();
    expect(calcularAhorro("[COMPLETAR]", 100, "COP")).toBeNull();
    expect(calcularAhorro(100, "[COMPLETAR]", "COP")).toBeNull();
  });

  it("el componente muestra el ahorro solo si hay precio anterior", () => {
    const con = renderizar([ofertaNumerica({ precio: 129000, precioAnterior: 169000, moneda: "COP" })]);
    expect(con.container.querySelector("[data-ahorro]")?.textContent).toMatch(/40\.000/);
    con.unmount();

    const { precioAnterior, ...sin } = oferta.ajustes as Record<string, unknown>;
    void precioAnterior;
    const sinAnterior = renderizar([ofertaNumerica({ ...sin, precio: 129000, moneda: "COP", precioAnterior: undefined })]);
    expect(sinAnterior.container.querySelector("[data-ahorro]")).toBeNull();
  });

  it("muestra hasta 3 opciones con la etiqueta «Más elegido»", () => {
    const { container } = renderizar([ofertaNumerica({ precio: 129000, moneda: "COP" })]);
    expect(container.textContent).toContain("Más elegido");
    expect(container.querySelectorAll("ul li")).toHaveLength(2);
  });

  it("el schema limita a 1..3 opciones y acepta [COMPLETAR]", () => {
    const base = { ajustes: oferta.ajustes, bloques: oferta.bloques };
    expect(schemaOferta.safeParse(base).success).toBe(true);
    const cuatro = Array.from({ length: 4 }, (_, i) => ({
      id: `o${i}`,
      tipo: "opcion-cantidad",
      ajustes: { unidades: 1, precio: "[COMPLETAR]" },
    }));
    expect(schemaOferta.safeParse({ ajustes: oferta.ajustes, bloques: cuatro }).success).toBe(false);
    expect(schemaOferta.safeParse({ ajustes: oferta.ajustes, bloques: [] }).success).toBe(false);
  });

  it("el ejemplo deja [COMPLETAR] visible en vez de inventar precios", () => {
    const { container } = renderizar([oferta]);
    expect(container.textContent).toContain("[COMPLETAR]");
    expect(container.querySelector("[data-ahorro]")).toBeNull();
  });
});

describe("cuenta-regresiva", () => {
  const conFecha = (fechaFin: string): Seccion => ({
    ...cuentaRegresiva,
    ajustes: { ...cuentaRegresiva.ajustes, fechaFin },
  });

  it("una fecha pasada no muestra la sección", async () => {
    const { container } = renderizar([conFecha("2000-01-01T00:00:00Z")]);
    await waitFor(() => expect(container.querySelector("h2")).toBeNull());
    expect(container.querySelector('[data-tipo="cuenta-regresiva"]')?.textContent).toBe("");
  });

  it("una fecha futura muestra el tiempo restante", async () => {
    const fin = new Date(Date.now() + 3 * 86400_000 + 5 * 3600_000).toISOString();
    const { container } = renderizar([conFecha(fin)]);
    await waitFor(() => expect(screen.getByRole("timer").textContent).toMatch(/Quedan 3 días, 4 horas|Quedan 3 días, 5 horas/));
    expect(container.querySelector("h2")).not.toBeNull();
  });

  it("sin fecha real muestra [COMPLETAR]", () => {
    const { container } = renderizar([cuentaRegresiva]);
    expect(container.textContent).toContain("[COMPLETAR]");
  });

  it("la fecha de fin es obligatoria y debe ser válida", () => {
    const base = { ajustes: cuentaRegresiva.ajustes, bloques: [] };
    expect(schemaCuenta.safeParse(base).success).toBe(true);
    expect(schemaCuenta.safeParse({ ...base, ajustes: { ...cuentaRegresiva.ajustes, fechaFin: "mañana" } }).success).toBe(false);
    const { fechaFin, ...sinFecha } = cuentaRegresiva.ajustes as Record<string, unknown>;
    void fechaFin;
    expect(schemaCuenta.safeParse({ ...base, ajustes: sinFecha }).success).toBe(false);
  });

  it("divide el tiempo en días, horas, minutos y segundos", () => {
    expect(partesRestantes(90061_000)).toEqual({ dias: 1, horas: 1, minutos: 1, segundos: 1 });
    expect(partesRestantes(-5)).toEqual({ dias: 0, horas: 0, minutos: 0, segundos: 0 });
  });
});

describe("html-libre", () => {
  const MALICIOSO =
    '<p>Hola</p><script>alert(1)</script><img src="x" onerror="alert(2)"><a href="javascript:alert(3)" onclick="alert(4)">clic</a><iframe src="https://ejemplo.com"></iframe>';

  it("sanitizarHtml elimina <script>, onerror, onclick, javascript: e iframes", () => {
    const limpio = sanitizarHtml(MALICIOSO);
    expect(limpio).toContain("<p>Hola</p>");
    expect(limpio).not.toMatch(/<script/i);
    expect(limpio).not.toMatch(/onerror/i);
    expect(limpio).not.toMatch(/onclick/i);
    expect(limpio).not.toMatch(/javascript:/i);
    expect(limpio).not.toMatch(/<iframe/i);
  });

  it("el componente no deja pasar scripts ni eventos al DOM", () => {
    const { container } = renderizar([{ ...htmlLibre, ajustes: { html: MALICIOSO } }]);
    const zona = container.querySelector("[data-html-libre]")!;
    expect(zona.textContent).toContain("Hola");
    expect(zona.querySelector("script, iframe")).toBeNull();
    expect(zona.querySelector("[onerror], [onclick]")).toBeNull();
  });

  it("solo la ofrece el editor a personas (soloHumano)", () => {
    expect(metaHtmlLibre.soloHumano).toBe(true);
  });
});

describe("antes-despues · comparador", () => {
  const conArchivos = (cuales: string[]): Asset[] =>
    cuales.map((slot) => ({ slot, tipo: "imagen", relacion: "4:5", promptGrok: "p", ruta: "/media/" + slot + ".webp", alt: slot }));

  it("sin archivos muestra los dos marcadores completos, cada uno con su botón, y sin slider", () => {
    const { container } = renderizar([antesDespues], { onBuscarBancos: () => {} });
    expect(screen.queryByRole("slider")).toBeNull();
    expect(container.querySelector('[data-marcador-slot="postura-antes"]')).not.toBeNull();
    expect(container.querySelector('[data-marcador-slot="postura-despues"]')).not.toBeNull();
    expect(screen.getAllByRole("button", { name: /buscar en bancos/i })).toHaveLength(2);
    expect(container.querySelectorAll("figcaption")).toHaveLength(2);
  });

  it("los dos botones piden buscar en bancos para su propio slot", () => {
    const buscar = vi.fn();
    renderizar([antesDespues], { assets: ASSETS_ANTES_DESPUES, onBuscarBancos: buscar });
    const [botonAntes, botonDespues] = screen.getAllByRole("button", { name: /buscar en bancos/i });
    fireEvent.click(botonAntes);
    fireEvent.click(botonDespues);
    expect(buscar.mock.calls.map((c) => c[0])).toEqual(["postura-antes", "postura-despues"]);
  });

  it("con un solo archivo sigue sin slider y el otro marcador queda accesible", () => {
    renderizar([antesDespues], { assets: [...conArchivos(["postura-antes"]), ASSETS_ANTES_DESPUES[1]], onBuscarBancos: () => {} });
    expect(screen.queryByRole("slider")).toBeNull();
    expect(screen.getAllByRole("button", { name: /buscar en bancos/i })).toHaveLength(1);
  });

  it("con los dos archivos es un slider con teclado y aria-valuenow, sin marcadores", () => {
    const { container } = renderizar([antesDespues], { assets: conArchivos(["postura-antes", "postura-despues"]) });
    expect(container.querySelector("[data-marcador-slot]")).toBeNull();
    const slider = screen.getByRole("slider");
    expect(slider.getAttribute("aria-valuemin")).toBe("0");
    expect(slider.getAttribute("aria-valuemax")).toBe("100");
    expect(slider.getAttribute("aria-valuenow")).toBe("50");
    expect(slider.getAttribute("aria-label")).toBeTruthy();
    expect(slider.tabIndex).toBe(0);

    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(slider.getAttribute("aria-valuenow")).toBe("55");
    fireEvent.keyDown(slider, { key: "ArrowLeft" });
    fireEvent.keyDown(slider, { key: "ArrowLeft" });
    expect(slider.getAttribute("aria-valuenow")).toBe("45");
    fireEvent.keyDown(slider, { key: "Home" });
    expect(slider.getAttribute("aria-valuenow")).toBe("0");
    fireEvent.keyDown(slider, { key: "ArrowLeft" });
    expect(slider.getAttribute("aria-valuenow")).toBe("0");
    fireEvent.keyDown(slider, { key: "End" });
    expect(slider.getAttribute("aria-valuenow")).toBe("100");
  });
});

describe("problema-solucion", () => {
  const palabras = (n: number) => Array.from({ length: n }, () => "palabra").join(" ");

  it("la historia admite hasta 90 palabras", () => {
    const base = { ...problema.ajustes };
    expect(ajustesProblema.safeParse({ ...base, historia: palabras(90) }).success).toBe(true);
    expect(ajustesProblema.safeParse({ ...base, historia: palabras(91) }).success).toBe(false);
  });

  it("la imagen va debajo del texto, nunca al lado", () => {
    const { container } = renderizar([problema]);
    const historia = container.querySelector("p")!;
    const imagen = container.querySelector("[data-marcador-slot]")!;
    expect(historia.compareDocumentPosition(imagen) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.innerHTML).not.toMatch(/(?:^|[\s"])(?:\w+:)?(?:flex-row|grid-cols-[2-9])(?=[\s"])/);
  });
});

describe("video", () => {
  const conArchivo = (autoplay: boolean): { seccion: Seccion; assets: Asset[] } => ({
    seccion: { ...video, ajustes: { ...video.ajustes, autoplay } },
    assets: [
      { slot: "video-uso", tipo: "video", relacion: "16:9", promptGrok: "p", ruta: "/media/ejemplo.mp4", alt: "Uso del corrector" },
      { slot: "video-uso-poster", tipo: "imagen", relacion: "16:9", promptGrok: "p", ruta: "/media/poster.webp", alt: "Póster" },
    ],
  });

  it("sin archivo muestra el marcador de video", () => {
    const { container } = renderizar([video]);
    expect(container.querySelector('[data-marcador-slot="video-uso"]')).not.toBeNull();
    expect(container.textContent).toContain("Video pendiente");
    expect(container.querySelector("video")).toBeNull();
  });

  it("con archivo: silenciado, playsInline, con póster y autoplay", () => {
    const { seccion, assets } = conArchivo(true);
    const { container } = renderizar([seccion], { assets });
    const elemento = container.querySelector("video")!;
    expect(elemento.muted).toBe(true);
    expect(elemento.hasAttribute("playsinline")).toBe(true);
    expect(elemento.getAttribute("poster")).toBe("/media/poster.webp");
    expect(elemento.autoplay).toBe(true);
  });

  it("con prefers-reduced-motion no arranca solo", () => {
    restaurar = simularMedia({ reducir: true });
    const { seccion, assets } = conArchivo(true);
    const { container } = renderizar([seccion], { assets });
    expect(container.querySelector("video")!.autoplay).toBe(false);
  });

  it("con autoplay desactivado muestra controles", () => {
    const { seccion, assets } = conArchivo(false);
    const { container } = renderizar([seccion], { assets });
    const elemento = container.querySelector("video")!;
    expect(elemento.autoplay).toBe(false);
    expect(elemento.controls).toBe(true);
  });
});

describe("datos que faltan del brief", () => {
  it("testimonios muestra [COMPLETAR] visible y discreto en cada dato", () => {
    for (const [nombre, seccion] of Object.entries(testimonios)) {
      const { container, unmount } = renderizar([seccion]);
      const marcas = container.querySelectorAll('[title="Falta este dato del brief"]');
      expect(marcas.length, nombre).toBeGreaterThanOrEqual(12);
      expect(container.textContent).toContain("[COMPLETAR]");
      unmount();
    }
  });

  it("cifras muestra [COMPLETAR] en cada valor", () => {
    const { container } = renderizar([cifras]);
    expect(container.querySelectorAll("dd")).toHaveLength(3);
    for (const valor of container.querySelectorAll("dd")) {
      expect(valor.textContent).toContain("[COMPLETAR]");
    }
  });
});
