// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup } from "@testing-library/react";
import { DOCUMENTOS_REVISION } from "@/app/dev/secciones/documentos";
import { ejemplos as ejemplosHeroe } from "@/secciones/heroe/ejemplo";
import { ASSETS_DE_EJEMPLOS, EJEMPLOS, numeros, textos } from "./catalogo-ejemplos";
import { renderizar } from "./ayudas";

afterEach(cleanup);

// Regla 6: cifras y prueba social solo salen del brief. Los ejemplo.ts son few-shot para la IA,
// así que no pueden enseñarle a inventar calificaciones, precios, testimonios ni fechas.
const PROHIBIDOS: { nombre: string; patron: RegExp }[] = [
  { nombre: "calificación N,N/5", patron: /\d+\s*[.,]\s*\d+\s*\/\s*\d+/ },
  { nombre: "N/5", patron: /\b\d+\s*\/\s*5\b/ },
  {
    nombre: "conteo de opiniones",
    patron: /\d[\d.,]*\s*(?:\+\s*)?(?:opiniones|reseñas|resenas|valoraciones|calificaciones|clientes|compradores|ventas|vendidos)/i,
  },
  { nombre: "estrellas", patron: /★|⭐/ },
  { nombre: "precio", patron: /[$€]\s*\d|\d\s*(?:COP|USD|MXN|EUR)\b/i },
  { nombre: "porcentaje", patron: /\d\s*%/ },
  { nombre: "fecha", patron: /\b(?:19|20)\d{2}-\d{2}-\d{2}\b|\b\d{1,2}\s+de\s+(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/i },
];

// Números que serían una cifra inventada si aparecen con estas claves.
const CLAVES_DE_CIFRA = /(?:^|\.)(?:precio|precioAnterior|dias|estrellas|valor)$/;

const FUENTES = {
  "ejemplo.ts de las 18 secciones": EJEMPLOS.map((ejemplo) => ejemplo.seccion),
  "slots de los ejemplos": ASSETS_DE_EJEMPLOS,
  "documentos de revisión": DOCUMENTOS_REVISION.map(({ doc }) => ({ secciones: doc.secciones, assets: doc.assets })),
};

describe("ejemplos sin cifras inventadas", () => {
  it("el detector reconoce lo que debe bloquear", () => {
    for (const muestra of ["4,8/5 · 1.200 opiniones", "1.200 opiniones", "4.8/5", "★★★★★", "$129.000", "2026-12-31", "30 %"]) {
      expect(PROHIBIDOS.some(({ patron }) => patron.test(muestra)), muestra).toBe(true);
    }
  });

  describe.each(Object.entries(FUENTES))("%s", (_, fuente) => {
    const encontrados = textos(fuente).flatMap(({ ruta, texto }) =>
      PROHIBIDOS.filter(({ patron }) => patron.test(texto)).map(({ nombre }) => `${ruta}: «${texto}» (${nombre})`),
    );
    const inventados = numeros(fuente)
      .filter(({ ruta }) => CLAVES_DE_CIFRA.test(ruta))
      .map(({ ruta, numero }) => `${ruta}: ${numero}`);

    it("no trae calificaciones, conteos, precios, porcentajes ni fechas", () => {
      expect(encontrados).toEqual([]);
    });

    it("no trae números en precio, días, estrellas ni valor", () => {
      expect(inventados).toEqual([]);
    });
  });

  it("ningún ejemplo de héroe define sello", () => {
    for (const seccion of Object.values(ejemplosHeroe)) {
      expect(seccion.ajustes).not.toHaveProperty("sello");
    }
  });

  it("el héroe no pinta sello cuando no viene", () => {
    for (const seccion of Object.values(ejemplosHeroe)) {
      const { container, unmount } = renderizar([seccion]);
      expect(container.querySelector('path[d^="M12 3l2.7"]')).toBeNull(); // icono de estrella del sello
      unmount();
    }
  });

  it("los datos que faltan van como [COMPLETAR] en testimonios, cifras, oferta, garantía y cuenta regresiva", () => {
    for (const tipo of ["testimonios", "cifras", "oferta", "garantia", "cuenta-regresiva"] as const) {
      const ejemplos = EJEMPLOS.filter((ejemplo) => ejemplo.tipo === tipo);
      expect(ejemplos.length, tipo).toBeGreaterThan(0);
      for (const { seccion } of ejemplos) {
        expect(JSON.stringify(seccion.ajustes) + JSON.stringify(seccion.bloques), tipo).toContain("[COMPLETAR]");
      }
    }
  });
});
