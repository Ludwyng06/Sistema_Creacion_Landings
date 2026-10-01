import { describe, expect, it } from "vitest";
import { PromptEstructurado, TECNICAS_ID, type TecnicaId } from "@/lib/contratos";
import { combinar, tecnicasEfectivas } from "@/lib/tecnicas/combinador";
import { lintearPrompt } from "@/lib/tecnicas/lista-negra";
import { modulos } from "@/lib/tecnicas/modulos";
import { aTexto } from "@/lib/tecnicas/plantillas";
import { tirarSemilla } from "@/lib/tecnicas/semillas";
import { briefCorrector } from "./briefs";

const numero = (id: TecnicaId) => modulos.find((m) => m.id === id)!.numero;
/** Números de técnica de los aportes, sin repetir consecutivos. */
const ordenAportes = (tecnicas: TecnicaId[]) => {
  const nums = combinar(briefCorrector, tecnicas).aportes.map((a) => numero(a.tecnica));
  return nums.filter((n, i) => n !== nums[i - 1]);
};

describe("combinar · snapshot", () => {
  const { semilla } = tirarSemilla(42);
  const prompt = combinar(briefCorrector, ["semilla", "ambicioso", "critico"], semilla);
  const texto = aTexto(prompt);

  it("tiene los 4 bloques no vacíos y cumple el contrato", () => {
    expect(() => PromptEstructurado.parse(prompt)).not.toThrow();
    for (const b of [prompt.rol, prompt.tarea, prompt.contexto, prompt.formato]) expect(b.trim()).not.toBe("");
  });

  it("la Tarea va numerada 1..N sin saltos", () => {
    const lineas = prompt.tarea.split("\n");
    expect(lineas.map((l) => Number(l.match(/^(\d+)\. /)?.[1]))).toEqual(lineas.map((_, i) => i + 1));
    expect(lineas.length).toBeGreaterThan(8);
  });

  it("el brief aparece una sola vez", () => {
    const bloqueBrief = JSON.stringify(briefCorrector, null, 2);
    expect(texto.split(bloqueBrief)).toHaveLength(2);
    expect(texto.split(briefCorrector.problema)).toHaveLength(2);
  });

  it("la técnica 7 está en los aportes aunque no se pidió", () => {
    expect(prompt.aportes.some((a) => a.tecnica === "negativas")).toBe(true);
    expect(new Set(prompt.aportes.map((a) => a.tecnica))).toEqual(new Set(["ambicioso", "semilla", "negativas", "critico"]));
  });

  it("el rol es una sola frase híbrida con auditor", () => {
    expect(prompt.rol.startsWith("Eres director de arte")).toBe(false); // el estratega va primero por prioridad
    expect(prompt.rol).toMatch(/^Eres estratega de conversión .*, director de arte .* y editor de estilo .*, y trabajas con un auditor senior de UX y CRO/);
    expect(prompt.rol.split("\n")).toHaveLength(1);
  });

  it("el contexto trae tokens, secciones, héroes, efectos por intensidad y ejemplos few-shot", () => {
    expect(prompt.contexto).toContain('"acentoTexto"');
    expect(prompt.contexto).toContain(semilla.estilo);
    for (const tipo of ["heroe", "formulario-lead", "html-libre"]) expect(prompt.contexto).toContain(`\`${tipo}\``);
    for (const v of ["producto-monumental", "mosaico-editorial"]) expect(prompt.contexto).toContain(v);
    expect(prompt.contexto).toContain("`video-scroll` · nivel 3");
    for (const ej of ["Ejemplo A", "Ejemplo B", "Ejemplo C", "Ejemplo D"]) expect(prompt.contexto).toContain(ej);
  });

  it("el formato es un único contrato con razonamiento y control de calidad", () => {
    expect(prompt.formato.match(/Entrega un único objeto JSON `LandingDoc`/g)).toHaveLength(1);
    expect(prompt.formato).toContain("razona paso a paso");
    expect(prompt.formato).toContain("[COMPLETAR]");
  });

  it("con el crítico, el creador no se autoevalúa: la Tarea no puntúa y el Formato excluye `critica`", () => {
    expect(prompt.tarea).not.toMatch(/puntúa|puntua/i);
    expect(prompt.tarea).toContain("Construye el documento para que supere 8/10 en la rúbrica del auditor, que lo evaluará aparte.");
    expect(prompt.contexto).toContain("Factor asombro");
    expect(prompt.formato).toContain("No incluyas el campo `critica`");
    expect(prompt.formato).not.toMatch(/`critica`\s*(\(opcional\))?:/);
    expect(prompt.formato).not.toContain("porCriterio");
    expect(prompt.rol).toContain("trabajas con un auditor senior de UX y CRO que revisará tu entrega");
    // sin el crítico ni siquiera se menciona
    const sinCritico = combinar(briefCorrector, ["ambicioso"], semilla);
    expect(sinCritico.formato).not.toContain("critica");
    expect(sinCritico.tarea).not.toContain("auditor");
  });

  it("las reglas de conflicto van como instrucciones positivas en la Tarea", () => {
    expect(prompt.tarea).toMatch(/mandan los tokens de la semilla, salvo los colores de marca/);
    expect(prompt.tarea).toMatch(/manda el diseño sustractivo/);
    expect(prompt.tarea).toContain("único JSON");
  });

  it("los propios prompts pasan el linter salvo el aporte de la técnica 7", () => {
    expect(lintearPrompt(prompt)).toEqual([]);
    const todas = combinar(briefCorrector, [...TECNICAS_ID], semilla);
    expect(lintearPrompt(todas)).toEqual([]);
  });

  it("snapshot del prompt estructurado y de aTexto", () => {
    expect(prompt).toMatchSnapshot();
    expect(texto).toMatchSnapshot();
  });
});

describe("combinar · orden y perfiles", () => {
  it("['critico','semilla','ambicioso'] produce los aportes en el orden 2, 1, 7, 3", () => {
    expect(ordenAportes(["critico", "semilla", "ambicioso"])).toEqual([2, 1, 7, 3]);
  });

  it("aplica el orden 2 → 1 → 6 → 4 → 5 → 7 → 8 → 3 con las 8 técnicas", () => {
    expect(ordenAportes([...TECNICAS_ID].reverse())).toEqual([2, 1, 6, 4, 5, 7, 8, 3]);
  });

  it("sin técnicas usa el perfil Esencial: aportes de 2, 6 y 7", () => {
    expect(ordenAportes([])).toEqual([2, 6, 7]);
    expect(tecnicasEfectivas([])).toEqual(["ambicioso", "sustractivo", "negativas"]);
  });

  it("la 7 se añade siempre, sin duplicarse si ya venía", () => {
    expect(tecnicasEfectivas(["humana"])).toEqual(["negativas", "humana"]);
    expect(tecnicasEfectivas(["negativas", "humana", "negativas"])).toEqual(["negativas", "humana"]);
  });

  it("con la técnica 1 y sin semilla deriva una reproducible del brief", () => {
    const a = combinar(briefCorrector, ["semilla"]);
    expect(a).toEqual(combinar(briefCorrector, ["semilla"]));
    expect(a.contexto).toContain('"colores"');
    expect(a.rol).toMatch(/«.+ × .+»/);
  });

  it("sin semilla ni técnica 1 no hay tokens y se pide proponerlos", () => {
    const p = combinar(briefCorrector, ["ambicioso"]);
    expect(p.contexto).not.toContain("Tokens de la semilla");
    expect(p.formato).toContain("Propón `tokens`");
  });

  it("con semilla pero sin técnica 1 incluye los tokens como contexto común", () => {
    const p = combinar(briefCorrector, ["ambicioso"], tirarSemilla(5).semilla);
    expect(p.contexto).toContain("Tokens de la semilla");
    expect(p.aportes.some((a) => a.tecnica === "semilla")).toBe(false);
  });

  it("el catálogo de efectos depende de la intensidad del brief", () => {
    const sobria = combinar({ ...briefCorrector, intensidad: 1 }, []);
    expect(sobria.contexto).toContain("`revelar-suave` · nivel 1");
    expect(sobria.contexto).not.toContain("`video-scroll`");
    expect(sobria.contexto).not.toContain("`cursor-vivo`");
    const audaz = combinar({ ...briefCorrector, intensidad: 2 }, []);
    expect(audaz.contexto).toContain("`cursor-vivo`");
    expect(audaz.contexto).not.toContain("`horizontal`");
  });

  it("aplica los colores de marca a los tokens del prompt", () => {
    const p = combinar({ ...briefCorrector, coloresMarca: ["#0055AA"] }, ["semilla"], tirarSemilla(8).semilla);
    expect(p.contexto).toContain("#0055AA");
  });
});
