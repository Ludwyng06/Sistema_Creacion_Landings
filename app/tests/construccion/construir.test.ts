import { describe, expect, it } from "vitest";
import { z } from "zod";
import { LandingDoc } from "@/lib/contratos";
import { TABLA_TAREAS_POR_DEFECTO } from "@/lib/ia/enrutador";
import { ErrorIA } from "@/lib/ia/tipos";
import { BLOQUE_CONSISTENCIA } from "@/lib/tecnicas/modulos/imagenes";
import { lintearDoc } from "@/lib/tecnicas/lista-negra";
import { tirarSemilla, tokensParaBrief } from "@/lib/tecnicas/semillas";
import { briefCorrector, correr, critica, docBase, docConTitular, manejadorBase } from "./ayudas";

const titular = (doc: { secciones: { ajustes: Record<string, unknown> }[] }) => doc.secciones[0].ajustes.titular;

describe("crítico con vueltas", () => {
  it("7 → segunda vuelta con 8,5: termina con 1 vuelta extra y guarda la de 8,5", async () => {
    const puntajes = [7, 8.5];
    const c = await correr(
      ["gemini", "groq"],
      manejadorBase({
        landing: ({ n }) => docConTitular(`Versión ${n}`),
        critico: ({ n }) => critica(puntajes[n - 1]),
      }),
    );
    expect(c.resultado).toBeDefined();
    expect(c.resultado!.vueltasCritico).toBe(1);
    expect(c.resultado!.doc.critica?.puntaje).toBe(8.5);
    expect(titular(c.resultado!.doc)).toBe("Versión 2");
    expect(c.llamadas.filter((l) => l.tarea === "landing")).toHaveLength(2);
    expect(c.llamadas.filter((l) => l.tarea === "critico")).toHaveLength(2);
  });

  it("6 → 7 → 6,5: para en 2 vueltas y guarda la de 7", async () => {
    const puntajes = [6, 7, 6.5];
    const c = await correr(
      ["gemini", "groq"],
      manejadorBase({
        landing: ({ n }) => docConTitular(`Versión ${n}`),
        critico: ({ n }) => critica(puntajes[n - 1]),
      }),
    );
    expect(c.resultado!.vueltasCritico).toBe(2);
    expect(c.resultado!.doc.critica?.puntaje).toBe(7);
    expect(titular(c.resultado!.doc)).toBe("Versión 2");
    expect(c.llamadas.filter((l) => l.tarea === "landing")).toHaveLength(3);
    expect(c.llamadas.filter((l) => l.tarea === "critico")).toHaveLength(3);
  });

  it("con puntaje de 8 o más no hay vueltas y las correcciones viajan al creador cuando sí las hay", async () => {
    const sinVuelta = await correr(["gemini"], manejadorBase({ critico: () => critica(8) }));
    expect(sinVuelta.resultado!.vueltasCritico).toBe(0);
    expect(sinVuelta.llamadas.filter((l) => l.tarea === "landing")).toHaveLength(1);

    const conVuelta = await correr(["gemini"], manejadorBase({ critico: ({ n }) => critica(n === 1 ? 5 : 9) }));
    const regeneracion = conVuelta.llamadas.filter((l) => l.tarea === "landing")[1];
    expect(regeneracion.usuario).toContain("5.0 de 10");
    expect(regeneracion.usuario).toContain("El titular es largo");
    expect(regeneracion.usuario).toContain("acortar a 8 palabras");
  });

  it("si el crítico falla, entrega la landing sin crítica y con aviso", async () => {
    const c = await correr(
      ["gemini"],
      manejadorBase({
        critico: () => {
          throw new ErrorIA("limite", "sin cuota");
        },
      }),
    );
    expect(c.resultado).toBeDefined();
    expect(c.resultado!.doc.critica).toBeUndefined();
    expect(c.resultado!.avisos.some((a) => a.includes("crítico"))).toBe(true);
    expect(c.eventos).toContainEqual(expect.objectContaining({ tipo: "tarea", tarea: "critico", estado: "error" }));
  });
});

describe("t0 y validación", () => {
  it("emite las tareas en curso y ok con proveedor y tiempo, y termina con resultado", async () => {
    const c = await correr(["gemini", "groq"], manejadorBase());
    const tareas = c.eventos.filter((e) => e.tipo === "tarea");
    expect(tareas.slice(0, 2).map((e) => [e.tarea, e.estado])).toEqual([
      ["landing", "en-curso"],
      ["prompts-grok", "en-curso"],
    ]);
    const ok = tareas.find((e) => e.tarea === "landing" && e.estado === "ok");
    expect(ok).toMatchObject({ proveedor: "gemini" });
    expect(typeof ok!.ms).toBe("number");
    expect(c.eventos.at(-1)!.tipo).toBe("resultado");
    expect(c.resultado!.salud).toHaveLength(8);
    expect(c.resultado!.proveedores).toMatchObject({ landing: "gemini", critico: "groq" });
  });

  it("impone los tokens y la semilla del sistema", async () => {
    const c = await correr(["gemini"], manejadorBase());
    const { semilla } = tirarSemilla(42, 3);
    expect(c.resultado!.doc.tokens).toEqual(tokensParaBrief(semilla, briefCorrector));
    expect(c.resultado!.doc.meta.semilla).toEqual(semilla);
    expect(c.resultado!.doc.meta.tecnicas).toEqual(["ambicioso", "sustractivo", "negativas"]);
    expect(() => LandingDoc.parse(c.resultado!.doc)).not.toThrow();
  });

  it("el prompt del creador no pide `critica` y el esquema de la IA es LandingDoc sin crítica", async () => {
    const c = await correr(["gemini"], manejadorBase());
    const landing = c.llamadas.find((l) => l.tarea === "landing")!;
    expect(landing.usuario).toContain("1. Genera el documento `LandingDoc`");
    expect(() => z.toJSONSchema(LandingDoc.omit({ critica: true }))).not.toThrow();
  });

  it("esquema rojo: 1 regeneración con los errores y luego sigue", async () => {
    const c = await correr(
      ["gemini"],
      manejadorBase({ landing: ({ n }) => docConTitular(n === 1 ? "" : "Titular válido") }),
    );
    const llamadasLanding = c.llamadas.filter((l) => l.tarea === "landing");
    expect(llamadasLanding[0].usuario).not.toContain("no cumplió el esquema");
    expect(llamadasLanding[1].usuario).toContain("no cumplió el esquema");
    expect(llamadasLanding[1].usuario).toContain("secciones[0].ajustes.titular");
    expect(titular(c.resultado!.doc)).toBe("Titular válido");
  });

  it("estructura roja (sin formulario): regeneración con el problema en el mensaje", async () => {
    const sinFormulario = () => {
      const d = docBase();
      d.secciones = d.secciones.filter((s) => s.tipo !== "formulario-lead");
      return d;
    };
    const c = await correr(["gemini"], manejadorBase({ landing: ({ n }) => (n === 1 ? sinFormulario() : docBase()) }));
    const llamadasLanding = c.llamadas.filter((l) => l.tarea === "landing");
    expect(llamadasLanding[1].usuario).toContain("no cumplió la estructura");
    expect(llamadasLanding[1].usuario).toContain("Falta el formulario de lead");
    expect(c.resultado!.doc.secciones.some((s) => s.tipo === "formulario-lead")).toBe(true);
    expect(c.eventos).toContainEqual(expect.objectContaining({ tarea: "landing", estado: "en-curso", mensaje: "regeneración 1 por estructura" }));

    const persistente = await correr(["gemini"], manejadorBase({ landing: () => sinFormulario() }));
    expect(persistente.llamadas.filter((l) => l.tarea === "landing")).toHaveLength(3); // 2 regeneraciones como máximo
    expect(persistente.resultado!.avisos.some((a) => a.includes("estructura sigue en rojo"))).toBe(true);
  });

  it("esquema rojo persistente: evento error legible", async () => {
    const c = await correr(["gemini"], manejadorBase({ landing: () => docConTitular("") }));
    expect(c.resultado).toBeUndefined();
    expect(c.error!.mensaje).toContain("no cumple el esquema");
    expect(c.error!.mensaje).toContain("secciones[0].ajustes.titular");
    expect(c.llamadas.filter((l) => l.tarea === "landing")).toHaveLength(3); // la original y 2 regeneraciones
  });

  it("cascada agotada en la landing: evento manual con el prompt y los intentos", async () => {
    const c = await correr(
      ["gemini", "groq"],
      manejadorBase({
        landing: () => {
          throw new ErrorIA("limite", "sin cuota");
        },
      }),
    );
    expect(c.resultado).toBeUndefined();
    expect(c.manual!.intentos.map((i) => [i.proveedor, i.tipo])).toEqual([
      ["gemini", "limite"],
      ["gemini", "limite"], // el límite se reintenta una vez antes de pasar al siguiente
      ["groq", "limite"],
      ["groq", "limite"],
    ]);
    expect(c.manual!.prompt.sistema).toContain("JSON Schema");
    expect(c.manual!.prompt.usuario).toContain("Brief del producto");
    expect(c.eventos.at(-1)!.tipo).toBe("manual");
  });
});

describe("prompts-grok", () => {
  it("si falla, es un aviso: se usa la plantilla sin IA con el bloque de consistencia", async () => {
    const c = await correr(
      ["gemini", "groq"],
      manejadorBase({
        "prompts-grok": () => {
          throw new ErrorIA("limite", "sin cuota");
        },
      }),
    );
    expect(c.error).toBeUndefined();
    expect(c.resultado!.avisos.some((a) => a.includes("prompts-grok") && a.includes("plantilla sin IA"))).toBe(true);
    expect(c.eventos).toContainEqual(expect.objectContaining({ tipo: "tarea", tarea: "prompts-grok", estado: "error" }));
    const asset = c.resultado!.doc.assets[0];
    expect(asset.promptGrok).toContain(BLOQUE_CONSISTENCIA);
    expect(asset.promptGrok).toContain(briefCorrector.nombre);
  });

  it("los prompts de la IA completan o reemplazan los del doc por slot", async () => {
    const c = await correr(
      ["gemini", "groq"],
      manejadorBase({
        "prompts-grok": () => ({
          assets: [
            { slot: "oferta-producto", tipo: "imagen", relacion: "4:5", promptGrok: "Prompt de Grok para la oferta", alt: "x" },
            { slot: "otro", tipo: "imagen", relacion: "1:1", promptGrok: "Sin slot en el doc", alt: "y" },
          ],
        }),
      }),
    );
    const assets = c.resultado!.doc.assets;
    expect(assets).toHaveLength(1);
    expect(assets[0].promptGrok).toBe(`Prompt de Grok para la oferta ${BLOQUE_CONSISTENCIA}`);
    expect(assets[0].alt).toBe("Corrector de postura sobre fondo crema"); // conserva lo que dijo el doc
  });
});

describe("t1 · lista negra y humanizar", () => {
  const conInfracciones = (protegido = false) => {
    const d = docBase();
    const faq = d.secciones[4];
    faq.bloques = Array.from({ length: 8 }, (_, i) => ({
      id: `faq-${i}`,
      tipo: "pregunta",
      ajustes: { pregunta: `¿Pregunta ${i} sobre el producto revolucionario?`, respuesta: "[COMPLETAR]" },
    }));
    if (protegido) faq.editadoPorHumano = ["bloques[0].ajustes.pregunta"];
    return d;
  };
  const corrector = ({ usuario }: { usuario: string }) => {
    const items = JSON.parse(usuario.slice(usuario.indexOf("["))) as { ruta: string }[];
    return { correcciones: items.map((i, k) => ({ ruta: i.ruta, texto: `¿Pregunta corregida ${k}?` })) };
  };

  it("corrige las infracciones por lotes de hasta 10 campos", async () => {
    const doc = conInfracciones();
    doc.secciones[4].bloques = doc.secciones[4].bloques.map((b) => ({
      ...b,
      ajustes: { ...b.ajustes, respuesta: "Una respuesta increíble para todos." },
    })); // 16 campos con infracción → lotes de 10 y 6
    const c = await correr(["gemini", "groq"], manejadorBase({ landing: () => doc, "corregir-lista-negra": corrector }));
    const lotes = c.llamadas.filter((l) => l.tarea === "corregir-lista-negra");
    expect(lotes).toHaveLength(2);
    expect(lotes.map((l) => (JSON.parse(l.usuario.slice(l.usuario.indexOf("["))) as unknown[]).length).sort((a, b) => a - b)).toEqual([6, 10]);
    expect(lintearDoc(c.resultado!.doc).filter((i) => i.regla === "palabra-vetada" && i.ruta.includes("pregunta"))).toEqual([]);
    expect(c.resultado!.doc.secciones[4].bloques[0].ajustes.pregunta).toMatch(/^¿Pregunta corregida/);
    expect(c.eventos).toContainEqual(expect.objectContaining({ tipo: "tarea", tarea: "corregir-lista-negra", estado: "ok" }));
  });

  it("respeta editadoPorHumano: no envía ni cambia los campos protegidos", async () => {
    const c = await correr(["gemini", "groq"], manejadorBase({ landing: () => conInfracciones(true), "corregir-lista-negra": corrector }));
    const enviados = c.llamadas.filter((l) => l.tarea === "corregir-lista-negra").map((l) => l.usuario).join("\n");
    expect(enviados).not.toContain("secciones[4].bloques[0].ajustes.pregunta");
    expect(enviados).toContain("secciones[4].bloques[1].ajustes.pregunta");
    const bloques = c.resultado!.doc.secciones[4].bloques;
    expect(bloques[0].ajustes.pregunta).toBe("¿Pregunta 0 sobre el producto revolucionario?");
    expect(bloques[1].ajustes.pregunta).toMatch(/^¿Pregunta corregida/);
    expect(c.resultado!.doc.secciones[4].editadoPorHumano).toEqual(["bloques[0].ajustes.pregunta"]);
  });

  it("sin infracciones la tarea queda omitida", async () => {
    const c = await correr(["gemini"], manejadorBase());
    expect(c.eventos).toContainEqual(expect.objectContaining({ tarea: "corregir-lista-negra", estado: "omitida" }));
    expect(c.eventos).toContainEqual(expect.objectContaining({ tarea: "humanizar", estado: "omitida" }));
  });

  it("si una corrección sigue con infracciones o el lote falla, solo hay avisos", async () => {
    const mala = await correr(["gemini"], manejadorBase({
      landing: () => conInfracciones(),
      "corregir-lista-negra": ({ usuario }) => ({
        correcciones: (JSON.parse(usuario.slice(usuario.indexOf("["))) as { ruta: string }[]).map((i) => ({ ruta: i.ruta, texto: "Sigue siendo increíble" })),
      }),
    }));
    expect(mala.error).toBeUndefined();
    expect(mala.resultado!.avisos.some((a) => a.includes("sigue con infracciones"))).toBe(true);
    expect(mala.resultado!.salud.find((s) => s.id === "lista-negra")!.estado).toBe("rojo");

    const cae = await correr(["gemini"], manejadorBase({
      landing: () => conInfracciones(),
      "corregir-lista-negra": () => {
        throw new ErrorIA("red", "sin red");
      },
    }));
    expect(cae.resultado).toBeDefined();
    expect(cae.resultado!.avisos.some((a) => a.includes("lista negra"))).toBe(true);
  });

  const textoLargo = Array.from({ length: 50 }, (_, i) => `palabra${i}`).join(" ") + ".";

  it("humaniza los textos de más de 40 palabras por sección y respeta editadoPorHumano", async () => {
    const doc = docBase();
    doc.secciones[1].ajustes.historia = textoLargo;
    doc.secciones[3].ajustes.descripcion = textoLargo;
    doc.secciones[3].editadoPorHumano = ["descripcion"];
    const c = await correr(["gemini", "cerebras"], manejadorBase({
      landing: () => doc,
      humanizar: ({ usuario }) => ({
        textos: (JSON.parse(usuario.slice(usuario.indexOf("["))) as { ruta: string }[]).map((t) => ({ ruta: t.ruta, texto: "Texto con voz humana." })),
      }),
    }));
    const llamadas = c.llamadas.filter((l) => l.tarea === "humanizar");
    expect(llamadas).toHaveLength(1); // la sección 3 está protegida
    expect(c.resultado!.doc.secciones[1].ajustes.historia).toBe("Texto con voz humana.");
    expect(c.resultado!.doc.secciones[3].ajustes.descripcion).toBe(textoLargo);
  });

  it("ignora rutas que la IA inventa al humanizar", async () => {
    const doc = docBase();
    doc.secciones[1].ajustes.historia = textoLargo;
    const c = await correr(["gemini"], manejadorBase({
      landing: () => doc,
      humanizar: () => ({ textos: [{ ruta: "secciones[0].ajustes.titular", texto: "Titular robado" }, { ruta: "secciones[1].ajustes.historia", texto: "Historia nueva." }] }),
    }));
    expect(titular(c.resultado!.doc)).toBe("¿Terminas el día con la espalda cargada?");
    expect(c.resultado!.doc.secciones[1].ajustes.historia).toBe("Historia nueva.");
  });
});

describe("modo simultáneo", () => {
  // Tabla fija del test (no depende de los valores por defecto ni de qué claves haya en .env.local): el enrutador solo reparte según ella.
  const tabla = { ...TABLA_TAREAS_POR_DEFECTO, landing: "gemini", "prompts-grok": "groq", "corregir-lista-negra": "groq", humanizar: "cerebras", critico: "groq" } as typeof TABLA_TAREAS_POR_DEFECTO;

  it("landing y prompts-grok se solapan en el tiempo, cada una en su proveedor preferido", async () => {
    const c = await correr(["gemini", "groq"], manejadorBase(), { retardoMs: 60, enrutador: { tablaTareas: tabla } });
    const landing = c.llamadas.find((l) => l.tarea === "landing")!;
    const grok = c.llamadas.find((l) => l.tarea === "prompts-grok")!;
    expect(landing.proveedor).toBe("gemini");
    expect(grok.proveedor).toBe("groq");
    expect(landing.inicio).toBeLessThan(grok.fin);
    expect(grok.inicio).toBeLessThan(landing.fin);
    // en paralelo, el conjunto tarda menos que ambas en serie
    expect(Math.max(landing.fin, grok.fin) - Math.min(landing.inicio, grok.inicio)).toBeLessThan(landing.fin - landing.inicio + (grok.fin - grok.inicio));
  });

  it("las tareas del pipeline usan la tabla tarea → proveedor", async () => {
    const doc = docBase();
    doc.secciones[0].ajustes.subtitular = "Algo increíble";
    doc.secciones[1].ajustes.historia = Array.from({ length: 50 }, (_, i) => `p${i}`).join(" ");
    const c = await correr(["gemini", "cerebras", "groq"], manejadorBase({
      landing: () => doc,
      "corregir-lista-negra": ({ usuario }) => ({ correcciones: (JSON.parse(usuario.slice(usuario.indexOf("["))) as { ruta: string }[]).map((i) => ({ ruta: i.ruta, texto: "Algo concreto" })) }),
      humanizar: ({ usuario }) => ({ textos: (JSON.parse(usuario.slice(usuario.indexOf("["))) as { ruta: string }[]).map((t) => ({ ruta: t.ruta, texto: "Historia humana." })) }),
    }), { enrutador: { tablaTareas: tabla } });
    const proveedor = (t: string) => c.llamadas.find((l) => l.tarea === t)!.proveedor;
    expect(proveedor("landing")).toBe("gemini");
    expect(proveedor("prompts-grok")).toBe("groq");
    expect(proveedor("corregir-lista-negra")).toBe("groq");
    expect(proveedor("humanizar")).toBe("cerebras");
    expect(proveedor("critico")).toBe("groq");
    expect(c.resultado!.proveedores).toMatchObject({ landing: "gemini", humanizar: "cerebras", critico: "groq" });
  });

  it("el crítico usa un proveedor distinto al creador aunque la tabla los ponga iguales", async () => {
    const c = await correr(["gemini", "groq"], manejadorBase(), { enrutador: { tablaTareas: { ...tabla, critico: "gemini" } } });
    expect(c.llamadas.find((l) => l.tarea === "landing")!.proveedor).toBe("gemini");
    expect(c.llamadas.find((l) => l.tarea === "critico")!.proveedor).toBe("groq");
    expect(c.resultado!.proveedores.critico).not.toBe(c.resultado!.proveedores.landing);
  });

  it("si solo hay un proveedor, el crítico lo usa como último recurso", async () => {
    const c = await correr(["gemini"], manejadorBase(), { enrutador: { tablaTareas: { ...tabla, critico: "gemini" } } });
    expect(c.resultado!.proveedores).toMatchObject({ landing: "gemini", critico: "gemini" });
  });

  it("en cascada ignora la tabla y respeta el orden de siempre", async () => {
    const c = await correr(["gemini", "groq"], manejadorBase(), { enrutador: { modo: "cascada", tablaTareas: tabla } });
    expect(c.llamadas.find((l) => l.tarea === "prompts-grok")!.proveedor).toBe("gemini");
    expect(c.llamadas.find((l) => l.tarea === "critico")!.proveedor).toBe("groq"); // se evita al creador
  });
});
