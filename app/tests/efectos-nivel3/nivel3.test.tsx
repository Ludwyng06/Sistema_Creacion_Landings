// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { CATALOGO_EFECTOS, EFECTOS_ID, MAX_EFECTOS_NIVEL_3, type EfectoId, type LandingDoc, type Seccion } from "@/lib/contratos";
import { efectosDelDoc } from "@/efectos/aplicables";
import { ENVOLTURAS_NIVEL_3, EFECTOS_NIVEL_3_NO_DISPONIBLES, conEfectosNivel3, envolturasDe } from "@/efectos/nivel3";
import { bloquesDe } from "@/efectos/nivel3/PinCoreografia";
import { capasDe } from "@/efectos/nivel3/ProductoExplotado";
import { pistaDe } from "@/efectos/nivel3/Horizontal";
import { rutasDeClip } from "@/efectos/nivel3/VideoScrollFijado";
import { cabeEnPantalla, limitar, progresoAlPasar, progresoFijado, recorridoHorizontal, recorridoPin, umbralBloque } from "@/efectos/nivel3/progreso";
import { LandingRender } from "@/componentes/LandingRender";
import { ejemplo as ejemploAntesDespues } from "@/secciones/antes-despues/ejemplo";
import { ejemplos as ejemplosBeneficios } from "@/secciones/beneficios/ejemplo";
import { ejemplos as ejemplosComoFunciona } from "@/secciones/como-funciona/ejemplo";
import { ejemplos as ejemplosGaleria } from "@/secciones/galeria/ejemplo";
import { ejemplos as ejemplosHeroe } from "@/secciones/heroe/ejemplo";
import { docCon, simularMedia } from "../secciones/ayudas";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const NIVEL_3 = EFECTOS_ID.filter((id) => CATALOGO_EFECTOS[id].nivel === 3);
const con = (s: Seccion, ...efectos: EfectoId[]): Seccion => ({ ...s, efectos });

describe("efectos de nivel 3 · catálogo y registro", () => {
  it("hay 6 efectos de nivel 3 y todos tienen su componente (o están registrados como no disponibles)", () => {
    expect(NIVEL_3).toHaveLength(6);
    for (const id of NIVEL_3) {
      expect(Boolean(ENVOLTURAS_NIVEL_3[id]) || EFECTOS_NIVEL_3_NO_DISPONIBLES.includes(id), id).toBe(true);
    }
  });

  it("un efecto que fija la sección no se combina con otro que también la fija; las ondas sí", () => {
    expect(envolturasDe(["pin-coreografia", "horizontal"])).toEqual(["horizontal"]);
    expect(envolturasDe(["antes-despues-scroll", "pin-coreografia"])).toEqual(["pin-coreografia"]);
    expect(envolturasDe(["shader-ondas", "video-scroll"])).toEqual(["shader-ondas", "video-scroll"]);
    expect(envolturasDe(["revelar-suave", "grano"])).toEqual([]);
  });
});

describe("tope de 3 efectos de nivel 3 en el renderizador", () => {
  const secciones = [
    con(ejemplosHeroe["producto-monumental"], "video-scroll", "producto-explotado"),
    con(ejemplosBeneficios.numerada, "pin-coreografia"),
    con(ejemplosGaleria.carrusel, "horizontal", "shader-ondas"),
    con(ejemploAntesDespues, "antes-despues-scroll"),
  ];
  const doc = docCon(secciones, { tokens: { intensidad: 3 } });

  it("conserva los 3 primeros (en el orden del documento) y descarta el resto", () => {
    const { porSeccion, recortados } = efectosDelDoc(doc);
    const conservados = doc.secciones.flatMap((s) => porSeccion.get(s.id) ?? []).filter((id) => CATALOGO_EFECTOS[id].nivel === 3);
    expect(conservados).toEqual(["video-scroll", "producto-explotado", "pin-coreografia"]);
    expect(recortados).toEqual(["horizontal", "shader-ondas", "antes-despues-scroll"]);
    expect(conservados.length).toBeLessThanOrEqual(MAX_EFECTOS_NIVEL_3);
  });

  it("los efectos de nivel 1 y 2 no cuentan para el tope", () => {
    const d = docCon([con(ejemplosHeroe["producto-monumental"], "revelar-suave", "boton-magnetico", "video-scroll"), con(ejemplosBeneficios.numerada, "pin-coreografia")], { tokens: { intensidad: 3 } });
    expect(efectosDelDoc(d).recortados).toEqual([]);
    expect(efectosDelDoc(d).porSeccion.get(d.secciones[0].id)).toEqual(["revelar-suave", "boton-magnetico", "video-scroll"]);
  });

  it("<LandingRender> avisa en la consola de desarrollo y solo pinta 3 efectos de nivel 3", () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container } = render(<LandingRender doc={doc} />);
    expect(aviso).toHaveBeenCalledWith(expect.stringMatching(/más de 3 efectos de nivel 3.*horizontal, shader-ondas, antes-despues-scroll/));
    const declarados = [...container.querySelectorAll("[data-efectos]")].flatMap((e) => (e.getAttribute("data-efectos") ?? "").split(" "));
    expect(declarados.filter((id) => CATALOGO_EFECTOS[id as EfectoId]?.nivel === 3)).toHaveLength(3);
  });

  it("el nivel de intensidad sigue mandando: con intensidad 2 no se aplica ninguno de nivel 3", () => {
    const d: LandingDoc = docCon(secciones, { tokens: { intensidad: 2 } });
    expect(efectosDelDoc(d).recortados).toEqual([]);
    expect([...efectosDelDoc(d).porSeccion.values()].flat()).toEqual([]);
  });
});

describe("respaldo prefers-reduced-motion de cada efecto de nivel 3", () => {
  for (const id of NIVEL_3) {
    it(`${id}: estático, sin fijar la sección ni pedir recorrido`, () => {
      const restaurar = simularMedia({ reducir: true });
      const { container } = render(<>{conEfectosNivel3(<p>contenido</p>, [id])}</>);
      expect(container.querySelector(`[data-efecto-estatico="${id}"]`)).not.toBeNull();
      expect(container.querySelector("[data-fijado]")).toBeNull();
      expect(container.querySelector("canvas")).toBeNull();
      expect(container.textContent).toBe("contenido");
      restaurar();
    });
  }

  it("con movimiento, los efectos que fijan crean la caja alta (o se apartan si no hay qué animar)", () => {
    const restaurar = simularMedia({ reducir: false });
    const { container } = render(<>{conEfectosNivel3(<p>solo un texto</p>, ["horizontal"])}</>);
    // Sin lista de tarjetas no hay nada que correr de lado: la sección queda como estaba.
    expect(container.querySelector("[data-efecto-inactivo='horizontal']")).not.toBeNull();
    restaurar();
  });
});

describe("cálculos de los efectos", () => {
  it("progreso fijado: 0 al entrar, 1 al terminar el recorrido, sin salirse de rango", () => {
    expect(progresoFijado(0, 2000, 800)).toBe(0);
    expect(progresoFijado(-600, 2000, 800)).toBeCloseTo(0.5, 5);
    expect(progresoFijado(-1200, 2000, 800)).toBe(1);
    expect(progresoFijado(300, 2000, 800)).toBe(0);
    expect(progresoFijado(-5000, 2000, 800)).toBe(1);
    expect(progresoFijado(0, 700, 800)).toBe(0);
  });

  it("si el contenido es más alto que la pantalla, el avance empieza cuando llega abajo", () => {
    // contenido de 1000 en ventana de 800: la caja mide 1000 + 1000 de recorrido
    expect(progresoFijado(-100, 2000, 800, 1000)).toBe(0);
    expect(progresoFijado(-200, 2000, 800, 1000)).toBe(0);
    expect(progresoFijado(-700, 2000, 800, 1000)).toBeCloseTo(0.5, 5);
    expect(progresoFijado(-1200, 2000, 800, 1000)).toBe(1);
  });

  it("progreso al pasar: 0 al asomar y 1 al salir", () => {
    expect(progresoAlPasar(800, 500, 800)).toBe(0);
    expect(progresoAlPasar(-500, 500, 800)).toBe(1);
    expect(progresoAlPasar(150, 500, 800)).toBeCloseTo(0.5, 5);
  });

  it("solo se fija una sección que cabe en pantalla (o hasta la tolerancia pedida)", () => {
    expect(cabeEnPantalla(800, 800)).toBe(true);
    expect(cabeEnPantalla(900, 800)).toBe(false);
    expect(cabeEnPantalla(1200, 800, 1.8)).toBe(true);
  });

  it("recorridos: pin por bloque, horizontal sin negativos y umbrales crecientes", () => {
    expect(recorridoPin(4, 800)).toBe(1920);
    expect(recorridoHorizontal(2000, 800)).toBe(1200);
    expect(recorridoHorizontal(600, 800)).toBe(0);
    const umbrales = [0, 1, 2, 3].map((i) => umbralBloque(i, 4));
    expect(umbrales).toEqual([...umbrales].sort((a, b) => a - b));
    expect(umbrales.at(-1)!).toBeLessThan(1);
    expect(limitar(3)).toBe(1);
  });

  it("las rutas de un clip subido: fotogramas junto al mp4", () => {
    expect(rutasDeClip("/media/abc/clip.mp4", "/media/abc/poster.webp")).toEqual({
      fotogramas: "/media/abc/clip-frames",
      video: "/media/abc/clip.mp4",
      poster: "/media/abc/poster.webp",
    });
    expect(rutasDeClip("/x/a.b.mp4", null).fotogramas).toBe("/x/a.b-frames");
  });
});

describe("selección de elementos de cada efecto", () => {
  it("pin-coreografia usa los li, o los hijos del contenedor si no hay lista", () => {
    const a = document.createElement("div");
    a.innerHTML = "<section><div><ol><li>1</li><li>2</li><li>3</li></ol></div></section>";
    expect(bloquesDe(a)).toHaveLength(3);
    const b = document.createElement("div");
    b.innerHTML = "<section><div><h2>título</h2><div>comparador</div></div></section>";
    expect(bloquesDe(b)).toHaveLength(2);
    expect(bloquesDe(document.createElement("div"))).toHaveLength(0);
  });

  it("horizontal elige la lista con más tarjetas", () => {
    const d = document.createElement("div");
    d.innerHTML = "<ul id='a'><li>1</li><li>2</li></ul><ul id='b'><li>1</li><li>2</li><li>3</li></ul>";
    expect(pistaDe(d)?.id).toBe("b");
    expect(pistaDe(document.createElement("div"))).toBeNull();
  });

  it("producto-explotado toma las imágenes de nivel superior (máx. 5) y no las anidadas", () => {
    const d = document.createElement("div");
    d.innerHTML = '<div class="media-slot"><div class="media-slot"></div></div><div data-marcador-slot="x"></div>' + '<div class="media-slot"></div>'.repeat(6);
    expect(capasDe(d)).toHaveLength(5);
    const solo = document.createElement("div");
    solo.innerHTML = '<div class="media-slot"><div data-marcador-slot="x"></div></div>';
    expect(capasDe(solo)).toHaveLength(1);
  });

  it("como-funciona y beneficios tienen bloques que coreografiar", () => {
    const { container } = render(<LandingRender doc={docCon([ejemplosComoFunciona["pasos-verticales"]])} reducirMovimiento />);
    expect(bloquesDe(container).length).toBeGreaterThanOrEqual(2);
  });
});
