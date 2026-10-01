import { describe, expect, it, vi } from "vitest";
import {
  acercar,
  ajusteCover,
  elegirFuente,
  indiceDeFotograma,
  masCercano,
  nombreFotograma,
  ordenDeCarga,
  probarRecursos,
  rutasDelHome,
  siguienteAPedir,
  USAR_VERTICAL,
  type Disponibilidad,
} from "@/efectos/video-scroll/fuente";

const MANIFIESTO = { n: 120, ancho: 1600, alto: 900, fps: 24 };
const TODO: Disponibilidad = { manifiesto: MANIFIESTO, video: true, poster: true };
const NADA: Disponibilidad = { manifiesto: null, video: false, poster: false };

const elegir = (disponible: Disponibilidad, o: { movil?: boolean; reducido?: boolean; vertical?: boolean } = {}) =>
  elegirFuente({ movil: o.movil ?? false, reducido: o.reducido ?? false, rutas: rutasDelHome(o.movil ?? false, o.vertical ?? false), disponible });

describe("rutas del home", () => {
  it("USAR_VERTICAL está apagado hasta que llegue el clip vertical correcto", () => {
    expect(USAR_VERTICAL).toBe(false);
  });

  it("escritorio y móvil piden su propio juego de fotogramas y su póster; el navegador solo baja el que le toca", () => {
    expect(rutasDelHome(false)).toEqual({ fotogramas: "/media/home/home-loop-frames", video: "/media/home/home-loop.mp4", poster: "/media/home/home-poster.webp" });
    expect(rutasDelHome(true)).toEqual({ fotogramas: "/media/home/home-loop-frames-movil", video: "/media/home/home-loop.mp4", poster: "/media/home/home-poster-movil.webp", enfoque: { x: 0.5, y: 0.5 } });
  });

  it("con el vertical activado, solo el móvil usa home-loop-9x16", () => {
    expect(rutasDelHome(true, true).video).toBe("/media/home/home-loop-9x16.mp4");
    expect(rutasDelHome(true, true).fotogramas).toBe("/media/home/home-loop-9x16-frames");
    expect(rutasDelHome(false, true).video).toBe("/media/home/home-loop.mp4");
  });
});

describe("selector de fuente del video", () => {
  it("prefiere los fotogramas en escritorio y en móvil", () => {
    const e = elegir(TODO);
    expect(e).toMatchObject({ tipo: "fotogramas", carpeta: "/media/home/home-loop-frames", poster: "/media/home/home-poster.webp" });
    expect(elegir(TODO, { movil: true })).toMatchObject({ tipo: "fotogramas", carpeta: "/media/home/home-loop-frames-movil", poster: "/media/home/home-poster-movil.webp" });
    expect(elegir(TODO, { movil: true, vertical: true })).toMatchObject({ tipo: "fotogramas", carpeta: "/media/home/home-loop-9x16-frames" });
  });

  it("sin fotogramas usa el video", () => {
    expect(elegir({ ...TODO, manifiesto: null })).toMatchObject({ tipo: "video", src: "/media/home/home-loop.mp4" });
    expect(elegir({ ...TODO, manifiesto: null }, { movil: true })).toMatchObject({ tipo: "video", src: "/media/home/home-loop.mp4" });
    expect(elegir({ ...TODO, manifiesto: null }, { movil: true, vertical: true })).toMatchObject({ tipo: "video", src: "/media/home/home-loop-9x16.mp4" });
  });

  it("sin fotogramas ni video usa el póster", () => {
    expect(elegir({ manifiesto: null, video: false, poster: true })).toEqual({ tipo: "poster", src: "/media/home/home-poster.webp" });
  });

  it("si no existe nada cae al marcador de asset", () => {
    expect(elegir(NADA)).toEqual({ tipo: "marcador" });
  });

  it("un manifiesto sin fotogramas no cuenta", () => {
    expect(elegir({ ...TODO, manifiesto: { ...MANIFIESTO, n: 0 } })).toMatchObject({ tipo: "video" });
  });

  it("reduced-motion: póster fijo aunque haya fotogramas y video", () => {
    expect(elegir(TODO, { reducido: true })).toEqual({ tipo: "poster", src: "/media/home/home-poster.webp" });
    expect(elegir(TODO, { reducido: true, movil: true })).toEqual({ tipo: "poster", src: "/media/home/home-poster-movil.webp" });
  });

  it("reduced-motion sin póster: marcador", () => {
    expect(elegir({ ...TODO, poster: false }, { reducido: true })).toEqual({ tipo: "marcador" });
  });
});

describe("probarRecursos", () => {
  const respuesta = (ok: boolean, cuerpo?: unknown) => ({ ok, json: async () => cuerpo }) as unknown as Response;

  it("lee el manifiesto y comprueba video y póster", async () => {
    const buscar = vi.fn(async (url: string) => {
      if (url.endsWith("manifest.json")) return respuesta(true, MANIFIESTO);
      return respuesta(true);
    });
    expect(await probarRecursos(rutasDelHome(false), buscar)).toEqual({ manifiesto: MANIFIESTO, video: true, poster: true });
    expect(buscar).toHaveBeenCalledWith("/media/home/home-loop.mp4", { method: "HEAD" });
  });

  it("lo que falla o no existe cuenta como «no está» y nunca lanza", async () => {
    const buscar = vi.fn(async (url: string) => {
      if (url.endsWith(".mp4")) throw new Error("red caída");
      if (url.endsWith("manifest.json")) return respuesta(true, { n: "x" });
      return respuesta(false);
    });
    expect(await probarRecursos(rutasDelHome(false), buscar)).toEqual(NADA);
  });
});

describe("fotogramas", () => {
  it("el índice sigue el progreso y se queda dentro del rango", () => {
    expect(indiceDeFotograma(0, 120)).toBe(0);
    expect(indiceDeFotograma(1, 120)).toBe(119);
    expect(indiceDeFotograma(0.5, 121)).toBe(60);
    expect(indiceDeFotograma(-3, 120)).toBe(0);
    expect(indiceDeFotograma(9, 120)).toBe(119);
    expect(indiceDeFotograma(0.4, 1)).toBe(0);
  });

  it("es monótono: avanzar el scroll nunca retrocede el fotograma, y al revés", () => {
    const pasos = Array.from({ length: 101 }, (_, i) => indiceDeFotograma(i / 100, 120));
    for (let i = 1; i < pasos.length; i++) expect(pasos[i]).toBeGreaterThanOrEqual(pasos[i - 1]);
  });

  it("nombres de archivo con cuatro dígitos desde 0001", () => {
    expect(nombreFotograma(0)).toBe("0001.webp");
    expect(nombreFotograma(119)).toBe("0120.webp");
    expect(nombreFotograma(0, "avif")).toBe("0001.avif");
  });

  it("la precarga carga primero 1 de cada 8 y después el resto, sin repetir", () => {
    const orden = ordenDeCarga(120);
    expect(orden).toHaveLength(120);
    expect(new Set(orden).size).toBe(120);
    expect(orden.slice(0, 15)).toEqual(Array.from({ length: 15 }, (_, i) => i * 8));
    expect(orden[15]).toBe(119); // el último cuadro entra en la primera pasada
    expect(orden.slice(16, 19)).toEqual([1, 2, 3]);
    const corto = ordenDeCarga(10);
    expect(new Set(corto).size).toBe(10);
    expect(corto.slice(0, 3)).toEqual([0, 8, 9]); // el último cuadro también entra en la primera pasada
  });

  it("después de la primera pasada pide lo más cercano, y primero lo que queda en el sentido del scroll", () => {
    const hechos = new Set(ordenDeCarga(120).slice(0, 16));
    // Hacia delante desde el cuadro 40: el siguiente que falta por delante es el 41.
    expect(siguienteAPedir(hechos, 120, 40, 1)).toBe(41);
    // Hacia atrás desde el 40: el 39 (el 40 ya está cargado por ser múltiplo de 8).
    expect(siguienteAPedir(hechos, 120, 40, -1)).toBe(39);
    // Sin dirección: si el cuadro actual no está cargado, es el primero.
    expect(siguienteAPedir(hechos, 120, 43, 0)).toBe(43);
    // Una pieza adelantada le gana a una más cercana que queda detrás del movimiento.
    const pedidos = new Set([...hechos, 39, 38, 41]);
    expect(siguienteAPedir(pedidos, 120, 40, 1)).toBe(42);
    // Cuando no falta ninguno devuelve -1.
    expect(siguienteAPedir(new Set(Array.from({ length: 10 }, (_, i) => i)), 10, 3, 1)).toBe(-1);
  });

  it("pinta el fotograma cargado más cercano mientras llegan los demás", () => {
    const cargados = [1, null, null, null, 1, null, null, null, 1, null];
    expect(masCercano(cargados, 4)).toBe(4);
    expect(masCercano(cargados, 5)).toBe(4);
    expect(masCercano(cargados, 7)).toBe(8);
    expect(masCercano(cargados, 9)).toBe(8);
    expect(masCercano([null, null], 1)).toBe(-1);
  });

  it("recorte tipo cover", () => {
    expect(ajusteCover(1600, 900, 800, 800)).toEqual({ x: -(800 * (1600 / 900) - 800) / 2, y: 0, ancho: 800 * (1600 / 900), alto: 800 });
    expect(ajusteCover(100, 100, 200, 100)).toEqual({ x: 0, y: -50, ancho: 200, alto: 200 });
  });

  it("el suavizado converge al objetivo sin pasarse ni quedarse vibrando", () => {
    let v = 0;
    for (let i = 0; i < 80; i++) {
      const siguiente = acercar(v, 1);
      expect(siguiente).toBeLessThanOrEqual(1);
      expect(siguiente).toBeGreaterThanOrEqual(v);
      v = siguiente;
    }
    expect(v).toBe(1);
    let atras = 1;
    for (let i = 0; i < 80; i++) atras = acercar(atras, 0);
    expect(atras).toBe(0);
  });
});
