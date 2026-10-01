import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { elegirFuente, rutasDelCierre } from "@/efectos/video-scroll/fuente";
import { APARICION, aparicion } from "@/app/(home)/capitulos/Estaticos";
import { CAPITULOS } from "@/app/(home)/capitulos";

const RAIZ = join(process.cwd(), "public");

describe("capítulo 8 · cierre con video vertical", () => {
  const rutas = rutasDelCierre();

  it("usa el juego de fotogramas, el póster y el mp4 de respaldo del cierre (el mismo en móvil y en escritorio)", () => {
    expect(rutas.fotogramas).toBe("/media/home/home-cierre-frames");
    expect(rutas.poster).toBe("/media/home/home-cierre-poster.webp");
    expect(rutas.video).toBe("/media/home/home-cierre.mp4");
  });

  it("con movimiento reducido se queda el póster fijo; sin fotogramas, el video de respaldo", () => {
    const manifiesto = { n: 64, ancho: 720, alto: 1280, fps: 24, formato: "webp" as const };
    expect(elegirFuente({ movil: true, reducido: true, rutas, disponible: { manifiesto, video: true, poster: true } })).toEqual({ tipo: "poster", src: rutas.poster });
    expect(elegirFuente({ movil: true, reducido: false, rutas, disponible: { manifiesto, video: true, poster: true } }).tipo).toBe("fotogramas");
    expect(elegirFuente({ movil: false, reducido: false, rutas, disponible: { manifiesto: null, video: true, poster: true } }).tipo).toBe("video");
  });

  it("los fotogramas están a resolución nativa (720×1280), en WebP, y caben en 10 MB", () => {
    const carpeta = join(RAIZ, "media", "home", "home-cierre-frames");
    const m = JSON.parse(readFileSync(join(carpeta, "manifest.json"), "utf8"));
    expect(m).toMatchObject({ ancho: 720, alto: 1280, formato: "webp" });
    expect(m.calidad).toBeGreaterThanOrEqual(82);
    expect(m.n).toBeGreaterThanOrEqual(60);
    const archivos = readdirSync(carpeta).filter((f) => f.endsWith(".webp"));
    expect(archivos).toHaveLength(m.n);
    expect(archivos.reduce((s, f) => s + statSync(join(carpeta, f)).size, 0)).toBeLessThanOrEqual(10 * 1024 * 1024);
    expect(existsSync(join(RAIZ, rutas.poster))).toBe(true);
    expect(existsSync(join(RAIZ, rutas.video))).toBe(true);
  });

  it("el titular, la frase y el botón aparecen en orden mientras el sendero avanza", () => {
    expect(aparicion(0, APARICION.titular)).toBe(0);
    expect(aparicion(0.2, APARICION.titular)).toBeCloseTo(0.5);
    expect(aparicion(0.3, APARICION.apoyo)).toBe(0);
    expect(aparicion(0.3, APARICION.titular)).toBe(1);
    expect(aparicion(0.6, APARICION.boton)).toBe(1);
    expect(APARICION.titular[1]).toBeLessThanOrEqual(APARICION.apoyo[0]);
    expect(APARICION.apoyo[1]).toBeLessThanOrEqual(APARICION.boton[0]);
  });

  it("el cierre tiene recorrido de scroll para que el video avance", () => {
    expect(CAPITULOS.find((c) => c.id === "cierre")!.alto).toBeGreaterThanOrEqual(200);
  });
});
