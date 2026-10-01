import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CAPTURAS, desplazamientoEn, escalaPara, paradas, seccionVisible } from "@/app/(home)/capturas";

const SECCIONES = [
  { top: 0, alto: 700 },
  { top: 700, alto: 250 },
  { top: 950, alto: 1200 },
];

describe("capturas del home (capítulos 4 y 5)", () => {
  it("cada captura existe en disco con sus medidas y el ensamblaje usa 6 secciones a 390 px", () => {
    expect(CAPTURAS.ensamblaje.secciones).toHaveLength(6);
    for (const s of CAPTURAS.ensamblaje.secciones) {
      expect(s.ancho).toBe(390);
      expect(s.alto).toBeGreaterThan(200);
      expect(existsSync(join(process.cwd(), "public", s.archivo))).toBe(true);
    }
    expect(CAPTURAS.semilla.escritorio).toHaveLength(3);
    expect(CAPTURAS.semilla.movil).toHaveLength(3);
    for (const c of [...CAPTURAS.semilla.escritorio, ...CAPTURAS.semilla.movil]) {
      expect(existsSync(join(process.cwd(), "public", c.archivo))).toBe(true);
      expect(c.secciones.map((s) => s.tipo)).toEqual(["heroe", "sellos-confianza", "beneficios", "galeria", "oferta"]);
    }
    expect(CAPTURAS.semilla.escritorio.every((c) => c.ancho === 1280)).toBe(true);
    expect(CAPTURAS.semilla.movil.every((c) => c.ancho === 390)).toBe(true);
  });

  it("escala para que la captura quepa en el marco", () => {
    expect(escalaPara(390, 312)).toBeCloseTo(0.8);
    expect(escalaPara(1280, 1024)).toBeCloseTo(0.8);
  });

  it("las paradas son 2 por sección, crecientes y cada sección se ve entera en alguna si cabe en la ventana", () => {
    const escala = 0.5;
    const ventana = 400;
    const p = paradas(SECCIONES, escala, ventana);
    expect(p).toHaveLength(6);
    for (let i = 1; i < p.length; i++) expect(p[i]).toBeGreaterThanOrEqual(p[i - 1]);
    // La sección 2 (125 px escalados) cabe: su parada de arriba la deja entera en la ventana.
    expect(p[2]).toBeLessThanOrEqual(350);
    expect(350 + 125).toBeLessThanOrEqual(p[2] + ventana + 1);
    // Nunca se pasa del final de la landing.
    expect(Math.max(...p)).toBeLessThanOrEqual(2150 * escala - ventana);
  });

  it("si la sección es más alta que la ventana hay una parada arriba y otra abajo", () => {
    const p = paradas([{ top: 0, alto: 1000 }], 1, 400);
    expect(p).toEqual([0, 600]);
    const q = paradas([{ top: 0, alto: 200 }, { top: 200, alto: 1000 }, { top: 1200, alto: 300 }], 1, 400);
    expect(q[2]).toBe(200);
    expect(q[3]).toBe(800);
  });

  it("el desplazamiento nunca retrocede y llega a la última parada", () => {
    const p = paradas(SECCIONES, 0.5, 400);
    let previo = -1;
    for (let i = 0; i <= 200; i++) {
      const y = desplazamientoEn(i / 200, p);
      expect(y).toBeGreaterThanOrEqual(previo - 1e-9);
      previo = y;
    }
    expect(desplazamientoEn(0, p)).toBe(p[0]);
    expect(desplazamientoEn(1, p)).toBe(p.at(-1));
    expect(desplazamientoEn(2, p)).toBe(p.at(-1));
  });

  it("la sección visible sigue al desplazamiento", () => {
    expect(seccionVisible(SECCIONES, 1, 0, 400)).toBe(0);
    expect(seccionVisible(SECCIONES, 1, 700, 400)).toBe(1);
    expect(seccionVisible(SECCIONES, 1, 99999, 400)).toBe(2);
  });
});
