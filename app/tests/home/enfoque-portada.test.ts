import { describe, expect, it } from "vitest";
import { ajusteCover, ENFOQUE_CENTRADO, objectPosition } from "@/efectos/video-scroll/fuente";

describe("enfoque del recorte (móvil sin clip vertical)", () => {
  it("por defecto centra, igual que object-fit: cover", () => {
    expect(ajusteCover(1024, 576, 390, 844)).toEqual(ajusteCover(1024, 576, 390, 844, ENFOQUE_CENTRADO));
  });

  it("con el enfoque a la izquierda deja a la vista la fila de celulares", () => {
    const centro = ajusteCover(1024, 576, 390, 844);
    const izquierda = ajusteCover(1024, 576, 390, 844, { x: 0.28, y: 0.5 });
    expect(izquierda.x).toBeGreaterThan(centro.x); // la imagen se corre a la derecha: se ve más de su parte izquierda
    expect(izquierda.x).toBeLessThanOrEqual(0); // sigue cubriendo todo el lienzo
    expect(izquierda.x + izquierda.ancho).toBeGreaterThanOrEqual(390);
    expect(izquierda.alto).toBe(centro.alto);
  });

  it("escribe object-position en porcentajes", () => {
    expect(objectPosition({ x: 0.28, y: 0.5 })).toBe("28% 50%");
  });
});
