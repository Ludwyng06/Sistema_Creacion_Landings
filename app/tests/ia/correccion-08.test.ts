import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { LandingDoc } from "@/lib/contratos";
import { acortarCatalogos, compactarEntrada, esquemaCompacto, quitarEjemplos, quitarTiposDeSeccion } from "@/lib/ia/compactar";
import { ejecutar } from "@/lib/ia/enrutador";
import { crearGemini, type ClienteGemini } from "@/lib/ia/gemini";
import { crearProveedorCompatible } from "@/lib/ia/openai-compat";
import { infoProveedor, proveedoresDisponibles } from "@/lib/ia/registro";
import { resumirParaCritico } from "@/lib/ia/resumen-critico";
import { ErrorCascadaAgotada, ErrorIA, type ProveedorIA } from "@/lib/ia/tipos";
import { combinar } from "@/lib/tecnicas/combinador";
import { tirarSemilla } from "@/lib/tecnicas/semillas";
import { landingEjemplo } from "../fixtures/landing-ejemplo";
import { briefCorrector } from "../tecnicas/briefs";
import { correr, crearProveedores, manejadorBase } from "../construccion/ayudas";
import groq429 from "./fixtures/groq-429-tpm.json";

// Corrección 08-A: entrada compacta para Groq, crítico rápido con tope, backoff entre modelos y Cerebras listo.

const esquema = z.object({ titulo: z.string() });
const respuesta = (status: number, cuerpo: unknown) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { "Content-Type": "application/json" } });
const buenaRespuesta = () =>
  respuesta(200, { choices: [{ message: { content: '{"titulo":"Hola"}' } }], usage: { prompt_tokens: 5, completion_tokens: 3 } });
const ok = async () => {};

describe("entrada compacta de la tarea landing", () => {
  const prompt = combinar(briefCorrector, ["ambicioso", "semilla", "sustractivo", "negativas", "humana", "critico"], tirarSemilla(42, 3).semilla);
  const sistema = `${prompt.rol}\n\n${prompt.formato}`;
  const usuario = `${prompt.tarea}\n\n${prompt.contexto}`;

  it("es más corta y conserva vocabulario reservado, ajustes por tipo y catálogo de nivel 3", () => {
    const c = compactarEntrada({ sistema, usuario });
    expect(c.sistema.length + c.usuario.length).toBeLessThan((sistema.length + usuario.length) * 0.95);
    expect(c.usuario).toContain("Vocabulario reservado");
    expect(c.usuario).toContain("revolucionario");
    expect(c.usuario).toContain("Ajustes y bloques válidos por tipo de sección");
    expect(c.usuario).toContain("`heroe`: ajustes { titular");
    expect(c.usuario).toContain("`video-scroll` · nivel 3 · heroe");
    expect(c.usuario).not.toContain("Ejemplos few-shot");
    expect(c.usuario).not.toContain("Tipos de sección disponibles");
    expect(c.usuario).not.toMatch(/`revelar-suave` · nivel 1 · heroe/);
    expect(c.usuario).toContain("- `producto-monumental`\n");
  });

  it("las piezas quitan solo lo que dicen", () => {
    expect(quitarEjemplos("a\nEjemplos few-shot:\nEjemplo A · x\nEjemplo B · y\nb")).toBe("a\nb");
    expect(quitarTiposDeSeccion("Tipos de sección disponibles:\n- `heroe`: primera\n- `faq`: preguntas\n\nsigue")).toBe("sigue");
    expect(acortarCatalogos("- `grano` · nivel 1 · global\n- `shader-ondas` · nivel 3 · galeria, heroe")).toBe(
      "- `grano` · nivel 1\n- `shader-ondas` · nivel 3 · galeria, heroe",
    );
  });

  it("el esquema compacto quita patrones y límites que Zod valida igual, pero conserva los campos obligatorios", () => {
    const S = LandingDoc.omit({ critica: true });
    const completo = JSON.stringify(z.toJSONSchema(S));
    const compacto = JSON.stringify(esquemaCompacto(S));
    expect(compacto.length).toBeLessThan(completo.length * 0.85);
    expect(compacto).not.toContain("additionalProperties");
    expect(compacto).not.toContain("pattern");
    expect(compacto).toContain('"required"');
  });
});

describe("enrutador: compacta, plazo y modo rápido", () => {
  const peticion = { tarea: "landing" as const, sistema: "SISTEMA-LARGO", usuario: "USUARIO-LARGO", esquema };
  type Visto = { sistema: string; usuario: string; maxTokens?: number; rapido?: boolean; timeoutMs?: number };
  const proveedor = (id: "gemini" | "groq", limite?: number) => {
    const vistos: Visto[] = [];
    const p = {
      id,
      disponible: () => true,
      limiteTokensMinuto: limite,
      async generarJSON(a: Visto) {
        vistos.push(a);
        return { datos: { titulo: "ok" }, proveedor: id, modelo: "m", ms: 1 };
      },
    };
    return { p: p as unknown as ProveedorIA, vistos };
  };
  const deps = (proveedores: ProveedorIA[]) => ({ proveedores, registrarUso: ok, modo: "cascada" as const });

  it("solo el proveedor con cupo por minuto recibe la entrada compacta y su tope de tokens", async () => {
    const groq = proveedor("groq", 8000);
    const gemini = proveedor("gemini");
    const compacta = { sistema: "S", usuario: "U", maxTokens: 3300 };
    await ejecutar({ ...peticion, compacta, forzar: "groq" }, deps([groq.p, gemini.p]));
    await ejecutar({ ...peticion, compacta, forzar: "gemini" }, deps([groq.p, gemini.p]));
    expect(groq.vistos[0]).toMatchObject({ sistema: "S", usuario: "U", maxTokens: 3300 });
    expect(gemini.vistos[0]).toMatchObject({ sistema: "SISTEMA-LARGO", usuario: "USUARIO-LARGO" });
  });

  it("la corrección por esquema conserva la parte añadida al usuario compacto", async () => {
    const llamadas: string[] = [];
    const groq = {
      id: "groq",
      disponible: () => true,
      limiteTokensMinuto: 8000,
      async generarJSON(a: { usuario: string }) {
        llamadas.push(a.usuario);
        if (llamadas.length === 1) throw new ErrorIA("json", "falta titulo");
        return { datos: { titulo: "ok" }, proveedor: "groq", modelo: "m", ms: 1 };
      },
    } as unknown as ProveedorIA;
    await ejecutar({ ...peticion, compacta: { sistema: "S", usuario: "U" } }, deps([groq]));
    expect(llamadas[0]).toBe("U");
    expect(llamadas[1]).toContain("U\n\nTu respuesta anterior no cumplió el esquema");
    expect(llamadas[1]).toContain("falta titulo");
  });

  it("plazoMs: pasa el tiempo restante al proveedor y no sigue con el siguiente cuando se agotó", async () => {
    let tiempoDado = 0;
    const lento = {
      id: "groq",
      disponible: () => true,
      async generarJSON(a: { timeoutMs?: number }) {
        tiempoDado = a.timeoutMs ?? 0;
        await new Promise((r) => setTimeout(r, 50));
        throw new ErrorIA("timeout", "groq: se agotó el tiempo de espera.");
      },
    } as unknown as ProveedorIA;
    const gemini = proveedor("gemini");
    const err = await ejecutar({ ...peticion, plazoMs: 30 }, deps([lento, gemini.p])).catch((e) => e);
    expect(tiempoDado).toBeGreaterThan(0);
    expect(tiempoDado).toBeLessThanOrEqual(30);
    expect(err).toBeInstanceOf(ErrorCascadaAgotada);
    expect((err as ErrorCascadaAgotada).intentos.map((i) => i.mensaje).join(" ")).toContain("se agotó el plazo");
    expect(gemini.vistos).toHaveLength(0);
  });

  it("rapido llega al proveedor", async () => {
    const g = proveedor("gemini");
    await ejecutar({ ...peticion, rapido: true }, deps([g.p]));
    expect(g.vistos[0].rapido).toBe(true);
  });
});

describe("Gemini rápido", () => {
  it("con rapido empieza por el modelo ligero", async () => {
    const modelos: string[] = [];
    const cliente: ClienteGemini = {
      models: {
        async generateContent(p) {
          modelos.push(p.model);
          return { text: '{"titulo":"x"}' };
        },
      },
    };
    const g = crearGemini({ GEMINI_API_KEY: "k", GEMINI_MODEL: "principal", GEMINI_MODEL_RESPALDO: "ligero" }, cliente);
    await g.generarJSON({ sistema: "s", usuario: "u", esquema, rapido: true });
    await g.generarJSON({ sistema: "s", usuario: "u", esquema });
    expect(modelos).toEqual(["ligero", "principal"]);
  });
});

describe("OpenRouter y Groq: backoff y respaldo", () => {
  const base = { baseUrl: "https://x.test/v1", clave: "clave-secreta-123456", modelo: "principal" };

  it("si el principal da 429 espera y prueba el modelo de respaldo antes de rendirse", async () => {
    const modelos: string[] = [];
    const fetchFn = vi.fn(async (_u: unknown, init: RequestInit) => {
      const m = JSON.parse(init.body as string).model as string;
      modelos.push(m);
      return m === "principal" ? respuesta(429, { error: { message: "Provider returned error" } }) : buenaRespuesta();
    });
    const t0 = performance.now();
    const p = crearProveedorCompatible({
      ...base,
      id: "openrouter",
      modelosRespaldo: ["respaldo"],
      esperaEntreModelosMs: 60,
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    const r = await p.generarJSON({ sistema: "s", usuario: "u", esquema });
    expect(modelos).toEqual(["principal", "respaldo"]);
    expect(r.modelo).toBe("respaldo");
    expect(performance.now() - t0).toBeGreaterThanOrEqual(55);
  });

  it("con cupo por minuto usa el esquema compacto", async () => {
    let cuerpo = "";
    const fetchFn = vi.fn(async (_u: unknown, init: RequestInit) => {
      cuerpo = init.body as string;
      return buenaRespuesta();
    });
    const p = crearProveedorCompatible({ ...base, id: "groq", limiteTokensMinuto: 8000, fetchFn: fetchFn as unknown as typeof fetch });
    await p.generarJSON({
      sistema: "s",
      usuario: "u".repeat(500),
      esquema: z.object({ titulo: z.string().min(1).regex(/^[a-zA-Z]+$/) }),
      maxTokens: 3300,
    });
    expect(cuerpo).not.toContain("pattern");
    expect(cuerpo).toContain("required");
  });

  it("el 429 de Groq de la grabación se lee como límite", async () => {
    const fetchFn = vi.fn(async () => respuesta(429, groq429));
    const p = crearProveedorCompatible({ ...base, id: "groq", fetchFn: fetchFn as unknown as typeof fetch });
    const e = (await p.generarJSON({ sistema: "s", usuario: "u", esquema }).catch((x) => x)) as ErrorIA;
    expect(e.tipo).toBe("limite");
  });
});

describe("Cerebras listo con solo poner la clave", () => {
  const chat = { choices: [{ message: { content: '{"titulo":"desde cerebras"}' } }], usage: { prompt_tokens: 9, completion_tokens: 4 } };

  it("sin clave no entra a la cascada; con clave entra con la URL y el modelo por defecto", () => {
    expect(proveedoresDisponibles({ IA_CASCADA: "cerebras" }).map((p) => p.id)).toEqual([]);
    const con = proveedoresDisponibles({ CEREBRAS_API_KEY: "csk-clave-de-prueba-123", IA_CASCADA: "cerebras" });
    expect(con.map((p) => p.id)).toEqual(["cerebras"]);
    expect(infoProveedor("cerebras", { CEREBRAS_API_KEY: "x" })).toMatchObject({ modelo: "gpt-oss-120b", tieneClave: true });
  });

  it("responde con el formato de OpenAI, manda reasoning_effort (gpt-oss) y no filtra la clave en los errores", async () => {
    const clave = "csk-clave-de-prueba-123";
    const cuerpos: Record<string, unknown>[] = [];
    const fetchFn = vi.fn(async (url: unknown, init: RequestInit) => {
      expect(String(url)).toBe("https://api.cerebras.ai/v1/chat/completions");
      cuerpos.push(JSON.parse(init.body as string));
      return cuerpos.length === 1 ? respuesta(200, chat) : respuesta(401, { error: { message: `Incorrect API key ${clave}` } });
    });
    const p = crearProveedorCompatible({
      id: "cerebras",
      baseUrl: "https://api.cerebras.ai/v1",
      clave,
      modelo: "gpt-oss-120b",
      cuerpoExtra: { reasoning_effort: "low" },
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    const r = await p.generarJSON({ sistema: "s", usuario: "u", esquema });
    expect(r).toMatchObject({ proveedor: "cerebras", datos: { titulo: "desde cerebras" }, tokens: { entrada: 9, salida: 4 } });
    expect(cuerpos[0].reasoning_effort).toBe("low");
    const e = (await p.generarJSON({ sistema: "s", usuario: "u", esquema }).catch((x) => x)) as ErrorIA;
    expect(e.tipo).toBe("auth");
    expect(e.message).not.toContain(clave);
  });
});

describe("resumen del documento para el crítico", () => {
  it("quita tokens y prompts de imagen, conserva textos y estructura, y es mucho más corto", () => {
    const resumen = JSON.stringify(resumirParaCritico(landingEjemplo));
    expect(resumen).not.toContain("promptGrok");
    expect(resumen).not.toContain("acentoTexto");
    expect(resumen).toContain(String(landingEjemplo.secciones[0].ajustes.titular));
    expect(resumen).toContain('"tipo":"heroe"');
    expect(resumen.length).toBeLessThan(JSON.stringify(landingEjemplo, null, 2).length * 0.6);
  });
});

describe("construir: crítico con tope", () => {
  it("el crítico va con plazo de 25 s, salida corta, modo rápido y el resumen del documento", async () => {
    let visto: { usuario: string; maxTokens?: number; rapido?: boolean; timeoutMs?: number } | null = null;
    const { proveedores } = crearProveedores(["gemini"], manejadorBase());
    const envoltura = {
      id: "gemini",
      disponible: () => true,
      async generarJSON(a: { sistema: string; usuario: string; esquema: z.ZodType; maxTokens?: number; rapido?: boolean; timeoutMs?: number }) {
        if (a.sistema.startsWith("Eres auditor senior")) visto = { usuario: a.usuario, maxTokens: a.maxTokens, rapido: a.rapido, timeoutMs: a.timeoutMs };
        return proveedores[0].generarJSON({ sistema: a.sistema, usuario: a.usuario, esquema: a.esquema });
      },
    } as unknown as ProveedorIA;
    const eventos: unknown[] = [];
    const { construir } = await import("@/lib/ia/construir");
    await construir({ brief: briefCorrector, tecnicas: [], numeroSemilla: 42 }, (e) => eventos.push(e), {
      enrutador: { proveedores: [envoltura], registrarUso: ok, modo: "cascada", espera: ok },
    });
    expect(visto).not.toBeNull();
    const v = visto!;
    expect(v.maxTokens).toBe(2000);
    expect(v.rapido).toBe(true);
    expect(v.timeoutMs).toBeLessThanOrEqual(25_000);
    expect(v.usuario).toContain("resumen: textos, estructura y recursos");
    expect(v.usuario).not.toContain("promptGrok");
  });

  it("un crítico que omite `correcciones` (Groq) se acepta con lista vacía y la landing lleva su puntaje", async () => {
    const { construir } = await import("@/lib/ia/construir");
    const { proveedores } = crearProveedores(
      ["gemini"],
      manejadorBase({ critico: () => ({ puntaje: 8.4, porCriterio: [{ criterio: "Claridad", puntaje: 8.4, evidencia: "secciones[0]" }], problemas: [] }) }),
    );
    const eventos: { tipo: string }[] = [];
    await construir({ brief: briefCorrector, tecnicas: [], numeroSemilla: 42 }, (e) => eventos.push(e), {
      enrutador: { proveedores, registrarUso: ok, modo: "cascada", espera: ok },
    });
    const r = eventos.find((e) => e.tipo === "resultado") as unknown as { doc: { critica?: { puntaje: number; correcciones: string[] } } };
    expect(r.doc.critica).toMatchObject({ puntaje: 8.4, correcciones: [] });
  });

  it("si el crítico se pasa del tope, la landing se entrega con el aviso «Crítico pendiente»", async () => {
    const c = await correr(
      ["gemini"],
      manejadorBase({
        critico: () => {
          throw new ErrorIA("timeout", "gemini: se agotó el tiempo de espera.");
        },
      }),
    );
    expect(c.resultado).toBeDefined();
    expect(c.resultado!.doc.critica).toBeUndefined();
    expect(c.resultado!.avisos.some((a) => a.startsWith("Crítico pendiente"))).toBe(true);
  });

  it("pasados 60 s en total el crítico hace como máximo 1 vuelta", async () => {
    const ahora = performance.now.bind(performance);
    let saltado = false;
    const espia = vi.spyOn(performance, "now").mockImplementation(() => ahora() + (saltado ? 61_000 : 0));
    try {
      const c = await correr(
        ["gemini"],
        manejadorBase({
          critico: () => {
            saltado = true;
            return { puntaje: 5, porCriterio: [], problemas: ["p"], correcciones: ["c"] };
          },
        }),
      );
      expect(c.resultado!.vueltasCritico).toBe(1);
    } finally {
      espia.mockRestore();
    }
  });
});

describe("cupo por minuto de Groq y mensajes de fallo", () => {
  const peticion = { tarea: "landing" as const, sistema: "S", usuario: "U", esquema };

  it("si Groq responde 429 por tokens por minuto espera lo sugerido (hasta 60 s) y reintenta, también tras corregir el JSON", async () => {
    const esperas: number[] = [];
    const cuota = new ErrorIA("limite", "groq: límite o saturación (429): Rate limit reached ... on tokens per minute (TPM): Limit 8000. Please try again in 19.11s.");
    let n = 0;
    const groq = {
      id: "groq",
      disponible: () => true,
      async generarJSON() {
        n++;
        if (n === 1) throw new ErrorIA("json", "falta el titulo");
        if (n === 2) throw cuota; // la corrección choca con el cupo que gastó el primer intento
        return { datos: { titulo: "ok" }, proveedor: "groq", modelo: "m", ms: 1 };
      },
    } as unknown as ProveedorIA;
    const r = await ejecutar(peticion, { proveedores: [groq], registrarUso: ok, modo: "cascada", espera: async (ms) => void esperas.push(ms) });
    expect(r.datos.titulo).toBe("ok");
    expect(esperas).toEqual([19_110]);
    expect(n).toBe(3);
  });

  it("una espera de más de 8 s que no es de cupo por minuto no se espera", async () => {
    const esperas: number[] = [];
    const g = {
      id: "gemini",
      disponible: () => true,
      async generarJSON() {
        throw new ErrorIA("limite", "gemini: límite o saturación (503): retry in 30s");
      },
    } as unknown as ProveedorIA;
    await ejecutar(peticion, { proveedores: [g], registrarUso: ok, modo: "cascada", espera: async (ms) => void esperas.push(ms) }).catch(() => {});
    expect(esperas).toEqual([]);
  });

  it("cuando la cascada falla, el mensaje dice el motivo de cada proveedor en una línea", async () => {
    const falla = (id: string, e: ErrorIA) =>
      ({ id, disponible: () => true, async generarJSON() { throw e; } }) as unknown as ProveedorIA;
    const err = (await ejecutar(peticion, {
      proveedores: [
        falla("groq", new ErrorIA("limite", "groq: límite o saturación (429): Rate limit reached")),
        falla("gemini", new ErrorIA("json", "gemini: el JSON no cumple el esquema: falta icono")),
        falla("openrouter", new ErrorIA("timeout", "openrouter: se agotó el tiempo de espera.")),
      ],
      registrarUso: ok,
      modo: "cascada",
      espera: ok,
    }).catch((e) => e)) as ErrorCascadaAgotada;
    expect(err.message).not.toContain("\n");
    expect(err.message).toMatch(/groq: cuota o saturación — /);
    expect(err.message).toMatch(/gemini: respuesta fuera del esquema — /);
    expect(err.message).toMatch(/openrouter: tiempo agotado — /);
    expect(err.message).not.toMatch(/\(\d+ intentos\)/);
  });

  it("paso 4 de /crear: con Groq forzado y sin cupo, la tarea Landing muestra el motivo, no solo «Todos los proveedores fallaron»", async () => {
    const cuota = new ErrorIA("limite", "groq: la petición (~9000 tokens con la respuesta) supera el límite de 8000 por minuto del plan gratuito.");
    const groq = { id: "groq", disponible: () => true, limiteTokensMinuto: 8000, async generarJSON() { throw cuota; } } as unknown as ProveedorIA;
    const eventos: { tipo: string; tarea?: string; estado?: string; mensaje?: string }[] = [];
    const { construir } = await import("@/lib/ia/construir");
    await construir({ brief: briefCorrector, tecnicas: [], numeroSemilla: 42 }, (e) => eventos.push(e as never), {
      forzarLanding: "groq",
      enrutador: { proveedores: [groq], registrarUso: ok, modo: "cascada", espera: ok },
    });
    const fila = eventos.find((e) => e.tipo === "tarea" && e.tarea === "landing" && e.estado === "error");
    expect(fila?.mensaje).toContain("groq: cuota o saturación — ");
    expect(fila?.mensaje).toContain("supera el límite de 8000 por minuto");
  });
});

describe("Groq construye: nadie más le quita el cupo", () => {
  it("con la landing en Groq, los prompts de Grok y el crítico van a otro proveedor", async () => {
    const vistos: Record<string, string[]> = { groq: [], gemini: [] };
    const { proveedores } = crearProveedores(["gemini", "groq"], manejadorBase());
    const registrando = proveedores.map(
      (p) =>
        ({
          id: p.id,
          disponible: () => true,
          async generarJSON(a: { sistema: string; usuario: string; esquema: z.ZodType }) {
            vistos[p.id].push(a.sistema.slice(0, 22));
            return p.generarJSON(a);
          },
        }) as unknown as ProveedorIA,
    );
    const { construir } = await import("@/lib/ia/construir");
    await construir({ brief: briefCorrector, tecnicas: [], numeroSemilla: 42 }, () => {}, {
      forzarLanding: "groq",
      enrutador: { proveedores: registrando, registrarUso: ok, modo: "cascada", espera: ok },
    });
    const soloGroq = vistos.groq.filter((s) => !s.startsWith("Eres estratega"));
    expect(vistos.groq.length).toBeGreaterThan(0);
    expect(vistos.groq.some((s) => s.startsWith("Eres auditor"))).toBe(false);
    expect(vistos.gemini.some((s) => s.startsWith("Eres auditor"))).toBe(true);
    expect(soloGroq.length).toBe(0);
  });
});

describe("iconos faltantes", () => {
  it("completa beneficio.icono con el valor por defecto y no toca textos ni otros campos", async () => {
    const { completarIconosFaltantes } = await import("@/lib/tecnicas/guia-secciones");
    const doc = structuredClone(landingEjemplo);
    const s = doc.secciones.find((x) => x.tipo === "beneficios")!;
    delete s.bloques[0].ajustes.icono;
    const titulo = s.bloques[0].ajustes.titulo;
    const arreglado = completarIconosFaltantes(doc);
    const b = arreglado.secciones.find((x) => x.tipo === "beneficios")!.bloques[0].ajustes;
    expect(b.icono).toBe("check");
    expect(b.titulo).toBe(titulo);
    expect(doc.secciones.find((x) => x.tipo === "beneficios")!.bloques[0].ajustes.icono).toBeUndefined(); // no muta
  });
});

describe("espera sugerida", () => {
  it("lee segundos, milisegundos y minutos con segundos", async () => {
    const { esperaSugeridaMs } = await import("@/lib/ia/errores-http");
    expect(esperaSugeridaMs("Please try again in 32.4s. Need more tokens?")).toBe(32_400);
    expect(esperaSugeridaMs("Please try again in 1m2.5s.")).toBe(62_500);
    expect(esperaSugeridaMs("retry in 500ms")).toBe(500);
    expect(esperaSugeridaMs("sin pista")).toBe(2_000);
  });
});

describe("Groq: los 5 ejemplos caben en 8.000 tokens por minuto", () => {
  it("sin tokens visuales y con el esquema compacto, la entrada deja al menos 2.400 tokens de salida", async () => {
    const { EJEMPLOS } = await import("@/datos/ejemplos");
    const { PERFIL_ESENCIAL } = await import("@/lib/tecnicas/combinador");
    const { instruccionEsquemaCompacta } = await import("@/lib/ia/compactar");
    const { LandingDelModeloEstricta: S } = await import("@/lib/ia/construir");
    const esquemaChars = instruccionEsquemaCompacta(S).length;
    for (const e of EJEMPLOS) {
      for (const tecnicas of [e.tecnicas, PERFIL_ESENCIAL]) {
        const p = combinar(e.brief, [...tecnicas], tirarSemilla(e.numeroSemilla ?? 42, e.brief.intensidad).semilla);
        const c = compactarEntrada({ sistema: `${p.rol}\n\n${p.formato}`, usuario: `${p.tarea}\n\n${p.contexto}` });
        expect(c.usuario).not.toContain("Tokens de la semilla");
        const entrada = Math.ceil((c.sistema.length + c.usuario.length + esquemaChars) / 3.6);
        expect(8000 - entrada - 150, `${e.id} (${tecnicas.length} técnicas): entrada ~${entrada}`).toBeGreaterThanOrEqual(2400);
      }
    }
  });
});
