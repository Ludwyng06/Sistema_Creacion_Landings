// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { VideoScroll } from "@/efectos/VideoScroll";
import { CAPITULOS } from "@/app/(home)/capitulos";
import { Escenario } from "@/app/(home)/Escenario";
import { TitularCinetico } from "@/app/(home)/TitularCinetico";
import { capituloEnPantalla, useScrollChapter } from "@/app/(home)/use-scroll-chapter";
import { simularMedia } from "../secciones/ayudas";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function Sonda() {
  const { capitulo, progreso } = useScrollChapter();
  return (
    <p data-testid="sonda" data-progreso={progreso.toFixed(3)}>
      {capitulo.id}
    </p>
  );
}

/** Simula una página de `alto` px vista en una ventana de `ventana` px, desplazada `y` px. */
function fijarScroll(y: number, alto = 10_000, ventana = 800) {
  Object.defineProperty(document.documentElement, "scrollHeight", { configurable: true, value: alto });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: ventana });
  Object.defineProperty(window, "scrollY", { configurable: true, value: y });
  window.dispatchEvent(new Event("scroll"));
}

describe("useScrollChapter", () => {
  beforeEach(() => fijarScroll(0));

  it("devuelve el capítulo según el progreso del scroll, hacia abajo y hacia arriba", async () => {
    render(<Sonda />);
    expect(screen.getByTestId("sonda").textContent).toBe("portada");

    // El progreso es el centro de la pantalla sobre el alto total: cada capítulo se alcanza en su rango.
    for (const c of CAPITULOS) {
      const y = ((c.inicio + c.fin) / 2) * 10_000 - 400;
      await act(async () => fijarScroll(Math.max(0, y)));
      await waitFor(() => expect(screen.getByTestId("sonda").textContent).toBe(c.id));
    }
    for (const c of [...CAPITULOS].reverse()) {
      const y = ((c.inicio + c.fin) / 2) * 10_000 - 400;
      await act(async () => fijarScroll(Math.max(0, y)));
      await waitFor(() => expect(screen.getByTestId("sonda").textContent).toBe(c.id));
    }
  });

  it("al llegar al final de la página el capítulo es el cierre", async () => {
    render(<Sonda />);
    await act(async () => fijarScroll(10_000 - 800));
    await waitFor(() => expect(screen.getByTestId("sonda").textContent).toBe("cierre"));
  });
});

const respuestaCon = (existe: (url: string) => boolean, manifiesto: unknown) =>
  vi.fn(async (url: string) => ({ ok: existe(url), json: async () => manifiesto }) as unknown as Response);

describe("capítulo activo según el diseño real", () => {
  // Reproduce el fallo: el capítulo 4 (pantalla fija de 360 svh) seguía en pantalla mientras el reparto por
  // porcentajes ya marcaba «La semilla», porque los bloques estáticos no miden su alto nominal.
  const cajas = (y: number) => {
    const altos = [400, 300, 300, 360, 360, 90, 130, 130, 100].map((v) => v * 8);
    let acumulado = 0;
    return altos.map((alto, numero) => {
      const top = acumulado - y;
      acumulado += alto;
      return { numero, top, bottom: top + alto };
    });
  };
  const inicio4 = (400 + 300 + 300 + 360) * 8;

  it("mientras el capítulo 4 sigue en pantalla no marca «La semilla»", () => {
    for (const y of [inicio4 + 10, inicio4 + 1500, inicio4 + 360 * 8 - 800]) expect(capituloEnPantalla(cajas(y), 800)).toBe(4);
    expect(capituloEnPantalla(cajas(inicio4 + 360 * 8 - 400 + 20), 800)).toBe(5);
  });

  it("sin secciones en pantalla devuelve null", () => {
    expect(capituloEnPantalla([], 800)).toBeNull();
  });

  it("useScrollChapter usa las secciones reales de la página", async () => {
    const alturas = [3000, 1000];
    const secciones = alturas.map((alto, i) => {
      const el = document.createElement("section");
      el.dataset.capitulo = String(i + 3);
      el.getBoundingClientRect = () => {
        const top = (i === 0 ? 0 : alturas[0]) - window.scrollY;
        return { top, bottom: top + alto, height: alto } as DOMRect;
      };
      document.body.appendChild(el);
      return el;
    });
    render(<Sonda />);
    await act(async () => fijarScroll(500, 4000, 800));
    await waitFor(() => expect(screen.getByTestId("sonda").textContent).toBe("tecnicas"));
    await act(async () => fijarScroll(3000, 4000, 800));
    await waitFor(() => expect(screen.getByTestId("sonda").textContent).toBe("ensamblaje"));
    secciones.forEach((s) => s.remove());
  });
});

describe("VideoScroll · respaldo reduced-motion y selección de fuente", () => {
  beforeEach(() => {
    // jsdom no implementa canvas: se silencia para que el efecto no falle.
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  });

  it("con reduced-motion muestra solo el póster fijo, sin canvas ni video", async () => {
    const restaurar = simularMedia({ reducir: true });
    vi.stubGlobal("fetch", respuestaCon(() => true, { n: 120, ancho: 1600, alto: 900, fps: 24 }));
    const { container } = render(<VideoScroll progreso={createRef<number>() as { current: number }} />);
    await waitFor(() => expect(container.querySelector("[data-video-scroll]")?.getAttribute("data-fuente")).toBe("poster"));
    expect(container.querySelector("canvas")).toBeNull();
    expect(container.querySelector("video")).toBeNull();
    expect(container.querySelector("img")?.getAttribute("src")).toBe("/media/home/home-poster.webp");
    restaurar();
  });

  it("sin reduced-motion y con fotogramas usa el canvas", async () => {
    const restaurar = simularMedia({ reducir: false });
    vi.stubGlobal("fetch", respuestaCon(() => true, { n: 120, ancho: 1600, alto: 900, fps: 24 }));
    const { container } = render(<VideoScroll progreso={{ current: 0 }} />);
    await waitFor(() => expect(container.querySelector("[data-video-scroll]")?.getAttribute("data-fuente")).toBe("fotogramas"));
    expect(container.querySelector("canvas")).not.toBeNull();
    restaurar();
  });

  it("sin fotogramas usa el video; sin nada muestra el marcador de asset con su prompt", async () => {
    const restaurar = simularMedia({ reducir: false });
    vi.stubGlobal("fetch", respuestaCon((u) => u.endsWith(".mp4"), null));
    const a = render(<VideoScroll progreso={{ current: 0 }} />);
    await waitFor(() => expect(a.container.querySelector("[data-video-scroll]")?.getAttribute("data-fuente")).toBe("video"));
    expect(a.container.querySelector("video")?.getAttribute("src")).toBe("/media/home/home-loop.mp4");
    cleanup();

    vi.stubGlobal("fetch", respuestaCon(() => false, null));
    const b = render(<VideoScroll progreso={{ current: 0 }} />);
    await waitFor(() => expect(b.container.querySelector("[data-video-scroll]")?.getAttribute("data-fuente")).toBe("marcador"));
    expect(b.container.textContent).toMatch(/home-loop/);
    restaurar();
  });
});

describe("respaldo reduced-motion de la portada", () => {
  it("el titular cinético queda quieto y con el texto completo", () => {
    const restaurar = simularMedia({ reducir: true });
    render(<TitularCinetico texto="Landings que no parecen hechas por IA." />);
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.getAttribute("data-titular-cinetico")).toBe("quieto");
    expect(h1.getAttribute("aria-label")).toBe("Landings que no parecen hechas por IA.");
    expect(h1.textContent).toBe("Landingsquenoparecenhechaspor" + "IA.");
    restaurar();
  });

  it("el escenario no reserva recorrido de scroll ni queda fijo", () => {
    const restaurar = simularMedia({ reducir: true });
    const { container } = render(
      <Escenario id="portada">
        <p>contenido</p>
      </Escenario>,
    );
    const seccion = container.querySelector("section")!;
    expect(seccion.style.height).toBe("");
    expect(seccion.firstElementChild!.className).not.toMatch(/sticky/);
    restaurar();
  });

  it("con movimiento el escenario reserva su recorrido y deja el contenido fijo", () => {
    const restaurar = simularMedia({ reducir: false });
    const { container } = render(
      <Escenario id="portada">
        <p>contenido</p>
      </Escenario>,
    );
    const seccion = container.querySelector("section")!;
    expect(seccion.style.height).toBe(`${CAPITULOS[0].alto}svh`);
    expect(seccion.firstElementChild!.className).toMatch(/sticky/);
    restaurar();
  });
});
