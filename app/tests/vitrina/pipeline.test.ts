import "../ayudas-db";
import { existsSync, mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import type { ZodType } from "zod";
import { VITRINA } from "@/datos/vitrina";
import { LandingDoc, type Critica, type MedioBanco, type TipoSeccion } from "@/lib/contratos";
import { almacenMemoria } from "@/lib/fuentes/cache";
import { crearFuentes } from "@/lib/fuentes/registro";
import { EJEMPLO_ESTRATEGIA } from "@/lib/ia/prompts/estrategia";
import { ejemploDeSeccion } from "@/lib/ia/prompts/seccion";
import { ErrorIA, type ProveedorIA } from "@/lib/ia/tipos";
import { construirEntrada, escribirArchivo } from "@/lib/vitrina/construir";
import { sembrarVitrina } from "@/lib/vitrina/archivo";
import { obtenerPorSlug } from "@/lib/landings";
import { ErrorVitrina } from "@/lib/vitrina/construir";
import { conLimite, esquemaDeRedaccion, fijarSecciones, normalizarPlan, seccionesADeCorregir, tiposObligatorios } from "@/lib/vitrina/pipeline";
import { filasFicha } from "@/lib/vitrina/plan";
import { slotsDeVitrina } from "@/lib/vitrina/imagenes";

const PROYECTOR = VITRINA.find((e) => e.slug === "proyector-galaxias-auroras")!;
const CEPILLO = VITRINA.find((e) => e.slug === "cepillo-dental-electrico-vitrina")!;

const critica = (puntaje: number, extra: Partial<Critica> = {}): Critica => ({
  puntaje,
  porCriterio: [
    { criterio: "Claridad en 3 s", puntaje: 9.5, evidencia: "secciones[1].ajustes.titular" },
    { criterio: "Originalidad", puntaje: puntaje < 9 ? 7 : 9.6, evidencia: "secciones[3].ajustes.titulo" },
  ],
  problemas: puntaje < 9 ? ["secciones[3].ajustes.titulo sirve para cualquier competidor."] : [],
  correcciones: puntaje < 9 ? ["secciones[3].ajustes.titulo: hablar de la escena del problema."] : [],
  ...extra,
});

interface Registro {
  sistemas: string[];
  usuarios: { tarea: string; usuario: string }[];
  activas: number;
  maxActivas: number;
}

/** Proveedor simulado que responde según el rol del prompt y anota cada llamada. */
function proveedorSimulado(notas: number[], reg: Registro, opciones: { retardoMs?: number; imagenApta?: boolean } = {}): ProveedorIA {
  let llamadasCritico = 0;
  return {
    id: "gemini",
    disponible: () => true,
    soportaImagen: true,
    async generarJSON<T>(p: { sistema: string; usuario: string; esquema: ZodType<T>; imagen?: unknown }) {
      const s = p.sistema;
      reg.sistemas.push(s.slice(0, 80));
      reg.activas++;
      reg.maxActivas = Math.max(reg.maxActivas, reg.activas);
      try {
        if (opciones.retardoMs) await new Promise((r) => setTimeout(r, opciones.retardoMs));
        let datos: unknown;
        if (p.imagen) {
          datos = { apta: opciones.imagenApta ?? false, motivo: "Muestra un cielo nocturno sin texto", confianza: 0.9 };
          reg.usuarios.push({ tarea: "validar-imagen", usuario: p.usuario });
        } else if (s.includes("estratega senior")) {
          datos = EJEMPLO_ESTRATEGIA;
          reg.usuarios.push({ tarea: "estrategia", usuario: p.usuario });
        } else if (s.includes("arquitecto de landings")) {
          datos = { secciones: tiposObligatorios(PROYECTOR).map((tipo) => ({ tipo, variante: null, objetivoPsicologico: `Responder la pregunta de ${tipo}.`, notasCopy: "Usar el dato del brief y matar la objeción principal.", datoAUsar: "Precio y garantía del vendedor." })) };
          reg.usuarios.push({ tarea: "plan", usuario: p.usuario });
        } else if (s.includes("Escribes UNA sección")) {
          const tipo = /Escribe el contenido de la sección «([a-z-]+)/.exec(s)![1] as TipoSeccion;
          datos = ejemploDeSeccion(tipo);
          reg.usuarios.push({ tarea: `seccion:${tipo}`, usuario: p.usuario });
        } else if (s.includes("director de arte")) {
          const slots = [...p.usuario.matchAll(/^- ([a-z0-9-]+) \(/gm)].map((m) => m[1]);
          datos = { ficha: { paleta: "deep navy and teal", luz: "soft side light", lente: "50 mm lens", estilo: "clean product photo", fondo: "dark wall" }, slots: slots.map((slot) => ({ slot, prompt: `A product photo for ${slot} with deep navy and teal palette, soft side light, 50 mm lens, clean product photography, centered subject. No text.`, alt: `Descripción de la imagen del lugar ${slot} con luz suave y fondo oscuro` })) };
          reg.usuarios.push({ tarea: "imagenes", usuario: p.usuario });
        } else if (s.includes("director creativo y especialista en CRO")) {
          const nota = notas[Math.min(llamadasCritico++, notas.length - 1)];
          datos = critica(nota);
          reg.usuarios.push({ tarea: "critico", usuario: p.usuario });
        } else if (s.includes("editor de estilo")) {
          datos = { correcciones: [] };
        } else {
          throw new ErrorIA("red", `Sin manejador para: ${s.slice(0, 60)}`);
        }
        return { datos: p.esquema.parse(datos), proveedor: "gemini" as const, modelo: "sim", ms: 1 };
      } finally {
        reg.activas--;
      }
    },
  } as ProveedorIA;
}

const nuevoRegistro = (): Registro => ({ sistemas: [], usuarios: [], activas: 0, maxActivas: 0 });
const fuentesSin = () => crearFuentes({ fetchFn: (async () => new Response("no", { status: 404 })) as typeof fetch, esperaReintentoMs: 0, env: {} });

async function preparar(entrada = PROYECTOR, banco: MedioBanco[] = []) {
  const dirMedia = mkdtempSync(join(tmpdir(), "pipe-"));
  mkdirSync(join(dirMedia, "bancos", "generadas"), { recursive: true });
  let n = 0;
  return {
    dirMedia,
    entrada,
    banco,
    generar: async () => {
      const ruta = `/media/bancos/generadas/g${++n}.webp`;
      await sharp({ create: { width: 200, height: 120, channels: 3, background: "#123456" } }).webp().toFile(join(dirMedia, ruta.replace(/^\/media\//, "")));
      return { ruta };
    },
  };
}

const deps = (p: ProveedorIA, base: Awaited<ReturnType<typeof preparar>>, extra: object = {}) => ({
  dirMedia: base.dirMedia,
  fuentes: fuentesSin(),
  ejecucion: { almacen: almacenMemoria() },
  medios: async () => base.banco,
  curiosos: [{ id: "b8-01", frase: "¿Sabías que las auroras se forman cuando electrones caen sobre la atmósfera superior?", tema: "b5", fuente: { nombre: "NASA · Aurora", url: "https://images.nasa.gov/details/a" } }],
  generar: base.generar,
  esperaCuotaMs: 0,
  enrutador: { proveedores: [p], registrarUso: async () => {}, modo: "simultaneo" as const, tablaTareas: {}, config: {}, espera: async () => {}, cache: undefined },
  ...extra,
});

describe("pipeline por etapas de la vitrina", () => {
  it("corre las etapas en orden, con una llamada por sección, y termina cuando el crítico llega a 9,5", async () => {
    const reg = nuevoRegistro();
    const base = await preparar();
    const r = await construirEntrada(PROYECTOR, deps(proveedorSimulado([9.6], reg), base));
    const tareas = reg.usuarios.map((u) => u.tarea);
    expect(tareas[0]).toBe("estrategia");
    expect(tareas[1]).toBe("plan");
    const secciones = tareas.filter((t) => t.startsWith("seccion:"));
    expect(secciones).toHaveLength(tiposObligatorios(PROYECTOR).length); // una llamada por sección
    expect(new Set(secciones).size).toBe(secciones.length);
    expect(tareas.indexOf("imagenes")).toBeGreaterThan(tareas.lastIndexOf(secciones.at(-1)!) - 1);
    expect(tareas.at(-1)).toBe("critico");
    expect(r.puntaje).toBe(9.6);
    expect(r.intentos).toBe(1);
    expect(r.pendiente).toBe(false);
    expect(LandingDoc.safeParse(r.doc).success).toBe(true);
    expect(r.doc.secciones[0].tipo).toBe("heroe");
  });

  it("la redacción va como máximo de a 3 llamadas a la vez", async () => {
    const reg = nuevoRegistro();
    const base = await preparar();
    await construirEntrada(PROYECTOR, deps(proveedorSimulado([9.6], reg, { retardoMs: 15 }), base));
    expect(reg.maxActivas).toBeLessThanOrEqual(3);
    expect(reg.maxActivas).toBeGreaterThanOrEqual(2);
    const lim = await conLimite(2, [1, 2, 3, 4, 5].map((n) => async () => n * 2));
    expect(lim.map((x) => (x.status === "fulfilled" ? x.value : null))).toEqual([2, 4, 6, 8, 10]);
  });

  it("el crítico ve un contexto limpio: sin la estrategia y con el contexto de fidelidad", async () => {
    const reg = nuevoRegistro();
    const base = await preparar();
    await construirEntrada(PROYECTOR, deps(proveedorSimulado([9.6], reg), base));
    const critico = reg.usuarios.find((u) => u.tarea === "critico")!;
    expect(critico.usuario).not.toContain("mecanismoUnico");
    expect(critico.usuario).toContain("LANDING A AUDITAR");
    expect(reg.sistemas.some((x) => x.includes("director creativo"))).toBe(true);
  });

  it("corrección dirigida: solo se reescribe la sección señalada, con la instrucción del crítico", async () => {
    const reg = nuevoRegistro();
    const base = await preparar();
    const r = await construirEntrada(PROYECTOR, deps(proveedorSimulado([8.2, 9.6], reg), base));
    const conCorreccion = reg.usuarios.filter((u) => u.usuario.includes("CORRECCIÓN PEDIDA POR EL CRÍTICO"));
    expect(conCorreccion.length).toBeGreaterThan(0);
    expect(conCorreccion.length).toBeLessThanOrEqual(4);
    expect(conCorreccion[0].usuario).toContain("sirve para cualquier competidor");
    expect(reg.usuarios.filter((u) => u.tarea === "critico")).toHaveLength(2);
    expect(r.notas.map((n) => n.puntaje)).toEqual([8.2, 9.6]);
    expect(r.notas[0].criterios.find((c) => c.criterio === "Originalidad")?.puntaje).toBe(7);
    expect(r.puntaje).toBe(9.6);
    expect(r.intentos).toBe(1);
  });

  it("si no llega, prueba otro ángulo y otra semilla hasta 4 intentos y queda pendiente sin bajar la vara", async () => {
    const reg = nuevoRegistro();
    const base = await preparar();
    const r = await construirEntrada(PROYECTOR, deps(proveedorSimulado([7.0], reg), base, { maxVueltas: 1 }));
    expect(r.intentos).toBe(4);
    expect(r.pendiente).toBe(true);
    expect(r.puntaje).toBe(7);
    const estrategias = reg.usuarios.filter((u) => u.tarea === "estrategia");
    expect(estrategias).toHaveLength(4);
    expect(estrategias[0].usuario).not.toContain("ÁNGULO OBLIGATORIO");
    expect(estrategias[1].usuario).toContain("ÁNGULO OBLIGATORIO");
    expect(estrategias[1].usuario).toContain(EJEMPLO_ESTRATEGIA.angulos.alternos[0]);
    expect(estrategias[2].usuario).toContain(EJEMPLO_ESTRATEGIA.angulos.alternos[1]);
    // las imágenes se resolvieron una sola vez
    expect(reg.usuarios.filter((u) => u.tarea === "imagenes")).toHaveLength(1);
    expect(r.notas.map((n) => n.intento)).toEqual([1, 2, 3, 4]);
  });

  it("imágenes: sin banco se generan y quedan marcadas ia-flux / generada; ningún marcador queda en el héroe", async () => {
    const reg = nuevoRegistro();
    const base = await preparar();
    const r = await construirEntrada(PROYECTOR, deps(proveedorSimulado([9.6], reg), base));
    const conRuta = r.doc.assets.filter((a) => a.ruta);
    expect(conRuta.length).toBe(slotsDeVitrina(PROYECTOR).length);
    for (const a of conRuta) {
      expect(a).toMatchObject({ fuente: "ia-flux", licencia: "generada", generada: true });
      expect(a.alt.split(" ").length).toBeGreaterThanOrEqual(8);
      expect(a.promptGrok).toContain("No text");
      expect(a.ruta).toMatch(/^\/media\/vitrina\/proyector-galaxias-auroras\//);
    }
    expect(r.imagenes).toMatchObject({ reales: 0, generadas: conRuta.length, marcadores: 0 });
    const heroe = r.doc.secciones.find((s) => s.tipo === "heroe")!;
    expect(heroe.variante).toBe("producto-monumental");
    expect(heroe.ajustes.slot).toBe("heroe-producto");
  });

  it("imágenes del banco: solo entra la que la visión aprueba; si no, se genera", async () => {
    const reg = nuevoRegistro();
    const medio: MedioBanco = { id: "m1", bancoId: "b1", tipo: "imagen", fuente: "nasa-images", idFuente: "nebulosa", ruta: "/media/bancos/b1/nebulosa.webp", ancho: 1920, alto: 1080, orientacion: "horizontal", coloresDominantes: ["#02030a"], titulo: "Nebulosa de galaxia", descripcion: "Una nebulosa oscura", etiquetas: ["galaxia"], credito: "NASA/JPL", licencia: "dominio-publico-nasa", usoComercial: true };
    const base = await preparar(PROYECTOR, [medio]);
    mkdirSync(join(base.dirMedia, "bancos", "b1"), { recursive: true });
    await sharp({ create: { width: 300, height: 200, channels: 3, background: "#02030a" } }).webp().toFile(join(base.dirMedia, "bancos", "b1", "nebulosa.webp"));
    const apta = await construirEntrada(PROYECTOR, deps(proveedorSimulado([9.6], reg, { imagenApta: true }), base));
    const delBanco = apta.doc.assets.find((a) => a.bancoId === "b1")!;
    expect(delBanco).toMatchObject({ fuente: "nasa-images", credito: "NASA/JPL", licencia: "dominio-publico-nasa" });
    expect(delBanco.generada).toBeUndefined();
    expect(apta.imagenes.reales).toBe(1);
    const reg2 = nuevoRegistro();
    const base2 = await preparar(PROYECTOR, [medio]);
    mkdirSync(join(base2.dirMedia, "bancos", "b1"), { recursive: true });
    await sharp({ create: { width: 300, height: 200, channels: 3, background: "#02030a" } }).webp().toFile(join(base2.dirMedia, "bancos", "b1", "nebulosa.webp"));
    const noApta = await construirEntrada(PROYECTOR, deps(proveedorSimulado([9.6], reg2, { imagenApta: false }), base2));
    expect(noApta.doc.assets.some((a) => a.bancoId === "b1")).toBe(false);
    expect(noApta.imagenes.reales).toBe(0);
    expect(existsSync(join(base2.dirMedia, "vitrina", "proyector-galaxias-auroras"))).toBe(true);
  });

  it("la sección de créditos y la de efectos: al menos un momento de nivel 3 y el precio del vendedor", async () => {
    const reg = nuevoRegistro();
    const base = await preparar();
    const r = await construirEntrada(PROYECTOR, deps(proveedorSimulado([9.6], reg), base));
    expect(r.nivel3).toBeGreaterThanOrEqual(1);
    expect(r.nivel3).toBeLessThanOrEqual(3);
    expect(r.doc.secciones.find((s) => s.tipo === "beneficios")?.efectos).toContain("pin-coreografia");
    const oferta = r.doc.secciones.find((s) => s.tipo === "oferta")!;
    expect(oferta.ajustes.precio).toBe(PROYECTOR.brief.precio.valor);
    expect(oferta.bloques).toHaveLength(1);
    expect(r.doc.secciones.map((s) => s.tipo)).toEqual(expect.arrayContaining(["dato-en-vivo", "cta-fija", "creditos", "sellos-confianza", "ficha-tecnica"]));
    expect(r.doc.secciones.filter((s) => s.tipo === "garantia")).toHaveLength(1);
  });
});

describe("cuota y siembra", () => {
  it("con la cuota agotada pausa, sigue con el mismo intento y no baja el criterio", async () => {
    const reg = nuevoRegistro();
    const base = await preparar();
    const real = proveedorSimulado([9.6], reg);
    let fallos = 2;
    const conFallos: ProveedorIA = { ...real, async generarJSON(p) { if (fallos-- > 0) throw new ErrorIA("limite", "cuota agotada"); return real.generarJSON(p); } };
    const r = await construirEntrada(PROYECTOR, deps(conFallos, base));
    expect(r.puntaje).toBe(9.6);
    expect(r.intentos).toBe(1);
  });

  it("si la cuota no vuelve, lanza ErrorVitrina de tipo cuota", async () => {
    const base = await preparar();
    const muerto: ProveedorIA = { id: "gemini", disponible: () => true, soportaImagen: true, async generarJSON() { throw new ErrorIA("limite", "cuota agotada"); } } as ProveedorIA;
    await expect(construirEntrada(PROYECTOR, deps(muerto, base))).rejects.toBeInstanceOf(ErrorVitrina);
  });

  it("el archivo de la vitrina siembra el banco sin claves de IA, y es idempotente", async () => {
    const base = await preparar();
    const r = await construirEntrada(PROYECTOR, deps(proveedorSimulado([9.6], nuevoRegistro()), base));
    const carpeta = mkdtempSync(join(tmpdir(), "vitrina-datos-"));
    await escribirArchivo(join(carpeta, `${PROYECTOR.slug}.json`), r);
    expect(await sembrarVitrina({ carpeta })).toEqual([{ slug: PROYECTOR.slug, estado: "creada", banco: true }]);
    expect((await obtenerPorSlug(PROYECTOR.slug))?.estado).toBe("en-banco");
    expect((await sembrarVitrina({ carpeta }))[0].estado).toBe("omitida");
  });
});

describe("piezas del pipeline", () => {
  it("el plan siempre trae todas las obligatorias, en orden, sin tipos desconocidos ni repetidos", () => {
    const plan = normalizarPlan({ secciones: [{ tipo: "faq", variante: null, objetivoPsicologico: "Responder dudas", notasCopy: "notas de copy concretas del brief", datoAUsar: "preguntas" }, { tipo: "testimonios", variante: null, objetivoPsicologico: "Prueba social inventada", notasCopy: "notas de copy concretas del brief", datoAUsar: "nada" }, { tipo: "faq", variante: null, objetivoPsicologico: "Otra vez", notasCopy: "notas de copy concretas del brief", datoAUsar: "preguntas" }] }, PROYECTOR);
    expect(plan.map((p) => p.tipo)).toEqual(tiposObligatorios(PROYECTOR));
    expect(plan.find((p) => p.tipo === "faq")!.objetivoPsicologico).toBe("Responder dudas");
  });

  it("fijar secciones: precio, garantía y slots salen del sistema, no de la IA", () => {
    const base = ["heroe", "problema-solucion", "galeria", "incluye", "oferta", "garantia"].map((tipo) => {
      const ej = ejemploDeSeccion(tipo as TipoSeccion)!;
      return { id: tipo, tipo: tipo as TipoSeccion, visible: true, intencion: { objetivo: "x" }, ajustes: { ...ej.ajustes, precio: 1, dias: 999 }, bloques: ej.bloques.map((b, i) => ({ id: `${tipo}-${i}`, ...b })) };
    });
    const r = fijarSecciones(base, PROYECTOR, PROYECTOR.brief, []);
    const por = (t: string) => r.find((s) => s.tipo === t)!;
    expect(por("oferta").ajustes).toMatchObject({ precio: 89900, moneda: "COP" });
    expect(por("oferta").ajustes.precioAnterior).toBeUndefined();
    expect(por("oferta").bloques).toEqual([{ id: "opc-1", tipo: "opcion-cantidad", ajustes: { unidades: 1, precio: 89900 } }]);
    expect(por("garantia").ajustes.dias).toBe(30);
    expect(por("heroe").variante).toBe("producto-monumental");
    expect(por("heroe").ajustes).toMatchObject({ slot: "heroe-producto", slots: ["heroe-fondo"] });
    expect(por("problema-solucion").ajustes.imagen).toBe("problema");
    expect(por("incluye").ajustes.imagen).toBe("incluye-empaque");
    expect(por("galeria").bloques.map((b) => b.ajustes.slot)).toEqual(["galeria-1", "galeria-2", "galeria-3", "galeria-4"].slice(0, por("galeria").bloques.length));
    expect(por("beneficios")).toBeUndefined();
    const sinEspacio = fijarSecciones(base.slice(0, 1), CEPILLO, CEPILLO.brief, []);
    expect(sinEspacio[0].ajustes.slots).toBeUndefined();
  });

  it("el crítico solo manda a corregir secciones que la IA escribió, con criterios bajo 9", () => {
    const doc = { secciones: [{ tipo: "cinta-anuncio" }, { tipo: "heroe" }, { tipo: "sellos-confianza" }, { tipo: "problema-solucion" }] } as never;
    const c = critica(8, {
      porCriterio: [{ criterio: "Fricción", puntaje: 6, evidencia: "secciones[2].bloques" }, { criterio: "Claridad", puntaje: 9.5, evidencia: "secciones[1].ajustes.titular" }, { criterio: "Originalidad", puntaje: 7, evidencia: "secciones[3].ajustes.historia" }],
      problemas: ["secciones[3].ajustes.historia es genérica"],
      correcciones: [],
    });
    const m = seccionesADeCorregir(c, doc, new Set(["cinta-anuncio", "heroe", "problema-solucion"]));
    expect([...m.keys()]).toEqual([3]); // la 2 es del sistema y la 1 tiene 9,5
    expect(m.get(3)!.length).toBe(2);
  });

  it("el esquema de redacción tolera bloques sin id y rechaza contenido que rompe los límites", () => {
    const esquema = esquemaDeRedaccion("faq");
    const ej = ejemploDeSeccion("faq")!;
    const sinIds = { ajustes: ej.ajustes, bloques: ej.bloques.map((b) => ({ tipo: b.tipo, ajustes: b.ajustes })) };
    const r = esquema.safeParse(sinIds);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.bloques[0].id).toBe("faq-1");
    expect(esquema.safeParse({ ajustes: {}, bloques: [] }).success).toBe(false);
  });

  it("la ficha no lleva filas [COMPLETAR], suma la fuente y usa datos reales de la investigación", () => {
    for (const e of VITRINA) {
      const filas = filasFicha(e, { preciosReferencia: [{ precio: 60000 }, { precio: 90000 }, { precio: 120000 }] });
      expect(filas.some((f) => f.valor.includes("[COMPLETAR]")), e.slug).toBe(false);
      expect(filas.length).toBeGreaterThanOrEqual(4);
      expect(filas.length).toBeLessThanOrEqual(12);
      expect(filas.at(-1)!.nombre).toBe("Fuente de los datos");
      expect(filas.find((f) => f.nombre === "Precio en tiendas")?.valor).toBe("$60.000 a $120.000");
      for (const f of filas) expect(f.valor.length).toBeLessThanOrEqual(60);
    }
    expect(filasFicha(PROYECTOR).some((f) => f.nombre === "Precio en tiendas")).toBe(false); // sin investigación no se inventa
    expect(filasFicha(PROYECTOR).find((f) => f.nombre === "Dato del cielo en vivo")?.valor).toContain("NOAA");
  });
});
