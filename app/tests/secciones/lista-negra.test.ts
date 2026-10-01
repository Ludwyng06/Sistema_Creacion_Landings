import { describe, expect, it } from "vitest";
import { DOCUMENTOS_REVISION } from "@/app/dev/secciones/documentos";
import { ASSETS_DE_EJEMPLOS, EJEMPLOS, textos } from "./catalogo-ejemplos";

// Comprobación local con la lista de docs/04 §7 (sin tildes ni mayúsculas). El linter oficial
// (src/lib/tecnicas/lista-negra.ts, de A) llega al integrar; este test evita que B envíe
// ejemplos que después ese linter rechazaría.
const PALABRAS: string[] = [
  "revolucionario",
  "revolucionaria",
  "innovador",
  "innovadora",
  "potenciar",
  "potencia tu",
  "desbloquea",
  "desbloquear",
  "sumergete",
  "descubre el poder",
  "eleva tu",
  "sin igual",
  "de otro nivel",
  "experiencia unica",
  "soluciones integrales",
  "ecosistema",
  "vanguardista",
  "de ultima generacion",
  "transforma tu vida",
  "cambia las reglas del juego",
  "en el mundo actual",
  "en la era digital",
  "no busques mas",
  "imprescindible",
  "magico",
  "increible",
  "asombroso",
  "perfecto para todos",
  "calidad premium",
  "y mucho mas",
];

const PATRONES: { nombre: string; patron: RegExp }[] = [
  { nombre: "lleva tu … al siguiente nivel", patron: /lleva tu .{0,40} al siguiente nivel/ },
  { nombre: "exclamación doble", patron: /!!|¡¡/ },
  { nombre: "No es solo X, es Y", patron: /no es solo .{1,60},? es /i },
];

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

function infracciones(texto: string): string[] {
  const limpio = normalizar(texto);
  const encontradas = PALABRAS.filter((palabra) => limpio.includes(palabra)).map((palabra) => `«${palabra}»`);
  for (const { nombre, patron } of PATRONES) if (patron.test(limpio)) encontradas.push(nombre);
  if ((texto.match(/\p{Extended_Pictographic}/gu) ?? []).length > 1) encontradas.push("más de 1 emoji");
  if ((texto.match(/—/g) ?? []).length > 1) encontradas.push("más de 1 guion largo");
  return encontradas;
}

const FUENTES = {
  "ejemplo.ts de las 18 secciones": EJEMPLOS.map((ejemplo) => ejemplo.seccion),
  "prompts y alt de los slots": ASSETS_DE_EJEMPLOS,
  "documentos de revisión": DOCUMENTOS_REVISION.map(({ doc }) => doc.secciones),
};

describe("ejemplos sin palabras de la lista negra (docs/04 §7)", () => {
  it("el detector encuentra lo que debe bloquear", () => {
    expect(infracciones("Una solución innovadora y revolucionaria")).toEqual(expect.arrayContaining(["«innovadora»", "«revolucionaria»"]));
    expect(infracciones("Sumérgete en la experiencia única")).toEqual(["«sumergete»", "«experiencia unica»"]);
    expect(infracciones("¡Compra ya!!")).toContain("exclamación doble");
    expect(infracciones("Endereza la espalda sin pensarlo")).toEqual([]);
  });

  describe.each(Object.entries(FUENTES))("%s", (_, fuente) => {
    it("cero infracciones", () => {
      const problemas = textos(fuente).flatMap(({ ruta, texto }) =>
        infracciones(texto).map((infraccion) => `${ruta}: «${texto}» → ${infraccion}`),
      );
      expect(problemas).toEqual([]);
    });
  });
});
