import { describe, expect, it } from "vitest";
import type { LandingDoc } from "@/lib/contratos";
import { lintearDoc, lintearTexto } from "@/lib/tecnicas/lista-negra";
import { landingEjemplo } from "../fixtures/landing-ejemplo";

const reglas = (texto: string) => lintearTexto(texto).map((i) => i.regla);

describe("lintearTexto · un positivo por regla", () => {
  it("palabra vetada (sin distinguir mayúsculas ni tildes)", () => {
    expect(lintearTexto("Un corrector revolucionario para tu espalda.")).toEqual([
      { ruta: "", regla: "palabra-vetada", fragmento: "revolucionario" },
    ]);
    expect(reglas("Diseño INNOVADOR y sumergete en la oferta")).toEqual(["palabra-vetada", "palabra-vetada"]);
    expect(reglas("Descubre el poder de tu postura")).toEqual(["palabra-vetada"]);
    expect(reglas("¡Y mucho más!")).toEqual(["palabra-vetada"]);
    expect(reglas("Ya es imprescindible y mágico")).toEqual(["palabra-vetada", "palabra-vetada"]);
  });

  it("emoji: más de uno por texto", () => {
    expect(reglas("Postura 💪")).toEqual([]);
    expect(reglas("Postura 💪🔥")).toEqual(["emoji"]);
  });

  it("exclamación doble", () => {
    expect(reglas("¡Llévalo hoy!")).toEqual([]);
    expect(reglas("¡Llévalo hoy!!")).toEqual(["exclamacion-doble"]);
  });

  it("«no es solo X, es Y»", () => {
    expect(reglas("No es solo un corrector, es un aliado diario.")).toEqual(["no-es-solo"]);
    expect(reglas("No es un corrector cualquiera.")).toEqual([]);
  });

  it("más de un guion largo por párrafo", () => {
    expect(reglas("Ligero — cómodo y discreto.")).toEqual([]);
    expect(reglas("Ligero — cómodo — discreto.")).toEqual(["guion-largo"]);
    expect(reglas("Ligero — cómodo.\nDiscreto — útil.")).toEqual([]);
  });

  it("«lleva tu … al siguiente nivel»", () => {
    expect(reglas("Lleva tu postura al siguiente nivel")).toEqual(["siguiente-nivel"]);
    expect(reglas("Llévalo al siguiente piso")).toEqual([]);
  });

  it("«calidad premium»", () => {
    expect(reglas("Materiales de calidad premium")).toEqual(["calidad-premium"]);
  });

  it("promesas médicas o absolutas", () => {
    for (const frase of [
      "Cura el dolor de espalda",
      "Elimina para siempre la mala postura",
      "Resultado 100 % garantizado",
      "Resultado 100% garantizado",
      "Sin efectos secundarios",
      "Resultados inmediatos",
    ]) {
      expect(reglas(frase), frase).toEqual(["promesa-absoluta"]);
    }
  });

  it("devuelve el fragmento original con su tilde y la ruta recibida", () => {
    expect(lintearTexto("Es un producto increíble.", "campo")).toEqual([
      { ruta: "campo", regla: "palabra-vetada", fragmento: "increíble" },
    ]);
  });
});

describe("lintearTexto · falsos positivos controlados", () => {
  it.each([
    "El potencial de tu espalda",
    "Potencia de vibración: 3 niveles",
    "La innovación en sensores",
    "Un método que procura comodidad",
    "© 2026 Marca™",
    "El ecosistemas de apps no se menciona aquí",
    "Pasas 8 horas frente al computador y la espalda te lo cobra a las 4 p. m.",
    "Quiero que me contacten hoy",
  ])("no marca: %s", (texto) => {
    expect(lintearTexto(texto)).toEqual([]);
  });
});

describe("lintearDoc", () => {
  it("el documento de ejemplo queda en cero", () => {
    expect(lintearDoc(landingEjemplo)).toEqual([]);
  });

  it("informa la ruta exacta de cada campo, en ajustes y en bloques", () => {
    const doc: LandingDoc = structuredClone(landingEjemplo);
    doc.secciones[1].ajustes.historia = "Un giro revolucionario.";
    doc.secciones[2].bloques[0].ajustes.texto = "Es mágico!!";
    const inf = lintearDoc(doc);
    expect(inf).toContainEqual({ ruta: "secciones[1].ajustes.historia", regla: "palabra-vetada", fragmento: "revolucionario" });
    expect(inf.map((i) => [i.ruta, i.regla])).toContainEqual(["secciones[2].bloques[0].ajustes.texto", "palabra-vetada"]);
    expect(inf.map((i) => [i.ruta, i.regla])).toContainEqual(["secciones[2].bloques[0].ajustes.texto", "exclamacion-doble"]);
  });

  it("recorre arreglos anidados", () => {
    const doc: LandingDoc = structuredClone(landingEjemplo);
    doc.secciones[5].ajustes.campos = ["nombre", "innovador"];
    expect(lintearDoc(doc).map((i) => i.ruta)).toEqual(["secciones[5].ajustes.campos[1]"]);
  });
});
