// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, screen, waitFor } from "@testing-library/react";
import type { Asset, DatoEnVivo, Seccion } from "@/lib/contratos";
import { textoCreditoCorto } from "@/componentes/CreditoCorto";
import { registro } from "@/secciones/registro";
import { lineasDeCredito } from "@/secciones/creditos/armar";
import { ejemplos as ejemplosCreditos, assetsConCredito } from "@/secciones/creditos/ejemplo";
import { enlaceWhatsapp } from "@/secciones/cta-fija/Componente";
import { ejemplos as ejemplosCta } from "@/secciones/cta-fija/ejemplo";
import { ejemplos as ejemplosCurioso, assets as assetsCurioso } from "@/secciones/dato-curioso/ejemplo";
import { schema as schemaCurioso } from "@/secciones/dato-curioso/schema";
import { ejemplos as ejemplosVivo } from "@/secciones/dato-en-vivo/ejemplo";
import { cuentaRegresiva, frase, horaActualizacion } from "@/secciones/dato-en-vivo/frases";
import { ejemplos as ejemplosFicha } from "@/secciones/ficha-tecnica/ejemplo";
import { schema as schemaFicha } from "@/secciones/ficha-tecnica/schema";
import { ejemplos as ejemplosSellos } from "@/secciones/sellos-confianza/ejemplo";
import { schema as schemaSellos } from "@/secciones/sellos-confianza/schema";
import { VARIANTES_NUEVAS } from "@/secciones/variantes";
import { ejemplo as formulario } from "@/secciones/formulario-lead/ejemplo";
import { ejemplo as oferta } from "@/secciones/oferta/ejemplo";
import { renderizar } from "./ayudas";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const TODOS: [string, Seccion][] = [
  ...Object.entries(ejemplosVivo),
  ...Object.entries(ejemplosCurioso),
  ...Object.entries(ejemplosFicha),
  ...Object.entries(ejemplosSellos),
  ...Object.entries(ejemplosCreditos),
  ...Object.entries(ejemplosCta),
];

const respuesta = (dato: DatoEnVivo | null) =>
  vi.fn<(url: string) => Promise<Response>>(async () => (dato ? new Response(JSON.stringify(dato), { status: 200 }) : new Response(null, { status: 204 })));

const AURORAS: DatoEnVivo = { widget: "auroras", actualizadoEn: "2026-09-30T20:45:00Z", kp: 6, nivel: "alta" };

describe("las 6 secciones nuevas · ejemplos", () => {
  it("son 2 o 3 variantes por tipo, con un ejemplo por cada una", () => {
    for (const [tipo, variantes] of Object.entries(VARIANTES_NUEVAS).filter(([t]) => ["dato-en-vivo", "dato-curioso", "ficha-tecnica", "sellos-confianza", "creditos", "cta-fija"].includes(t))) {
      expect(variantes.length, tipo).toBeGreaterThanOrEqual(2);
      expect(variantes.length, tipo).toBeLessThanOrEqual(5);
      const ejemplos = TODOS.filter(([, s]) => s.tipo === tipo).map(([, s]) => s.variante);
      expect(ejemplos.sort(), tipo).toEqual([...variantes].sort());
    }
  });

  it("están registradas con etiqueta, icono y máximo por landing", () => {
    for (const tipo of Object.keys(VARIANTES_NUEVAS)) {
      const def = registro[tipo as keyof typeof registro];
      expect(def, tipo).toBeDefined();
      expect(def!.etiqueta.length).toBeGreaterThan(0);
      expect(def!.maxPorLanding).toBeGreaterThanOrEqual(1);
    }
  });

  describe.each(TODOS)("ejemplo %s", (_, seccion) => {
    it("cumple el schema de su tipo", () => {
      const { schema } = registro[seccion.tipo]!;
      const resultado = schema.safeParse({ ajustes: seccion.ajustes, bloques: seccion.bloques });
      expect(resultado.success, JSON.stringify(resultado.error?.issues)).toBe(true);
    });

    it("no usa emojis ni colores hex en los textos", () => {
      const json = JSON.stringify(seccion);
      expect(json).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(json).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    });
  });
});

describe("dato-en-vivo", () => {
  it("con un 204 la sección no se renderiza", async () => {
    vi.stubGlobal("fetch", respuesta(null));
    const { container } = renderizar([ejemplosVivo.auroras]);
    await waitFor(() => expect(container.querySelector("[data-widget]")).toBeNull());
    expect(container.querySelector("[data-esqueleto]")).toBeNull();
    expect(container.textContent).toBe("");
  });

  it("con un error de red tampoco se renderiza ni muestra un mensaje de error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("sin red"))));
    const { container } = renderizar([ejemplosVivo.iss]);
    await waitFor(() => expect(container.querySelector("[data-widget]")).toBeNull());
    expect(container.textContent).not.toMatch(/error|falló|no se pudo/i);
  });

  it("con un 500 se oculta", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })));
    const { container } = renderizar([ejemplosVivo.asteroides]);
    await waitFor(() => expect(container.querySelector("[data-widget]")).toBeNull());
  });

  it("mientras carga muestra un esqueleto con el mismo alto mínimo que la tarjeta lista", async () => {
    let liberar: (r: Response) => void = () => {};
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((res) => (liberar = res))));
    const { container } = renderizar([ejemplosVivo.auroras]);
    const tarjeta = () => container.querySelector("section > div")!;
    expect(container.querySelector("[data-esqueleto]")).not.toBeNull();
    const clasesCargando = tarjeta().className.match(/min-h-\S+/g);
    await act(async () => liberar(new Response(JSON.stringify(AURORAS), { status: 200 })));
    await screen.findByText(/Actividad de auroras hoy: alta/);
    expect(container.querySelector("[data-esqueleto]")).toBeNull();
    expect(tarjeta().className.match(/min-h-\S+/g)).toEqual(clasesCargando);
  });

  it("pide /api/vivo/<widget> y muestra la frase con la hora de actualización", async () => {
    const pedir = respuesta(AURORAS);
    vi.stubGlobal("fetch", pedir);
    renderizar([ejemplosVivo.auroras]);
    expect(await screen.findByText(/Actividad de auroras hoy: alta \(Kp 6 de 9\)/)).toBeTruthy();
    expect(pedir.mock.calls[0][0]).toBe("/api/vivo/auroras");
    expect(screen.getByText(/^Actualizado a las 3:45/)).toBeTruthy();
  });

  it("la variante de lanzamiento pide el widget «lanzamiento»", async () => {
    const despegue = new Date(Date.now() + 3 * 86_400_000).toISOString();
    const pedir = respuesta({ widget: "lanzamiento", actualizadoEn: new Date().toISOString(), mision: "Misión de prueba", cohete: "Cohete de prueba", proveedor: null, lugar: null, fechaLanzamiento: despegue });
    vi.stubGlobal("fetch", pedir);
    renderizar([ejemplosVivo["cuenta-regresiva-lanzamiento"]]);
    expect(await screen.findByText("Misión de prueba")).toBeTruthy();
    expect(pedir.mock.calls[0][0]).toBe("/api/vivo/lanzamiento");
    expect(await screen.findByLabelText("Tiempo que falta para el despegue")).toBeTruthy();
  });

  it("descarta una respuesta de otro widget", async () => {
    vi.stubGlobal("fetch", respuesta({ widget: "iss", actualizadoEn: "2026-09-30T20:45:00Z", latitud: 1, longitud: 2, altitudKm: 420, velocidadKmh: 27600 }));
    const { container } = renderizar([ejemplosVivo.auroras]);
    await waitFor(() => expect(container.querySelector("[data-widget]")).toBeNull());
  });

  it("las frases son humanas para cada widget", () => {
    expect(frase({ widget: "fase-lunar", actualizadoEn: "", fase: "Cuarto creciente", iluminacion: 52, proximaLlena: "2026-10-07T00:00:00Z" })).toMatch(/cuarto creciente, con 52 % iluminada.*6 de octubre/);
    expect(frase({ widget: "asteroides", actualizadoEn: "", fecha: "", cantidad: 1, masCercano: null })).toBe("Hoy pasa 1 asteroide cerca de la Tierra.");
    expect(frase({ widget: "asteroides", actualizadoEn: "", fecha: "", cantidad: 12, masCercano: null })).toBe("Hoy pasan 12 asteroides cerca de la Tierra.");
    expect(frase({ widget: "iss", actualizadoEn: "", latitud: 4.71, longitud: -74.07, altitudKm: 420, velocidadKmh: 27600 })).toMatch(/latitud 4,7°/);
    expect(horaActualizacion("no es una fecha")).toBe("");
  });

  it("la cuenta regresiva descompone el tiempo y termina en null", () => {
    const ahora = Date.parse("2026-10-01T00:00:00Z");
    expect(cuentaRegresiva("2026-10-02T01:02:03Z", ahora)).toEqual({ dias: 1, horas: 1, minutos: 2, segundos: 3 });
    expect(cuentaRegresiva("2026-09-30T00:00:00Z", ahora)).toBeNull();
  });
});

describe("ficha-tecnica", () => {
  it("lo que falta queda como [COMPLETAR] y no arrastra la unidad", () => {
    const { container } = renderizar([ejemplosFicha.tabla]);
    expect(container.textContent).toContain("[COMPLETAR]");
    expect(container.textContent).not.toMatch(/\[COMPLETAR\] cm/);
    expect(container.querySelectorAll("tbody tr")).toHaveLength(6);
  });

  it("la variante «fichas» usa una lista de definiciones y muestra la unidad", () => {
    const seccion: Seccion = {
      ...ejemplosFicha.fichas,
      bloques: [
        { id: "a", tipo: "especificacion", ajustes: { nombre: "Alto", valor: 14, unidad: "cm" } },
        { id: "b", tipo: "especificacion", ajustes: { nombre: "Peso", valor: "320", unidad: "g" } },
        { id: "c", tipo: "especificacion", ajustes: { nombre: "Color", valor: "Negro" } },
        { id: "d", tipo: "especificacion", ajustes: { nombre: "Voltaje", valor: "[COMPLETAR]", unidad: "V" } },
      ],
    };
    const { container } = renderizar([seccion]);
    expect(container.querySelectorAll("dl > div")).toHaveLength(4);
    expect(container.textContent).toContain("14 cm");
    expect(container.textContent).toContain("320 g");
  });

  it("exige de 4 a 12 especificaciones", () => {
    const con = (n: number) => ({
      ajustes: { titulo: "Ficha técnica" },
      bloques: Array.from({ length: n }, (_, i) => ({ id: `e${i}`, tipo: "especificacion", ajustes: { nombre: "Medida", valor: "[COMPLETAR]" } })),
    });
    expect(schemaFicha.safeParse(con(3)).success).toBe(false);
    expect(schemaFicha.safeParse(con(4)).success).toBe(true);
    expect(schemaFicha.safeParse(con(12)).success).toBe(true);
    expect(schemaFicha.safeParse(con(13)).success).toBe(false);
  });
});

describe("sellos-confianza", () => {
  it("muestra los sellos con íconos SVG propios y sin emojis", () => {
    const { container } = renderizar([ejemplosSellos["iconos-fila"]]);
    expect(container.querySelectorAll("li")).toHaveLength(4);
    expect(container.querySelectorAll("li svg")).toHaveLength(4);
    expect(container.textContent).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(container.textContent).toContain("Pagas al recibir");
    expect(container.textContent).toContain("Ley 1480");
  });

  it("la franja de texto muestra solo los títulos", () => {
    const { container } = renderizar([ejemplosSellos["franja-texto"]]);
    expect(container.querySelectorAll("li")).toHaveLength(4);
    expect(container.textContent).not.toContain("Ley 1480");
  });

  it("exige de 3 a 5 sellos y rechaza un emoji como ícono", () => {
    const sello = (i: number, icono = "check") => ({ id: `s${i}`, tipo: "sello", ajustes: { icono, titulo: "Pagas al recibir" } });
    const con = (n: number) => ({ ajustes: {}, bloques: Array.from({ length: n }, (_, i) => sello(i)) });
    expect(schemaSellos.safeParse(con(2)).success).toBe(false);
    expect(schemaSellos.safeParse(con(3)).success).toBe(true);
    expect(schemaSellos.safeParse(con(5)).success).toBe(true);
    expect(schemaSellos.safeParse(con(6)).success).toBe(false);
    expect(schemaSellos.safeParse({ ajustes: {}, bloques: [sello(1, "🚚"), sello(2), sello(3)] }).success).toBe(false);
  });
});

describe("dato-curioso", () => {
  it("«sabias-que» muestra la frase con su fuente enlazada", () => {
    const { container } = renderizar([ejemplosCurioso["sabias-que"]]);
    const enlace = container.querySelector("a")!;
    expect(enlace.getAttribute("href")).toBe("https://science.nasa.gov/moon/");
    expect(enlace.getAttribute("rel")).toContain("noopener");
    expect(container.textContent).toContain("Fuente: NASA");
  });

  it("solo acepta fuentes http o https", () => {
    const base = ejemplosCurioso["sabias-que"];
    for (const url of ["javascript:alert(1)", "data:text/html,x", "ftp://x.org"]) {
      expect(schemaCurioso.safeParse({ ajustes: { ...base.ajustes, fuenteUrl: url }, bloques: [] }).success, url).toBe(false);
    }
  });

  it("«real-vs-producto» pone la foto real junto al producto, con el crédito corto", () => {
    const assets: Asset[] = [
      { ...assetsCurioso[0], ruta: "/media/x/real.webp", credito: "NASA/JPL-Caltech", licencia: "dominio-publico-nasa", fuente: "nasa-images" },
      { ...assetsCurioso[1], ruta: "/media/x/producto.webp" },
    ];
    const { container } = renderizar([ejemplosCurioso["real-vs-producto"]], { assets });
    expect(container.querySelectorAll("figure")).toHaveLength(2);
    expect(container.querySelector("[data-credito='dato-real']")?.textContent).toBe("Imagen: NASA/JPL-Caltech");
    expect(container.querySelector("[data-credito='dato-producto']")).toBeNull();
    // Es una comparación, no un héroe: sin h1.
    expect(container.querySelector("h1")).toBeNull();
  });

  it("el crédito corto se acorta sin perder el inicio", () => {
    expect(textoCreditoCorto("  NASA  ")).toBe("NASA");
    expect(textoCreditoCorto(undefined)).toBeNull();
    const largo = "Fotografía de la Agencia Espacial Europea y del Telescopio Espacial James Webb";
    expect(textoCreditoCorto(largo)!.length).toBeLessThanOrEqual(48);
    expect(textoCreditoCorto(largo)!.endsWith("…")).toBe(true);
  });
});

describe("creditos", () => {
  it("se arma sola con los Asset que tienen crédito y licencia, agrupando por autor", () => {
    const lineas = lineasDeCredito(assetsConCredito);
    expect(lineas).toHaveLength(2);
    expect(lineas[0]).toMatchObject({ credito: "NASA/JPL-Caltech", licencia: "Dominio público (NASA)", slots: ["heroe-fondo", "galeria-luna"] });
    const { container } = renderizar([ejemplosCreditos.lista], { assets: assetsConCredito });
    expect(container.querySelectorAll("li")).toHaveLength(2);
    expect(container.textContent).toContain("ESA/Webb, NASA y CSA");
    expect(container.textContent).toContain("CC BY 4.0");
    expect(container.textContent).toMatch(/no está afiliado a la NASA/);
    expect(container.querySelector("a")?.getAttribute("href")).toBe("https://images.nasa.gov/details/PIA00001");
  });

  it("la variante compacta resume todo en un párrafo", () => {
    const { container } = renderizar([ejemplosCreditos.compacta], { assets: assetsConCredito });
    expect(container.querySelectorAll("li")).toHaveLength(0);
    expect(container.querySelector("p")?.textContent).toMatch(/NASA\/JPL-Caltech \(Dominio público \(NASA\)\) · ESA\/Webb/);
  });

  it("sin ningún Asset con crédito y licencia no se muestra", () => {
    const sinCredito: Asset[] = [
      { slot: "a", tipo: "imagen", relacion: "1:1", promptGrok: "x", alt: "x", ruta: "/media/a.webp" },
      { slot: "b", tipo: "imagen", relacion: "1:1", promptGrok: "x", alt: "x", ruta: "/media/b.webp", credito: "Alguien" },
      { slot: "c", tipo: "imagen", relacion: "1:1", promptGrok: "x", alt: "x", credito: "Alguien", licencia: "cc-by-4.0" },
    ];
    expect(lineasDeCredito(sinCredito)).toEqual([]);
    const { container } = renderizar([ejemplosCreditos.lista], { assets: sinCredito });
    expect(container.querySelector("[data-variante]")).toBeNull();
    expect(container.textContent).toBe("");
  });

  it("no acepta enlaces de origen que no sean web", () => {
    const peligroso: Asset[] = [{ ...assetsConCredito[0], urlOrigen: "javascript:alert(1)" }];
    expect(lineasDeCredito(peligroso)[0].urlOrigen).toBeUndefined();
  });
});

describe("cta-fija", () => {
  type Entrada = { isIntersecting: boolean; target: Element };
  const observadores: { selector: string; elementos: Element[]; avisar: (e: Entrada[]) => void }[] = [];

  function simularNavegador({ escritorio }: { escritorio: boolean }) {
    observadores.length = 0;
    class FalsoObservador {
      elementos: Element[] = [];
      constructor(private avisar: (e: Entrada[]) => void) {}
      observe(el: Element) {
        this.elementos.push(el);
        observadores.push({ selector: el.getAttribute("data-tipo") || el.id, elementos: this.elementos, avisar: this.avisar });
      }
      disconnect() {}
    }
    vi.stubGlobal("IntersectionObserver", FalsoObservador);
    vi.stubGlobal("matchMedia", (consulta: string) => ({
      matches: consulta.includes("min-width") ? escritorio : false,
      media: consulta,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
  }

  const ver = (selector: string, visible: boolean) =>
    act(() => {
      for (const o of observadores.filter((x) => x.selector === selector)) o.avisar(o.elementos.map((target) => ({ isIntersecting: visible, target })));
    });

  const landing = (cta: Seccion) => [oferta, formulario, cta];
  const barra = (c: HTMLElement) => c.querySelector<HTMLElement>("[data-cta-fija]")!;

  it("es una barra fija con el CTA al formulario, que reserva su alto al final", () => {
    simularNavegador({ escritorio: false });
    const { container } = renderizar(landing(ejemplosCta["barra-inferior-movil"]));
    expect(barra(container).className).toContain("fixed");
    expect(barra(container).querySelector("a")?.getAttribute("href")).toMatch(/-formulario$/);
    expect(container.querySelector("[aria-hidden='true'].h-20")).not.toBeNull();
    expect(barra(container).dataset.visible).toBe("true");
  });

  it("no tapa el formulario: se oculta mientras el formulario está a la vista", () => {
    simularNavegador({ escritorio: false });
    const { container } = renderizar(landing(ejemplosCta["barra-inferior-movil"]));
    const idFormulario = container.querySelector("form")!.closest("section")!.id;
    ver(idFormulario, true);
    expect(barra(container).dataset.visible).toBe("false");
    expect(barra(container).hasAttribute("inert")).toBe(true);
    ver(idFormulario, false);
    expect(barra(container).dataset.visible).toBe("true");
  });

  it("en escritorio solo aparece cuando la oferta ya no está a la vista", () => {
    simularNavegador({ escritorio: true });
    const { container } = renderizar(landing(ejemplosCta["barra-inferior-movil"]));
    ver("oferta", true);
    expect(barra(container).dataset.visible).toBe("false");
    ver("oferta", false);
    expect(barra(container).dataset.visible).toBe("true");
  });

  it("no aparece mientras el héroe (con su propio botón) sigue a la vista", () => {
    simularNavegador({ escritorio: false });
    const heroe = { ...formulario, id: "h", tipo: "heroe" as const, variante: "problema-primero", ajustes: { titular: "Titular de prueba", textoBoton: "Quiero" }, bloques: [] } as Seccion;
    const { container } = renderizar([heroe, oferta, formulario, ejemplosCta["barra-inferior-movil"]]);
    ver("heroe", true);
    expect(barra(container).dataset.visible).toBe("false");
    ver("heroe", false);
    expect(barra(container).dataset.visible).toBe("true");
  });

  it("en móvil la oferta a la vista no la esconde", () => {
    simularNavegador({ escritorio: false });
    const { container } = renderizar(landing(ejemplosCta["barra-inferior-movil"]));
    ver("oferta", true);
    expect(barra(container).dataset.visible).toBe("true");
  });

  it("el WhatsApp flotante lleva al formulario mientras el número sea [COMPLETAR]", () => {
    simularNavegador({ escritorio: false });
    const { container } = renderizar(landing(ejemplosCta["whatsapp-flotante"]));
    const enlace = container.querySelector<HTMLAnchorElement>("[data-cta-fija='whatsapp-flotante']")!;
    expect(enlace.getAttribute("href")).toMatch(/#.+-formulario$/);
    expect(enlace.getAttribute("aria-label")).toBe("Escríbenos por WhatsApp");
    expect(enlace.querySelector("svg")).not.toBeNull();
  });

  it("arma el enlace de WhatsApp solo con un número válido", () => {
    expect(enlaceWhatsapp("573001234567", "Hola, quiero pedirlo")).toBe("https://wa.me/573001234567?text=Hola%2C%20quiero%20pedirlo");
    expect(enlaceWhatsapp("[COMPLETAR]", "Hola")).toBeNull();
    expect(enlaceWhatsapp("javascript:1", undefined)).toBeNull();
    expect(enlaceWhatsapp(undefined, undefined)).toBeNull();
  });

  it("no queda dentro de un contenedor con content-visibility (ni con animación de entrada)", () => {
    simularNavegador({ escritorio: false });
    const { container } = renderizar(landing(ejemplosCta["barra-inferior-movil"]));
    const envoltura = container.querySelector("[data-tipo='cta-fija']")!;
    expect(envoltura.className).not.toContain("seccion-diferida");
    expect(envoltura.querySelector("[class^='entrada-']")).toBeNull();
  });
});
