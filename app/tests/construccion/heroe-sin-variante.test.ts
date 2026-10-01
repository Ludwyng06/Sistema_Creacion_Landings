import { describe, expect, it } from "vitest";
import { VARIANTE_HEROE_POR_DEFECTO, repararVarianteHeroe } from "@/lib/ia/construir";
import { corrida } from "./heroe-sin-variante.ayuda";

describe("héroe que llega sin variante (Groq)", () => {
  it("repararVarianteHeroe rellena la variante ausente, nula o vacía y respeta las demás", () => {
    const doc = {
      secciones: [
        { tipo: "heroe", ajustes: {} },
        { tipo: "heroe", variante: null },
        { tipo: "heroe", variante: "" },
        { tipo: "heroe", variante: "poster-a-sangre" },
        { tipo: "heroe", variante: "hero-a-la-izquierda" },
        { tipo: "faq" },
      ],
    };
    const r = repararVarianteHeroe(doc) as typeof doc & { secciones: { variante?: string }[] };
    expect(r.secciones.map((s) => s.variante)).toEqual([
      VARIANTE_HEROE_POR_DEFECTO,
      VARIANTE_HEROE_POR_DEFECTO,
      VARIANTE_HEROE_POR_DEFECTO,
      "poster-a-sangre",
      "hero-a-la-izquierda", // fuera del catálogo: no se toca y el validador sigue rechazándolo
      undefined,
    ]);
    expect(doc.secciones[0]).not.toHaveProperty("variante"); // no muta la entrada
  });

  it("repararVarianteHeroe deja pasar lo que no es un documento", () => {
    expect(repararVarianteHeroe(null)).toBeNull();
    expect(repararVarianteHeroe("x")).toBe("x");
    expect(repararVarianteHeroe({ secciones: 3 })).toEqual({ secciones: 3 });
  });

  it("la construcción acepta la respuesta sin variante y el héroe queda con la variante por defecto", async () => {
    const c = await corrida();
    expect(c.error).toBeUndefined();
    expect(c.resultado).toBeDefined();
    expect(c.resultado!.doc.secciones[0].variante).toBe(VARIANTE_HEROE_POR_DEFECTO);
    expect(c.resultado!.salud.find((s) => s.id === "esquema")!.estado).not.toBe("rojo");
    expect(c.llamadas.filter((l) => l.tarea === "landing")).toHaveLength(1); // sin reintento por esquema
  });
});
