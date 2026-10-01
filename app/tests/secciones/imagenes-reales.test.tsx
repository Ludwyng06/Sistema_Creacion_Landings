// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import type { Asset, Seccion } from "@/lib/contratos";
import { VARIANTES_HEROE } from "@/lib/contratos";
import { ejemplos as galeria } from "@/secciones/galeria/ejemplo";
import { ejemplos as heroes } from "@/secciones/heroe/ejemplo";
import { schema as schemaHeroe } from "@/secciones/heroe/schema";
import { renderizar } from "./ayudas";

afterEach(cleanup);

const foto = (slot: string, relacion: Asset["relacion"], extra: Partial<Asset> = {}): Asset => ({
  slot,
  tipo: "imagen",
  relacion,
  promptGrok: "prompt de prueba",
  alt: `Foto ${slot}`,
  ruta: `/media/vitrina/prueba/${slot}.webp`,
  ...extra,
});

const ESPACIALES = ["producto-monumental", "poster-a-sangre", "video-inmersivo"] as const;

function heroeEspacial(variante: (typeof ESPACIALES)[number]): Seccion {
  return {
    ...heroes[variante as keyof typeof heroes],
    ajustes: { titular: "El cielo entero en tu cuarto", subtitular: "Proyecta auroras en el techo.", textoBoton: "Quiero el mío", slot: "heroe-producto", slots: ["heroe-fondo"] },
    bloques: [],
  };
}

const ASSETS_ESPACIALES = [
  foto("heroe-fondo", "16:9", { fuente: "nasa-images", credito: "NASA/JPL-Caltech", licencia: "dominio-publico-nasa" }),
  foto("heroe-producto", "4:5"),
];

describe("imágenes reales en MediaSlot", () => {
  it("con ruta usa <img> con srcset y sizes, carga diferida salvo en el héroe", () => {
    const { container } = renderizar([galeria.mosaico], {
      assets: ["galeria-1", "galeria-2", "galeria-3", "galeria-4"].map((s) => foto(s, "4:5")),
    });
    const imagenes = [...container.querySelectorAll("img")];
    expect(imagenes).toHaveLength(4);
    for (const img of imagenes) {
      expect(img.getAttribute("loading")).toBe("lazy");
      expect(img.getAttribute("fetchpriority")).toBeNull();
      expect(img.getAttribute("srcset")).toMatch(/\d+w/);
      expect(img.getAttribute("sizes")).toBeTruthy();
    }
  });

  it("el héroe carga de inmediato y con fetchpriority alta", () => {
    const { container } = renderizar([heroes["producto-monumental"]], { assets: [foto("heroe-producto", "4:5")] });
    const img = container.querySelector("img")!;
    expect(img.getAttribute("loading")).toBe("eager");
    expect(img.getAttribute("fetchpriority")).toBe("high");
  });

  it("sin ruta se muestra el marcador con su prompt, como hasta ahora", () => {
    const { container } = renderizar([galeria.mosaico]);
    expect(container.querySelectorAll("img")).toHaveLength(0);
    expect(container.textContent).toMatch(/galeria-1/);
  });
});

describe("imágenes que no cargan", () => {
  const assets = ["galeria-1", "galeria-2", "galeria-3", "galeria-4"].map((s) => foto(s, "4:5"));

  it("si una imagen falla (onError) se reemplaza por el marcador «Imagen pendiente», sin <img> roto ni texto alternativo", () => {
    const { container } = renderizar([galeria.mosaico], { assets });
    const imagenes = [...container.querySelectorAll("img")];
    expect(imagenes).toHaveLength(4);
    fireEvent.error(imagenes[1]);
    expect(container.querySelectorAll("img")).toHaveLength(3);
    const marcador = container.querySelector("[data-marcador-slot='galeria-2']")!;
    expect(marcador).toBeTruthy();
    expect(marcador.textContent).toMatch(/Imagen pendiente/);
    expect(container.textContent).not.toMatch(/Foto galeria-2/);
    // Las demás imágenes siguen igual.
    expect(container.querySelector("[data-marcador-slot='galeria-1']")).toBeNull();
  });

  it("en el editor el marcador de una imagen rota ofrece «Buscar en bancos» para ese slot", () => {
    const buscar = vi.fn();
    const { container, getAllByRole } = renderizar([galeria.mosaico], { assets, onBuscarBancos: buscar });
    fireEvent.error(container.querySelectorAll("img")[0]);
    const boton = getAllByRole("button", { name: "Buscar en bancos" });
    expect(boton).toHaveLength(1);
    fireEvent.click(boton[0]);
    expect(buscar).toHaveBeenCalledWith("galeria-1");
  });

  it("en la página pública el marcador de una imagen rota no muestra botones", () => {
    const { container, queryAllByRole } = renderizar([galeria.mosaico], { assets });
    fireEvent.error(container.querySelectorAll("img")[0]);
    expect(queryAllByRole("button", { name: "Buscar en bancos" })).toHaveLength(0);
  });
});

describe("héroes espaciales con fondo del banco", () => {
  it("el schema acepta el fondo en slots[0]", () => {
    for (const v of ESPACIALES) {
      const s = heroeEspacial(v);
      expect(schemaHeroe.safeParse({ ajustes: s.ajustes, bloques: s.bloques }).success, v).toBe(true);
    }
  });

  it.each(ESPACIALES)("«%s» pone el fondo con velo y el producto delante, sin partir el héroe", (variante) => {
    const { container } = renderizar([heroeEspacial(variante)], { assets: ASSETS_ESPACIALES });
    const seccion = container.querySelector("[data-heroe-espacial]")!;
    expect(seccion).not.toBeNull();
    expect(seccion.querySelector("[data-velo]")).not.toBeNull();
    // Fondo y producto, cada uno con su archivo.
    const rutas = [...seccion.querySelectorAll("img")].map((i) => i.getAttribute("alt"));
    expect(rutas).toEqual(["Foto heroe-fondo", "Foto heroe-producto"]);
    // El producto ocupa casi todo el alto del héroe (4:5): al menos el 45 % del área visual.
    const producto = seccion.querySelector("[data-producto]")!;
    expect(producto.className).toMatch(/w-\[min\(100%,calc\(96svh\*0\.8\)\)\]/);
    // Regla 1: nada de texto a un lado e imagen al otro.
    expect(seccion.outerHTML).not.toMatch(/(?:^|[\s"])(?:\w+:)?(?:flex-row|grid-cols-[2-9])(?=[\s"])/);
    expect(seccion.querySelectorAll("h1")).toHaveLength(1);
  });

  it("el fondo y el producto de la variante de video: el fondo es un video con su póster", () => {
    const assets = [
      { ...foto("heroe-fondo", "16:9"), tipo: "video" as const, ruta: "/media/vitrina/prueba/fondo.mp4" },
      foto("heroe-fondo-poster", "16:9"),
      foto("heroe-producto", "4:5"),
    ];
    const { container } = renderizar([heroeEspacial("video-inmersivo")], { assets });
    const video = container.querySelector("video")!;
    expect(video.getAttribute("src")).toBe("/media/vitrina/prueba/fondo.mp4");
    expect(video.getAttribute("poster")).toBe("/media/vitrina/prueba/heroe-fondo-poster.webp");
  });

  it("sin slotFondo las tres variantes se ven como antes", () => {
    for (const v of ESPACIALES) {
      const { container } = renderizar([heroes[v as keyof typeof heroes]]);
      expect(container.querySelector("[data-heroe-espacial]"), v).toBeNull();
    }
    expect(ESPACIALES.every((v) => (VARIANTES_HEROE as readonly string[]).includes(v))).toBe(true);
  });
});

describe("crédito corto sobre la imagen", () => {
  it("la galería muestra el crédito de cada imagen que lo trae", () => {
    const assets = [
      foto("galeria-1", "4:5", { credito: "NASA/JPL-Caltech", licencia: "dominio-publico-nasa" }),
      foto("galeria-2", "4:5"),
      foto("galeria-3", "4:5", { credito: "ESA/Webb, NASA y CSA", licencia: "cc-by-4.0" }),
      foto("galeria-4", "4:5"),
    ];
    const { container } = renderizar([galeria.mosaico], { assets });
    const creditos = [...container.querySelectorAll("[data-credito]")].map((c) => c.textContent);
    expect(creditos).toEqual(["Imagen: NASA/JPL-Caltech", "Imagen: ESA/Webb, NASA y CSA"]);
  });

  it("no hay crédito si la imagen todavía es un marcador", () => {
    const assets = [foto("galeria-1", "4:5", { ruta: undefined, credito: "NASA/JPL-Caltech" })];
    const { container } = renderizar([galeria.mosaico], { assets });
    expect(container.querySelector("[data-credito]")).toBeNull();
  });
});
