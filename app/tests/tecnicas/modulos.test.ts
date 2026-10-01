import { describe, expect, it } from "vitest";
import { LandingDoc, PromptEstructurado, TECNICAS_ID, type ModuloTecnica, type TecnicaId } from "@/lib/contratos";
import { lintearPrompt } from "@/lib/tecnicas/lista-negra";
import { moduloPorId, modulos } from "@/lib/tecnicas/modulos";
import { verificarAmbicioso } from "@/lib/tecnicas/modulos/ambicioso";
import { RUBRICA_CRITICO, generarPromptCritico } from "@/lib/tecnicas/modulos/critico";
import { BLOQUE_CONSISTENCIA } from "@/lib/tecnicas/modulos/imagenes";
import { longitudMediaFrase } from "@/lib/tecnicas/modulos/humana";
import { tirarSemilla } from "@/lib/tecnicas/semillas";
import { landingEjemplo } from "../fixtures/landing-ejemplo";
import { briefCorrector } from "./briefs";

const copia = (): LandingDoc => structuredClone(landingEjemplo);
const verificar = (id: TecnicaId, doc: LandingDoc) => moduloPorId(id).verificador!(doc);
const rutas = (id: TecnicaId, doc: LandingDoc) => verificar(id, doc).problemas.map((p) => p.ruta);

describe("los 8 módulos", () => {
  it("están ordenados por número y cubren todas las técnicas", () => {
    expect(modulos.map((m) => m.numero)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(modulos.map((m) => m.id).sort()).toEqual([...TECNICAS_ID].sort());
    expect(() => LandingDoc.parse(landingEjemplo)).not.toThrow();
  });

  it("tienen fases y prioridades de docs/04", () => {
    const fase = Object.fromEntries(modulos.map((m) => [m.numero, m.fase]));
    expect(fase).toEqual({
      1: "descubrir", 2: "descubrir", 3: "definir", 4: "entregar",
      5: "entregar", 6: "definir", 7: "entregar", 8: "entregar",
    });
    const porPrioridad = [...modulos].sort((a, b) => a.prioridad - b.prioridad).map((m) => m.numero);
    expect(porPrioridad).toEqual([2, 1, 6, 4, 5, 7, 8, 3]);
    expect(new Set(modulos.map((m) => m.prioridad)).size).toBe(8);
  });

  it.each(modulos.map((m) => [m.id, m] as [TecnicaId, ModuloTecnica]))(
    "%s: prompt individual con los 4 bloques, aportes propios y sin infracciones",
    (id, m) => {
      const { semilla } = tirarSemilla(11);
      const p = m.generarPromptIndividual(briefCorrector, semilla);
      expect(() => PromptEstructurado.parse(p)).not.toThrow();
      for (const bloque of [p.rol, p.tarea, p.contexto, p.formato]) expect(bloque.trim().length).toBeGreaterThan(20);
      expect(p.aportes.length).toBeGreaterThan(0);
      expect(new Set(p.aportes.map((a) => a.tecnica))).toEqual(new Set([id]));
      expect(p.aportes.some((a) => a.bloque === "rol")).toBe(true);
      expect(p.aportes.some((a) => a.bloque === "tarea")).toBe(true);
      expect(p.tarea.split("\n").map((l) => l.match(/^(\d+)\. /)?.[1])).toEqual(
        p.tarea.split("\n").map((_, i) => String(i + 1)),
      );
      expect(lintearPrompt(p)).toEqual([]);
      expect(p.rol).not.toContain("{");
      expect(p.contexto).toContain(briefCorrector.nombre);
    },
  );

  it("el prompt individual sin semilla no deja marcadores sin rellenar", () => {
    for (const m of modulos) {
      const p = m.generarPromptIndividual(briefCorrector);
      expect(`${p.rol}${p.tarea}${p.contexto}${p.formato}`).not.toMatch(/\{(estilo|industria|paletaId|tipografiaId|numero)\}/);
    }
  });
});

describe("verificadores", () => {
  it("semilla: pasa con el ejemplo y falla con color no hex o tipografía fuera de la biblioteca", () => {
    expect(verificar("semilla", copia()).ok).toBe(true);
    const mal = copia();
    mal.tokens.colores.acento = "rojo";
    mal.tokens.tipografia.titulos = "Comic Sans";
    expect(rutas("semilla", mal)).toEqual(["tokens.colores.acento", "tokens.tipografia.titulos"]);
  });

  it("ambicioso: cada sección con objetivo y cada objeción respondida", () => {
    expect(verificarAmbicioso(landingEjemplo, briefCorrector).ok).toBe(true);
    expect(verificar("ambicioso", copia()).ok).toBe(true);

    const sinObjetivo = copia();
    sinObjetivo.secciones[2].intencion.objetivo = "  ";
    expect(rutas("ambicioso", sinObjetivo)).toEqual(["secciones[2].intencion.objetivo"]);

    const conObjecionNueva = { ...briefCorrector, objeciones: [...briefCorrector.objeciones, "¿Es seguro para la piel?"] };
    const r = verificarAmbicioso(landingEjemplo, conObjecionNueva);
    expect(r.ok).toBe(false);
    expect(r.problemas[0].mensaje).toContain("¿Es seguro para la piel?");
  });

  it("ambicioso: el verificador del módulo usa el brief cuando llega", () => {
    const verificador = moduloPorId("ambicioso").verificador!;
    expect(verificador(landingEjemplo, briefCorrector).ok).toBe(true);
    const r = verificador(landingEjemplo, { ...briefCorrector, objeciones: ["¿Funciona con niños?"] });
    expect(r.ok).toBe(false);
    expect(r.problemas[0]).toMatchObject({ ruta: "secciones", severidad: "error" });
    expect(r.problemas[0].mensaje).toContain("¿Funciona con niños?");
    expect(verificador(landingEjemplo).ok).toBe(true); // sin brief solo revisa los objetivos
  });

  it("ambicioso: una objeción también cuenta si está en objecionQueResponde", () => {
    const doc = copia();
    doc.secciones[3].intencion.objecionQueResponde = "¿Es seguro para la piel?";
    const b = { ...briefCorrector, objeciones: ["¿Es seguro para la piel?"] };
    expect(verificarAmbicioso(doc, b).ok).toBe(true);
  });

  it("sustractivo: presupuesto, objetivos únicos y formulario de máximo 3 campos", () => {
    expect(verificar("sustractivo", copia()).ok).toBe(true);

    const pocas = LandingDoc.parse(copia());
    pocas.secciones = pocas.secciones.slice(0, 4);
    expect(rutas("sustractivo", pocas)).toEqual(["secciones"]);

    const repetido = copia();
    repetido.secciones[3].intencion.objetivo = repetido.secciones[2].intencion.objetivo;
    expect(rutas("sustractivo", repetido)).toEqual(["secciones[3].intencion.objetivo"]);

    const largo = copia();
    largo.secciones[5].ajustes.campos = ["nombre", "correo", "telefono", "direccion"];
    expect(rutas("sustractivo", largo)).toEqual(["secciones[5].ajustes.campos"]);

    const conOpcionales = copia();
    conOpcionales.secciones[5].ajustes.campos = ["nombre", "correo", "telefono", "ciudad", "mensaje"];
    expect(verificar("sustractivo", conOpcionales).ok).toBe(true);
  });

  it("negativas: lintearDoc en cero", () => {
    expect(verificar("negativas", copia()).ok).toBe(true);
    const mal = copia();
    mal.secciones[0].ajustes.subtitular = "Una solución revolucionaria";
    const r = verificar("negativas", mal);
    expect(r.ok).toBe(false);
    expect(r.problemas[0].ruta).toBe("secciones[0].ajustes.subtitular");
  });

  it("humana: botones sin etiquetas genéricas y frases de 8 a 18 palabras", () => {
    expect(verificar("humana", copia()).ok).toBe(true);

    for (const etiqueta of ["Enviar", "Saber más", "Click aquí", "Comprar ahora"]) {
      const mal = copia();
      mal.secciones[5].ajustes.textoBoton = etiqueta;
      expect(rutas("humana", mal), etiqueta).toEqual(["secciones[5].ajustes.textoBoton"]);
    }

    const largas = copia();
    largas.secciones[1].ajustes.historia =
      "Trabajas sentado durante ocho horas seguidas frente al computador mientras los hombros se van hacia adelante sin que lo notes en ningún momento del día y al llegar a casa sientes la espalda cargada.";
    expect(rutas("humana", largas)).toEqual(["secciones"]);

    const cortas = copia();
    cortas.secciones[1].ajustes.historia = "Hoy. Sí. Ya. Trabajas sentado y los hombros avanzan. Se nota mucho. Mejor así.";
    expect(rutas("humana", cortas)).toEqual(["secciones"]); // frases entrecortadas: media menor que 8

    const breve = copia();
    breve.secciones[1].ajustes.historia = "Hoy. Sí. Ya."; // menos de 12 palabras: no cuenta como texto largo
    expect(verificar("humana", breve).ok).toBe(true);
  });

  it("humana: la longitud media se calcula por frases", () => {
    expect(longitudMediaFrase([])).toBeNull();
    expect(longitudMediaFrase(["Uno dos tres. Cuatro cinco seis siete!"])).toBe(3.5);
  });

  it("video: efectos del catálogo, compatibles con la sección y máximo 3 de nivel 3", () => {
    expect(verificar("video", copia()).ok).toBe(true);

    const incompatible = copia();
    incompatible.secciones[4].efectos = ["horizontal"]; // faq
    expect(rutas("video", incompatible)).toEqual(["secciones[4].efectos[0]"]);

    const inventado = copia();
    inventado.secciones[0].efectos = ["efecto-inventado" as never];
    expect(rutas("video", inventado)).toEqual(["secciones[0].efectos[0]"]);

    const exceso = copia();
    exceso.secciones[0].variante = "producto-monumental";
    exceso.secciones[0].efectos = ["video-scroll", "producto-explotado"];
    exceso.secciones[2].efectos = ["pin-coreografia", "horizontal"];
    const r = verificar("video", exceso);
    expect(r.ok).toBe(false);
    expect(r.problemas.map((p) => p.ruta)).toEqual(["secciones"]);
    expect(r.problemas[0].mensaje).toContain("4 efectos de nivel 3");

    const variante = copia();
    variante.secciones[0].efectos = ["video-scroll"]; // problema-primero no lo admite
    expect(rutas("video", variante)).toEqual(["secciones[0].efectos[0]"]);

    const intensidad = copia();
    intensidad.tokens.intensidad = 1;
    expect(rutas("video", intensidad)).toContain("secciones[0].efectos[0]"); // titular-cinetico es nivel 2
  });

  it("imagenes: cada asset con promptGrok y el bloque de consistencia", () => {
    const r = verificar("imagenes", copia());
    expect(r.ok).toBe(false);
    expect(r.problemas[0].ruta).toBe("assets[0].promptGrok");

    const bien = copia();
    bien.assets[0].promptGrok = `Postural corrector on cream backdrop. ${BLOQUE_CONSISTENCIA}`;
    expect(verificar("imagenes", bien).ok).toBe(true);

    const vacio = copia();
    vacio.assets[0].promptGrok = "";
    expect(verificar("imagenes", vacio).ok).toBe(false);

    const sinAssets = copia();
    sinAssets.assets = [];
    expect(rutas("imagenes", sinAssets)).toEqual(["assets"]);
  });

  it("generarPromptCritico: 4 bloques con la rúbrica, el brief y el doc, y solo el JSON Critica", () => {
    const p = generarPromptCritico(landingEjemplo, briefCorrector);
    expect(() => PromptEstructurado.parse(p)).not.toThrow();
    for (const bloque of [p.rol, p.tarea, p.contexto, p.formato]) expect(bloque.trim()).not.toBe("");
    expect(p.rol).toContain("auditor senior de UX y CRO");
    expect(p.tarea).toMatch(/^1\. Puntúa cada criterio de la rúbrica de 0 a 10 y cita/);
    expect(p.tarea).toContain("campo exacto del JSON");
    expect(p.tarea).toContain("operaciones aplicables sobre el JSON");
    expect(p.tarea.split("\n").map((l) => l.slice(0, 2))).toEqual(["1.", "2.", "3."]);
    expect(p.contexto).toContain(RUBRICA_CRITICO);
    expect(p.contexto).toContain(JSON.stringify(landingEjemplo, null, 2));
    expect(p.contexto).toContain(briefCorrector.problema);
    expect(p.formato).toContain("Entrega únicamente el JSON `Critica`");
    expect(p.formato).not.toContain("LandingDoc");
    expect(new Set(p.aportes.map((a) => a.tecnica))).toEqual(new Set(["critico"]));
    expect(lintearPrompt(p)).toEqual([]);
  });

  it("el prompt individual del crítico es el del creador: no pide `critica` ni puntuar", () => {
    const p = moduloPorId("critico").generarPromptIndividual(briefCorrector);
    expect(p.tarea).not.toMatch(/puntúa/i);
    expect(p.formato).toContain("No incluyas el campo `critica`");
    expect(p.contexto).toContain(RUBRICA_CRITICO);
  });

  it("critico: existe critica.puntaje", () => {
    expect(rutas("critico", copia())).toEqual(["critica.puntaje"]);
    const bien = copia();
    bien.critica = { puntaje: 8.4, porCriterio: [], problemas: [], correcciones: [] };
    expect(verificar("critico", bien).ok).toBe(true);
  });
});
