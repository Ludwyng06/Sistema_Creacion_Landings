import "../ayudas-db";
import { existsSync, mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { LandingDoc, type Asset, type MedioBanco } from "@/lib/contratos";
import { resolverConCompetencia, puntajeCandidata, type DepsCompetencia, type SlotImagen } from "@/lib/generar/imagenes-competencia";
import { repararImagenes } from "@/lib/generar/reparar-imagenes";
import { almacenCheckpointMemoria } from "@/lib/generar/checkpoint";
import { generarImagenOpenAI } from "@/lib/imagenes/openai";
import { crearContadorGasto } from "@/lib/ia/gasto";
import { ErrorFuente } from "@/lib/fuentes/tipos";
import { PromptsImagen } from "@/lib/ia/prompts/imagen";
import { promptsDeterministas, consultasDeBanco, palabrasClave } from "@/lib/vitrina/imagenes-sin-ia";
import { crearLanding, obtenerLanding } from "@/lib/landings";
import { EJEMPLO_POR_TIPO } from "@/secciones/ejemplos-por-tipo";
import type { EleccionImagen } from "@/lib/ia/prompts/elegir-imagen";
import * as fixture from "../fixtures/landing-ejemplo";

// 24-A · las fuentes de imagen compiten por slot; el crítico elige; sin cupo siempre hay imagen; la reparación llena los marcadores.

const medio = (id: string, titulo: string, extra: Partial<MedioBanco> = {}): MedioBanco => ({
  id,
  bancoId: "web",
  tipo: "imagen",
  fuente: "openverse",
  idFuente: id,
  ruta: `/media/bancos/web/${id}.webp`,
  ancho: 1600,
  alto: 900,
  orientacion: "horizontal",
  coloresDominantes: [],
  titulo,
  descripcion: "",
  etiquetas: [],
  credito: "Autor · CC BY",
  licencia: "cc-by",
  usoComercial: true,
  ...extra,
});

const slot = (nombre: string, rol: SlotImagen["rol"] = "galeria", extra: Partial<SlotImagen> = {}): SlotImagen => ({
  slot: nombre,
  rol,
  origen: "banco",
  relacion: rol === "heroe" ? "16:9" : "1:1",
  seccion: rol,
  esProducto: false,
  que: `imagen para ${nombre}`,
  esperado: `algo de ${nombre}`,
  ...extra,
});

const entrada = (claves: string[], tematica = "producto") => ({ numero: 0, slug: "x", tematica, brief: { nombre: "Lámpara de luna", problema: "Una lámpara con la forma de la Luna", beneficios: [], publico: "x", categoria: "otro", precio: { valor: 0, moneda: "COP" }, objeciones: [], nivelConciencia: "problema", intensidad: 3 }, tecnicas: [], numeroSemilla: 0, bancos: [], claves, fuentes: [], consultas: {}, ficha: [], textoCta: "" }) as unknown as DepsCompetencia["entrada"];

function base(extra: Partial<DepsCompetencia> = {}): DepsCompetencia & { llamadasOA: string[]; llamadasFlux: string[]; llamadasElegir: number } {
  const estado = { llamadasOA: [] as string[], llamadasFlux: [] as string[], llamadasElegir: 0 };
  let n = 0;
  const d: DepsCompetencia = {
    dirMedia: tmpdir(),
    candidatos: [],
    entrada: entrada(["luna", "lampara"]),
    espacial: false,
    contexto: { nombre: "Lámpara de luna", descripcion: "lámpara con forma de Luna" },
    briefTxt: "brief",
    fichaTxt: "ficha",
    acento: "#D9381E",
    miniatura: async () => "QUJD",
    generarOpenAI: async (prompt) => {
      estado.llamadasOA.push(prompt);
      return { ruta: `/media/bancos/generadas/oa-${++n}.webp`, modelo: "gpt-image-2" };
    },
    generarFlux: async (prompt) => {
      estado.llamadasFlux.push(prompt);
      return { ruta: `/media/bancos/generadas/fx-${++n}.webp` };
    },
    ...extra,
  };
  Object.defineProperty(d, "llamadasOA", { get: () => estado.llamadasOA });
  Object.defineProperty(d, "llamadasFlux", { get: () => estado.llamadasFlux });
  Object.defineProperty(d, "llamadasElegir", { get: () => estado.llamadasElegir });
  return d as never;
}

const nota = (indice: number, v: number, aptitud = 9) => ({ indice, relevancia: v, calidad: v, paleta: v, aptitud, motivo: `nota ${v}` });
const eleccion = (notas: [number, number, number?][], elegida: number): EleccionImagen => ({ candidatas: notas.map(([i, v, a]) => nota(i, v, a ?? 9)), elegida, motivo: "porque sí" });

describe("24-A · competencia de fuentes por slot", () => {
  it("el crítico elige la candidata con mejor nota y las demás quedan como alternativas con su nota", async () => {
    const llamadas: number[] = [];
    const d = base({
      candidatos: [medio("a", "lampara luna"), medio("b", "luna llena"), medio("c", "otra luna")],
      elegir: async ({ miniaturas }) => {
        llamadas.push(miniaturas.length);
        // candidatas: 0..2 de banco y 3 la generada; gana la 1
        return eleccion([[0, 5], [1, 9], [2, 6], [3, 7]], 1);
      },
    });
    const r = await resolverConCompetencia([slot("galeria-1")], d);
    expect(llamadas).toEqual([4]); // UNA llamada con las 4 miniaturas (3 de banco + 1 generada)
    const a = r.assets[0];
    expect(a.ruta).toMatch(/\/web\//);
    expect(a.fuente).toBe("openverse");
    expect(r.notas["galeria-1"]).toMatchObject({ criterio: "vision", nota: 9 });
    const alts = r.alternativas["galeria-1"];
    expect(alts).toHaveLength(3);
    expect(alts.some((x) => x.fuente === "ia-openai" && x.nota === 7.7)).toBe(true);
    expect(alts.every((x) => x.ruta !== a.ruta)).toBe(true);
  });

  it("fuera de espacio siempre hay una generada compitiendo; si gana, el asset lleva fuente ia-openai, licencia generada y el prompt", async () => {
    const d = base({ candidatos: [medio("a", "luna")], elegir: async () => eleccion([[0, 4], [1, 9]], 1) });
    const r = await resolverConCompetencia([slot("heroe-imagen", "heroe", { esProducto: true })], d);
    expect(r.assets[0]).toMatchObject({ fuente: "ia-openai", licencia: "generada", generada: true });
    expect(r.assets[0].promptGrok).toMatch(/No text/i);
    expect(d.llamadasOA).toHaveLength(1);
  });

  it("una elegida no apta (aptitud < 5) se descarta y se toma la siguiente mejor apta", async () => {
    const d = base({ candidatos: [medio("a", "luna"), medio("b", "luna dos")], elegir: async () => eleccion([[0, 9, 3], [1, 6, 8], [2, 5, 9]], 0) });
    const r = await resolverConCompetencia([slot("galeria-1")], d);
    expect(r.assets[0].ruta).toMatch(/b\.webp$/);
  });

  it("nunca el mismo archivo en dos slots: el segundo toma su siguiente mejor", async () => {
    const d = base({ candidatos: [medio("a", "luna"), medio("b", "luna dos")], generarOpenAI: undefined, elegir: async () => eleccion([[0, 9], [1, 7]], 0) });
    const r = await resolverConCompetencia([slot("galeria-1"), slot("galeria-2")], d);
    const rutas = r.assets.map((a) => a.ruta);
    expect(new Set(rutas).size).toBe(2);
    expect(rutas.every(Boolean)).toBe(true);
  });

  it("sin cupo de visión fuera de espacio gana la generada con OpenAI", async () => {
    const d = base({ candidatos: [medio("a", "luna")], elegir: async () => Promise.reject(new Error("429 sin cupo")) });
    const r = await resolverConCompetencia([slot("galeria-1")], d);
    expect(r.assets[0]).toMatchObject({ fuente: "ia-openai", generada: true });
    expect(r.notas["galeria-1"].criterio).toBe("generada");
    expect(r.avisos.join(" ")).toMatch(/Sin cupo de visión/);
  });

  it("espacio sin cupo de visión: gana la de banco con más coincidencia de palabras clave (validada: false) y no se genera", async () => {
    const d = base({
      espacial: true,
      entrada: entrada(["aurora", "boreal"], "espacio"),
      candidatos: [medio("a", "paisaje de montaña"), medio("b", "aurora boreal sobre el lago", { fuente: "wikimedia" })],
      elegir: async () => Promise.reject(new Error("429")),
    });
    const r = await resolverConCompetencia([slot("galeria-1")], d);
    expect(r.assets[0].ruta).toMatch(/b\.webp$/);
    expect(r.notas["galeria-1"].criterio).toBe("palabras-clave");
    expect(r.avisos.join(" ")).toMatch(/validada: false/);
    expect(d.llamadasOA).toHaveLength(0);
  });

  it("espacio: la generada solo se pide si la mejor de banco saca menos de 7, y el slot del producto siempre se genera", async () => {
    // mejor de banco 8 → no se genera
    const bueno = base({ espacial: true, entrada: entrada(["aurora"], "espacio"), candidatos: [medio("a", "aurora"), medio("b", "aurora dos")], elegir: async () => eleccion([[0, 8], [1, 6]], 0) });
    const r1 = await resolverConCompetencia([slot("galeria-1")], bueno);
    expect(r1.assets[0].fuente).toBe("openverse");
    expect(bueno.llamadasOA).toHaveLength(0);
    // mejor de banco 5 → se genera y gana
    const malo = base({ espacial: true, entrada: entrada(["aurora"], "espacio"), candidatos: [medio("a", "aurora"), medio("b", "aurora dos")], elegir: async () => eleccion([[0, 5], [1, 4]], 0) });
    const r2 = await resolverConCompetencia([slot("galeria-1")], malo);
    expect(r2.assets[0]).toMatchObject({ fuente: "ia-openai", generada: true });
    expect(malo.llamadasOA).toHaveLength(1);
    // slot del producto en espacio: se genera desde el principio y compite
    const prod = base({ espacial: true, candidatos: [medio("a", "luna")], elegir: async () => eleccion([[0, 5], [1, 9]], 1) });
    const r3 = await resolverConCompetencia([slot("heroe-imagen", "heroe", { esProducto: true })], prod);
    expect(r3.assets[0].fuente).toBe("ia-openai");
  });

  it("sin OpenAI (429 en los dos modelos) cae a FLUX; con todo caído queda el marcador solo en ese slot y los demás siguen", async () => {
    const d = base({
      generarOpenAI: async () => Promise.reject(new ErrorFuente("ia-openai", "cupo", "429")),
      candidatos: [medio("a", "luna")],
      elegir: async () => Promise.reject(new Error("sin visión")),
    });
    const r = await resolverConCompetencia([slot("galeria-1"), slot("galeria-2")], d);
    expect(r.assets.map((a) => a.fuente)).toEqual(["openverse", "ia-flux"]); // el segundo no tiene banco libre (el archivo ya se usó) y cae a FLUX
    const sinNada = base({ generarOpenAI: async () => Promise.reject(new ErrorFuente("ia-openai", "cupo", "429")), generarFlux: async (p) => (p.includes("galeria-2") ? Promise.reject(new Error("fallo")) : { ruta: "/media/bancos/generadas/f.webp" }) });
    const r2 = await resolverConCompetencia([slot("galeria-1"), slot("galeria-2")], sinNada);
    expect(r2.assets[0].ruta).toBeTruthy();
    expect(r2.assets.length).toBe(2);
  });

  it("nunca queda un marcador si hay alguna candidata apta (sin visión ni OpenAI y con FLUX caído: la de banco)", async () => {
    const d = base({ generarOpenAI: undefined, generarFlux: async () => Promise.reject(new Error("caído")), candidatos: [medio("a", "luna sola")], elegir: async () => Promise.reject(new Error("sin visión")) });
    const r = await resolverConCompetencia([slot("galeria-1")], d);
    expect(r.assets[0].ruta).toMatch(/a\.webp$/);
  });

  it("el puntaje pesa doble la aptitud y la relevancia", () => {
    expect(puntajeCandidata({ indice: 0, relevancia: 6, calidad: 6, paleta: 6, aptitud: 6, motivo: "x" })).toBe(6);
    expect(puntajeCandidata({ indice: 0, relevancia: 10, calidad: 0, paleta: 0, aptitud: 10, motivo: "x" })).toBeCloseTo(6.67, 1);
  });
});

describe("24-A · prompts y consultas sin IA", () => {
  it("los prompts deterministas cumplen el esquema de la IA y no piden texto, logos ni personas", () => {
    const p = promptsDeterministas([slot("heroe-imagen", "heroe"), slot("galeria-1"), slot("galeria-2"), slot("problema", "problema"), slot("incluye-empaque", "incluye")], { nombre: "Tours de auroras en Islandia", descripcion: "Viaje para ver auroras boreales", tematica: "espacio", colores: { fondo: "#0F2A2B", acento: "#D4A94F" } });
    expect(PromptsImagen.safeParse(p).success, JSON.stringify(PromptsImagen.safeParse(p).error?.issues.slice(0, 2))).toBe(true);
    for (const s of p.slots) {
      expect(s.prompt).toMatch(/No text, no letters, no logos/);
      expect(s.prompt).toContain("aurora borealis");
    }
    expect(new Set(p.slots.map((s) => s.prompt)).size).toBe(p.slots.length); // cada slot, su escena
  });

  it("las consultas salen del brief sin IA, en español e inglés", () => {
    expect(consultasDeBanco("Tours de auroras", ["Viaje para ver auroras boreales"], "espacio")).toContain("aurora borealis");
    expect(palabrasClave(["Tours de auroras"], "espacio")).toEqual(expect.arrayContaining(["auroras", "aurora", "borealis"]));
  });
});

describe("24-A · gpt-image-2 con respaldo y caché", () => {
  const png = async () => (await sharp({ create: { width: 64, height: 64, channels: 3, background: "#224466" } }).webp().toBuffer()).toString("base64");

  it("gpt-image-2 low → webp en disco, caché por prompt y costo al control diario", async () => {
    const dir = mkdtempSync(join(tmpdir(), "oa-"));
    const b64 = await png();
    const cuerpos: Record<string, unknown>[] = [];
    const fetchFn = (async (_u: string, init: RequestInit) => (cuerpos.push(JSON.parse(init.body as string)), new Response(JSON.stringify({ data: [{ b64_json: b64 }] }), { status: 200 }))) as unknown as typeof fetch;
    const gasto = crearContadorGasto({ proveedor: "openai", almacen: { leer: async () => null, escribir: async () => {} }, env: {} });
    const env = { OPENAI_API_KEY: "sk-prueba-1234567890" };
    const a = await generarImagenOpenAI("a lamp", "16:9", { dirMedia: dir, fetchFn, env, gasto });
    expect(cuerpos[0]).toMatchObject({ model: "gpt-image-2", quality: "low", size: "1536x1024", output_format: "webp", output_compression: 85 });
    expect(existsSync(join(dir, a.ruta.replace(/^\/media\//, "")))).toBe(true);
    expect(a.deCache).toBe(false);
    const b = await generarImagenOpenAI("a lamp", "16:9", { dirMedia: dir, fetchFn, env, gasto });
    expect(b.deCache).toBe(true);
    expect(cuerpos).toHaveLength(1); // el mismo prompt no se paga dos veces
    const h = await gasto.hoy();
    expect(h.peticiones).toBe(1);
    expect(h.usd).toBeGreaterThan(0);
    expect(h.usd).toBeLessThan(0.05);
  });

  it("429 en gpt-image-2 → gpt-image-1-mini; 429 en los dos → ErrorFuente cupo (quien llama cae a FLUX)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "oa-"));
    const b64 = await png();
    const modelos: string[] = [];
    const env = { OPENAI_API_KEY: "sk-prueba-1234567890" };
    const f1 = (async (_u: string, init: RequestInit) => {
      const m = (JSON.parse(init.body as string) as { model: string }).model;
      modelos.push(m);
      return m === "gpt-image-2" ? new Response("{}", { status: 429 }) : new Response(JSON.stringify({ data: [{ b64_json: b64 }] }), { status: 200 });
    }) as unknown as typeof fetch;
    const r = await generarImagenOpenAI("a table", "1:1", { dirMedia: dir, fetchFn: f1, env, gasto: crearContadorGasto({ proveedor: "openai", almacen: { leer: async () => null, escribir: async () => {} }, env: {} }) });
    expect(modelos).toEqual(["gpt-image-2", "gpt-image-1-mini"]);
    expect(r.modelo).toBe("gpt-image-1-mini");
    const f2 = (async () => new Response("{}", { status: 429 })) as unknown as typeof fetch;
    await expect(generarImagenOpenAI("otra mesa", "1:1", { dirMedia: dir, fetchFn: f2, env, gasto: crearContadorGasto({ proveedor: "openai", almacen: { leer: async () => null, escribir: async () => {} }, env: {} }) })).rejects.toMatchObject({ tipo: "cupo" });
  });

  it("sin clave o con el presupuesto agotado no llama a la API", async () => {
    const dir = mkdtempSync(join(tmpdir(), "oa-"));
    let llamadas = 0;
    const fetchFn = (async () => (llamadas++, new Response("{}", { status: 200 }))) as unknown as typeof fetch;
    await expect(generarImagenOpenAI("x", "1:1", { dirMedia: dir, fetchFn, env: {} })).rejects.toMatchObject({ tipo: "deshabilitada" });
    const gasto = crearContadorGasto({ proveedor: "openai", almacen: { leer: async () => null, escribir: async () => {} }, env: { OPENAI_PRESUPUESTO_USD_DIA: "0.001" } });
    await gasto.registrarUsd("gpt-image-2", 0.5);
    await expect(generarImagenOpenAI("y", "1:1", { dirMedia: dir, fetchFn, env: { OPENAI_API_KEY: "sk-prueba-1234567890" }, gasto })).rejects.toMatchObject({ tipo: "cupo" });
    expect(llamadas).toBe(0);
  });
});

describe("24-A · POST /api/landings/[id]/imagenes", () => {
  it("llena los marcadores de una landing sin fotos, guarda una versión antes y deja las alternativas en el checkpoint", async () => {
    const doc = fixture.landingEjemplo;
    const brief = { nombre: "Tours de auroras", categoria: "otro", problema: "Viaje para ver auroras boreales", publico: "Viajeros", beneficios: ["a", "b", "c"], precio: { valor: 0, moneda: "COP" }, objeciones: [], nivelConciencia: "problema", intensidad: 3 };
    const c = await crearLanding({ brief: brief as never, tecnicas: [], prompt: { rol: "r", tarea: "t", contexto: "c", formato: "f", aportes: [] }, doc: { ...doc, assets: [] }, proveedor: "x" });
    const antes = LandingDoc.parse(c.doc).assets.filter((a) => a.ruta).length;
    expect(antes).toBe(0);
    const checkpoint = almacenCheckpointMemoria();
    const dir = mkdtempSync(join(tmpdir(), "rep-"));
    mkdirSync(join(dir, "bancos", "generadas"), { recursive: true });
    let n = 0;
    const r = await repararImagenes(c.id, {
      dirMedia: dir,
      checkpoint,
      candidatos: async () => [medio("aur1", "aurora boreal verde", { fuente: "wikimedia" }), medio("aur2", "aurora sobre el lago", { fuente: "wikimedia" })],
      generarOpenAI: async () => ({ ruta: `/media/bancos/generadas/oa-${++n}.webp`, modelo: "gpt-image-2" }),
      generarFlux: async () => ({ ruta: `/media/bancos/generadas/fx-${++n}.webp` }),
      elegir: async ({ miniaturas }) => ({ candidatas: miniaturas.map((m) => ({ indice: m.indice, relevancia: 8 - m.indice, calidad: 8, paleta: 7, aptitud: 9, motivo: "ok" })), elegida: 0, motivo: "la primera" }),
    });
    expect(r.asignados.length).toBeGreaterThan(0);
    expect(r.marcadores).toEqual([]);
    const despues = await obtenerLanding(c.id);
    expect(despues.doc.assets.filter((a) => a.ruta).length).toBe(r.asignados.length);
    const rutas = despues.doc.assets.filter((a) => a.ruta).map((a) => a.ruta);
    expect(new Set(rutas).size).toBe(rutas.length); // sin repetir archivo
    const cp = await checkpoint.leer(c.id);
    expect(Object.keys(cp!.imagenes!.alternativas).length).toBeGreaterThan(0);
    const { listarVersiones } = await import("@/lib/landings");
    expect((await listarVersiones(c.id)).some((v) => v.nota === "Antes de buscar fotos")).toBe(true);
    // una segunda llamada no hace nada: ya no hay marcadores
    const otra = await repararImagenes(c.id, { dirMedia: dir, checkpoint });
    expect(otra.asignados).toEqual([]);
    void readFileSync;
    void EJEMPLO_POR_TIPO;
    void ({} as Asset);
  });
});
