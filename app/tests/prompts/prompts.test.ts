import { describe, expect, it } from "vitest";
import { VITRINA } from "@/datos/vitrina";
import { tirarSemilla, tokensParaBrief } from "@/lib/tecnicas/semillas";
import { CONTEXTO_FIDELIDAD } from "@/lib/ia/conocimiento";
import { textoBrief, textoInvestigacion, textoSemilla } from "@/lib/ia/prompts/contexto";
import { EJEMPLO_ESTRATEGIA, Estrategia, promptEstrategia } from "@/lib/ia/prompts/estrategia";
import { EJEMPLO_PLAN, PlanSecciones, promptPlan } from "@/lib/ia/prompts/plan";
import { ejemploDeSeccion, promptSeccion } from "@/lib/ia/prompts/seccion";
import { CriticaDelModelo, EJEMPLO_CRITICA, promptCritico } from "@/lib/ia/prompts/critico";
import { EJEMPLO_PROMPTS_IMAGEN, promptImagenes, PromptsImagen } from "@/lib/ia/prompts/imagen";
import { SISTEMA_VALIDAR_IMAGEN, usuarioValidarImagen, ValidacionImagen } from "@/lib/ia/prompts/validar-imagen";
import { lintearTexto } from "@/lib/tecnicas/lista-negra";
import { VARIANTES_HEROE } from "@/lib/contratos";

const e = VITRINA.find((x) => x.slug === "proyector-galaxias-auroras")!;
const { semilla } = tirarSemilla(e.numeroSemilla, e.brief.intensidad);
const tokens = tokensParaBrief(semilla, e.brief);
const brief = textoBrief(e.brief);
const investigacion = textoInvestigacion({
  consultadoEn: "2026-09-30T12:00:00Z",
  fuentes: [{ fuente: "nasa-images", estado: "ok" }],
  preguntas: ["¿Se ve bien con la luz encendida?"],
  preciosReferencia: [{ titulo: "Proyector de galaxias", precio: 99900, tienda: "Tienda X" }],
  composicionReferencia: [],
  especificaciones: [{ nombre: "Alimentación", valor: "USB", fuente: "Vendedor" }],
});
const semillaTxt = textoSemilla(semilla, tokens);
const estrategia = JSON.stringify(EJEMPLO_ESTRATEGIA);

const SECCIONES = ["ROL", "TAREA", "CONOCIMIENTO", "RESTRICCIONES", "FORMATO", "AUTOCONTROL"];

function verificarEstructura(p: { sistema: string; usuario: string }) {
  for (const s of SECCIONES) expect(p.sistema, s).toContain(`## ${s}`);
  expect(p.usuario).toContain("## CONTEXTO");
  // orden obligatorio
  const idx = SECCIONES.map((s) => p.sistema.indexOf(`## ${s}`));
  expect([...idx].sort((a, b) => a - b)).toEqual(idx);
  expect(p.sistema).toContain("Antes de responder revisa");
}

describe("prompts profesionales: estructura ROL, TAREA, CONTEXTO, CONOCIMIENTO, RESTRICCIONES, FORMATO y AUTOCONTROL", () => {
  it("estrategia", () => {
    const p = promptEstrategia({ contextoBrief: brief, contextoInvestigacion: investigacion, contextoSemilla: semillaTxt });
    verificarEstructura(p);
    expect(p.sistema).toContain("COMPRADOR COLOMBIANO");
    expect(p.sistema).toContain("ECUACIÓN DE VALOR");
    expect(p.usuario).toContain("Precios de referencia");
    expect(p).toMatchSnapshot();
    expect(Estrategia.safeParse(EJEMPLO_ESTRATEGIA).success).toBe(true);
  });

  it("estrategia con ángulo forzado", () => {
    const p = promptEstrategia({ contextoBrief: brief, contextoInvestigacion: "", contextoSemilla: semillaTxt, anguloForzado: "Costo acumulado de no resolverlo" });
    expect(p.usuario).toContain("ÁNGULO OBLIGATORIO");
    expect(p.usuario).toContain("Sin datos externos");
  });

  it("plan de secciones", () => {
    const p = promptPlan({ contextoBrief: brief, contextoEstrategia: estrategia, contextoInvestigacion: investigacion, obligatorias: ["heroe", "beneficios", "oferta", "faq"], opcionales: ["comparativa"], delSistema: ["sellos-confianza", "ficha-tecnica"], variantesHeroe: VARIANTES_HEROE, espacial: true });
    verificarEstructura(p);
    expect(p.sistema).toContain("una sola garantía");
    expect(p).toMatchSnapshot();
    expect(PlanSecciones.safeParse(EJEMPLO_PLAN).success).toBe(false); // el ejemplo es corto a propósito: 6 a 12 en la vida real
  });

  it("redacción de una sección, con esquema exacto y ejemplo, para cada tipo que escribe la IA", () => {
    for (const tipo of ["heroe", "beneficios", "galeria", "oferta", "faq", "garantia", "formulario-lead", "incluye", "problema-solucion", "como-funciona", "cinta-anuncio", "comparativa"] as const) {
      const p = promptSeccion({ tipo, plan: { tipo, variante: null, objetivoPsicologico: "Responder la duda principal del visitante.", notasCopy: "Usar el dato del brief y matar la objeción del envío.", datoAUsar: "Precio y garantía del vendedor." }, contextoBrief: brief, contextoEstrategia: estrategia, contextoInvestigacion: investigacion, titularesPrevios: ["Un titular previo"], slots: [{ slot: "heroe-fondo", que: "fondo" }] });
      verificarEstructura(p);
      expect(p.sistema, tipo).toContain("Ejemplo de salida excelente");
      expect(ejemploDeSeccion(tipo), tipo).not.toBeNull();
      expect(p.sistema).toContain('"properties"');
    }
    const p = promptSeccion({ tipo: "faq", plan: { tipo: "faq", variante: null, objetivoPsicologico: "Responder la duda principal del visitante.", notasCopy: "Usar las preguntas reales de la investigación con respuesta corta.", datoAUsar: "Preguntas reales." }, contextoBrief: brief, contextoEstrategia: estrategia, contextoInvestigacion: investigacion, titularesPrevios: [], slots: [], correccion: "Acortar la respuesta 2." });
    expect(p.usuario).toContain("CORRECCIÓN PEDIDA POR EL CRÍTICO");
    expect(p).toMatchSnapshot();
  });

  it("crítico desacoplado: misma rúbrica y escala, con el contexto de fidelidad y sin la estrategia", () => {
    const p = promptCritico({ documento: { secciones: [{ tipo: "heroe" }] }, contextoBrief: brief });
    verificarEstructura(p);
    expect(p.sistema).toContain(CONTEXTO_FIDELIDAD);
    expect(p.sistema).toContain("Claridad en 3 s (20 %)");
    expect(p.sistema).toContain("Factor asombro (10 %)");
    expect(p.usuario).not.toContain("mecanismoUnico");
    expect(p).toMatchSnapshot();
    expect(CriticaDelModelo.safeParse(EJEMPLO_CRITICA).success).toBe(true);
  });

  it("prompts de imagen: ficha común, un prompt por slot y restricciones", () => {
    const p = promptImagenes({ contextoBrief: brief, contextoEstrategia: estrategia, contextoSemilla: semillaTxt, producto: "Proyector blanco compacto", slots: [{ slot: "heroe-producto", que: "el producto en una habitación oscura", relacion: "1:1" }, { slot: "galeria-3", que: "detalle", relacion: "4:5" }] });
    verificarEstructura(p);
    expect(p.sistema).toContain("ficha común");
    expect(p.sistema).toContain("no people");
    expect(p).toMatchSnapshot();
    expect(PromptsImagen.safeParse(EJEMPLO_PROMPTS_IMAGEN).success).toBe(true);
  });

  it("validar imagen: pregunta por lo esperado, texto, logos y personas", () => {
    expect(SISTEMA_VALIDAR_IMAGEN).toContain("logos");
    expect(SISTEMA_VALIDAR_IMAGEN).toContain("personas identificables");
    expect(usuarioValidarImagen("un cepillo dental eléctrico")).toContain("un cepillo dental eléctrico");
    expect(ValidacionImagen.safeParse({ apta: true, motivo: "Muestra el cepillo sobre fondo blanco", confianza: 0.9 }).success).toBe(true);
    expect({ sistema: SISTEMA_VALIDAR_IMAGEN, usuario: usuarioValidarImagen("un cepillo dental eléctrico") }).toMatchSnapshot();
  });

  it("los ejemplos de los prompts pasan la lista negra", () => {
    const textos = [JSON.stringify(EJEMPLO_ESTRATEGIA), JSON.stringify(EJEMPLO_PLAN), JSON.stringify(EJEMPLO_PROMPTS_IMAGEN)];
    for (const t of textos) expect(lintearTexto(t)).toEqual([]);
  });
});
