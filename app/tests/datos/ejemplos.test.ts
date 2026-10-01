import { describe, expect, it } from "vitest";
import { Brief, VARIANTES_HEROE } from "@/lib/contratos";
import { EJEMPLOS } from "@/datos/ejemplos";
import { lintearTexto } from "@/lib/tecnicas/lista-negra";
import { tirarSemilla } from "@/lib/tecnicas/semillas";

function textos(valor: unknown): string[] {
  if (typeof valor === "string") return [valor];
  if (Array.isArray(valor)) return valor.flatMap(textos);
  if (valor && typeof valor === "object") return Object.values(valor).flatMap(textos);
  return [];
}

describe("ejemplos del banco", () => {
  it("son 5, con ids y carpetas únicos", () => {
    expect(EJEMPLOS).toHaveLength(5);
    expect(new Set(EJEMPLOS.map((e) => e.id)).size).toBe(5);
    for (const e of EJEMPLOS) expect(e.carpetaMedia).toBe(`public/media/ejemplos/${e.id}/`);
  });

  it.each(EJEMPLOS.map((e) => [e.id, e] as const))("%s: brief válido, lista negra en cero y sin datos inventados", (_id, e) => {
    expect(() => Brief.parse(e.brief)).not.toThrow();
    const infracciones = textos(e.brief).flatMap((t) => lintearTexto(t));
    expect(infracciones).toEqual([]);
    expect(e.brief.pruebaSocial).toBeUndefined();
    expect(e.brief.oferta).toBeUndefined();
    expect(e.brief.precio.valor % 100).toBe(0);
    expect(e.brief.precio.anterior).toBeGreaterThan(e.brief.precio.valor);
    expect(VARIANTES_HEROE).toContain(e.varianteHeroe);
  });

  it.each(EJEMPLOS.map((e) => [e.id, e] as const))("%s: la semilla reproduce su estilo × industria", (_id, e) => {
    const { semilla } = tirarSemilla(e.numeroSemilla);
    expect({ estilo: semilla.estilo, industria: semilla.industria }).toEqual(e.combinacion);
  });

  it("las técnicas siguen la tabla de docs/06 §4", () => {
    const porId = Object.fromEntries(EJEMPLOS.map((e) => [e.id, e.tecnicas]));
    expect(porId["corrector-postura"]).toEqual(["ambicioso", "sustractivo", "negativas", "humana"]);
    expect(porId["llavero-3en1"]).toHaveLength(8);
    expect(porId["timbre-camara"]).toEqual(["semilla", "imagenes", "video", "negativas"]);
  });
});
