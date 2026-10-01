import "../ayudas-db";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import type { ZodType } from "zod";
import { POST as rutaPOST } from "@/app/api/generar/route";
import { BriefGeneral, LandingDoc, TIPOS_LANDING, type Critica, type TipoLanding, type TipoSeccion } from "@/lib/contratos";
import { almacenMemoria } from "@/lib/fuentes/cache";
import { crearFuentes } from "@/lib/fuentes/registro";
import { BLUEPRINTS, planBlueprint } from "@/lib/generar/blueprints";
import { detectarWidget, enrutarFuentes, esEspacial } from "@/lib/generar/fuentes";
import { crearManejadorGenerar } from "@/lib/generar/http";
import { promptIntake, rastreable, sanearBrief } from "@/lib/generar/intake";
import { generarLanding, type EventoGenerar } from "@/lib/generar/pipeline";
import { EJEMPLO_ESTRATEGIA } from "@/lib/ia/prompts/estrategia";
import { ejemploDeSeccion } from "@/lib/ia/prompts/seccion";
import type { ProveedorIA } from "@/lib/ia/tipos";
import { obtenerPorSlug } from "@/lib/landings";
import { fijarDepsEnrutador } from "@/lib/ia/deps";

const DESCRIPCIONES: Record<TipoLanding, string> = {
  evento: "Landing para una noche de observación de la lluvia de meteoros en Villa de Leyva",
  divulgacion: "Landing educativa: dónde está la Estación Espacial ahora mismo",
  servicio: "Landing para una agencia de tours de auroras",
  producto: "Landing para vender una lámpara de luna",
  curso: "Landing para un curso de fotografía con el celular",
  app: "Landing para una app que organiza las tareas del hogar",
  causa: "Landing para una fundación que reforesta cerros en Boyacá",
  local: "Landing para una panadería de barrio con pan de bono recién hecho",
};

const critica = (puntaje: number): Critica => ({ puntaje, porCriterio: [{ criterio: "Claridad en 3 s", puntaje: 9, evidencia: "secciones[0].ajustes.titular" }], problemas: [], correcciones: [] });

interface Registro {
  roles: string[];
}

/** Proveedor simulado: responde según el rol del prompt. `inventaFecha` hace que el intake invente una fecha. */
function simulado(tipo: TipoLanding, reg: Registro, opciones: { inventaFecha?: boolean; ponentes?: boolean } = {}): ProveedorIA {
  let brief: BriefGeneral | null = null;
  return {
    id: "gemini",
    disponible: () => true,
    soportaImagen: true,
    async generarJSON<T>(p: { sistema: string; usuario: string; esquema: ZodType<T>; imagen?: unknown }) {
      const s = p.sistema;
      let datos: unknown;
      if (p.imagen) {
        reg.roles.push("validar");
        datos = { apta: false, motivo: "No muestra lo esperado", confianza: 0.9 };
      } else if (s.includes("analista de encargos")) {
        reg.roles.push("intake");
        brief = {
          tipo,
          nombre: DESCRIPCIONES[tipo].replace(/^Landing (educativa: |para )?/, "").slice(0, 70),
          tematica: esEspacial(DESCRIPCIONES[tipo]) ? "espacio" : "general",
          publico: "Personas curiosas que quieren participar sin complicaciones.",
          propuesta: "Una propuesta clara y sin rodeos para quien llega desde el celular.",
          beneficios: ["Entender de qué se trata en segundos", "Un paso simple para empezar", "Información clara y verificable"],
          datosClave: [],
          faltantes: [],
          ...(DESCRIPCIONES[tipo].includes("Villa de Leyva") ? { lugar: "Villa de Leyva" } : {}),
          ...(opciones.inventaFecha ? { fecha: "15 de agosto de 2027", lugar: "Parque Nacional del Chicamocha", precio: 99000 } : {}),
          ...(opciones.ponentes ? { ponentes: [{ nombre: "Ana Torres", rol: "Guía" }] } : {}),
        } as BriefGeneral;
        datos = brief;
      } else if (s.includes("estratega senior")) {
        reg.roles.push("estrategia");
        datos = EJEMPLO_ESTRATEGIA;
      } else if (s.includes("arquitecto de landings")) {
        reg.roles.push("plan");
        const pl = planBlueprint(tipo, { ponentes: brief?.ponentes, agenda: brief?.agenda }, detectarWidget(DESCRIPCIONES[tipo]) !== null && esEspacial(DESCRIPCIONES[tipo]));
        datos = { secciones: [...pl.obligatorias, ...pl.opcionales].map((t) => ({ tipo: t, variante: null, objetivoPsicologico: `Responder la pregunta de ${t} en este tipo.`, notasCopy: "Usar el dato del brief y no inventar nada.", datoAUsar: "Datos del brief." })) };
      } else if (s.includes("Escribes UNA sección")) {
        const t = /Escribe el contenido de la sección «([a-z-]+)/.exec(s)![1] as TipoSeccion;
        reg.roles.push(`seccion:${t}`);
        datos = ejemploDeSeccion(t);
      } else if (s.includes("director de arte")) {
        reg.roles.push("imagenes");
        const slots = [...p.usuario.matchAll(/^- ([a-z0-9-]+) \(/gm)].map((m) => m[1]);
        datos = { ficha: { paleta: "deep navy and teal", luz: "soft side light", lente: "50 mm lens", estilo: "clean editorial photo", fondo: "plain wall" }, slots: slots.map((slot) => ({ slot, prompt: `A clean editorial photo for ${slot} with deep navy and teal palette, soft side light, 50 mm lens, centered subject. No text.`, alt: `Descripción de la imagen del lugar ${slot} con luz suave y fondo liso` })) };
      } else if (s.includes("director creativo y especialista en CRO")) {
        reg.roles.push("critico");
        datos = critica(9);
      } else if (s.includes("editor de estilo")) {
        datos = { correcciones: [] };
      } else {
        throw new Error(`Sin manejador: ${s.slice(0, 60)}`);
      }
      return { datos: p.esquema.parse(datos), proveedor: "gemini" as const, modelo: "sim", ms: 1 };
    },
  } as ProveedorIA;
}

const fuentesSin = () => crearFuentes({ fetchFn: (async () => new Response("no", { status: 404 })) as typeof fetch, esperaReintentoMs: 0, env: {} });

function base() {
  const dirMedia = mkdtempSync(join(tmpdir(), "gen-"));
  mkdirSync(join(dirMedia, "bancos", "generadas"), { recursive: true });
  let n = 0;
  return {
    dirMedia,
    generar: async () => {
      const ruta = `/media/bancos/generadas/g${++n}.webp`;
      await sharp({ create: { width: 200, height: 120, channels: 3, background: "#224466" } }).webp().toFile(join(dirMedia, ruta.replace(/^\/media\//, "")));
      return { ruta };
    },
  };
}

const enr = (p: ProveedorIA) => ({ proveedores: [p], registrarUso: async () => {}, modo: "simultaneo" as const, tablaTareas: {}, config: {}, espera: async () => {} });

async function correr(tipo: TipoLanding, opciones: Parameters<typeof simulado>[2] = {}, encargo: { descripcion?: string; datos?: Record<string, string> } = {}) {
  const reg: Registro = { roles: [] };
  const b = base();
  const eventos: EventoGenerar[] = [];
  let guardado: { doc: LandingDoc } | null = null;
  const r = await generarLanding({ descripcion: encargo.descripcion ?? DESCRIPCIONES[tipo], tipo, datos: encargo.datos }, (e) => eventos.push(e), {
    enrutador: enr(simulado(tipo, reg, opciones)),
    fuentes: fuentesSin(),
    ejecucion: { almacen: almacenMemoria() },
    dirMedia: b.dirMedia,
    candidatos: async () => [],
    generar: b.generar,
    guardar: async (p) => ((guardado = { doc: p.doc }), { id: "id-1", slug: p.doc.meta.slug }),
  });
  return { r, eventos, reg, guardado: guardado as { doc: LandingDoc } | null };
}

describe("16-A · un encargo por tipo con proveedores simulados", () => {
  for (const tipo of TIPOS_LANDING) {
    it(`${tipo}: genera una landing válida con las secciones de su blueprint`, async () => {
      const { r, eventos, reg } = await correr(tipo);
      expect(LandingDoc.safeParse(r.doc).success, JSON.stringify(LandingDoc.safeParse(r.doc).error?.issues.slice(0, 2))).toBe(true);
      const tipos = r.doc.secciones.map((s) => s.tipo);
      expect(tipos[0]).toBe("heroe");
      for (const t of BLUEPRINTS[tipo].obligatorias) expect(tipos, t).toContain(t);
      expect(tipos).not.toContain("testimonios");
      expect(tipos.filter((t) => t === "formulario-lead")).toHaveLength(1);
      expect(r.doc.meta.tipo).toBe(tipo);
      expect(r.doc.secciones.length).toBeGreaterThanOrEqual(5);
      expect(r.doc.secciones.length).toBeLessThanOrEqual(16);
      // etapas en orden y una llamada por sección
      expect(reg.roles.slice(0, 3)).toEqual(["intake", "estrategia", "plan"]);
      expect(reg.roles.filter((x) => x.startsWith("seccion:")).length).toBeGreaterThanOrEqual(BLUEPRINTS[tipo].obligatorias.length); // una llamada por sección (más las opcionales que entren)
      const etapas = eventos.filter((e) => e.tipo === "etapa").map((e) => (e as { etapa: string }).etapa);
      expect(etapas.slice(0, 3)).toEqual(["intake", "fuentes", "estrategia"]);
      expect(etapas.at(-1)).toBe("critico");
      expect(r.id).toBe("id-1");
    });
  }

  it("evento: lleva agenda; sin ponentes dados no hay sección de ponentes; con ponentes sí", async () => {
    const sin = await correr("evento");
    expect(sin.r.doc.secciones.map((s) => s.tipo)).toContain("agenda");
    expect(sin.r.doc.secciones.map((s) => s.tipo)).not.toContain("ponentes");
    const con = await correr("evento", { ponentes: true }, { descripcion: `${DESCRIPCIONES.evento} con Ana Torres como guía` });
    expect(con.r.doc.secciones.map((s) => s.tipo)).toContain("ponentes");
  });

  it("divulgación lleva línea de tiempo y causa lleva impacto; ninguna habla de comprar", async () => {
    const d = await correr("divulgacion");
    expect(d.r.doc.secciones.map((s) => s.tipo)).toContain("linea-tiempo");
    expect(d.r.doc.secciones.map((s) => s.tipo)).not.toContain("oferta");
    const c = await correr("causa");
    expect(c.r.doc.secciones.map((s) => s.tipo)).toContain("impacto");
    expect(c.r.doc.secciones.map((s) => s.tipo)).not.toContain("sellos-confianza");
  });

  it("los eventos siguen la forma que consume /crear: etapas, faltantes y progreso de secciones", async () => {
    const { eventos } = await correr("evento");
    const mensajes = eventos.filter((e) => e.tipo === "etapa").map((e) => (e as { mensaje: string }).mensaje);
    expect(mensajes).toContain("Entendiendo tu idea…");
    expect(mensajes).toContain("Buscando datos e imágenes…");
    expect(mensajes).toContain("Definiendo la estrategia…");
    expect(mensajes.some((m) => /^Escribiendo sección \d+\/\d+…$/.test(m))).toBe(true);
    expect(mensajes).toContain("Revisando como director creativo…");
    const f = eventos.find((e) => e.tipo === "faltantes") as Extract<EventoGenerar, { tipo: "faltantes" }>;
    expect(f.detectado).toMatchObject({ tipo: "evento", tematica: "espacio" });
    expect(f.faltantes.map((x) => x.clave)).toEqual(["fecha", "whatsapp"]); // el lugar (Villa de Leyva) sí se dijo
  });

  it("espacial: el dato en vivo y las imágenes (generadas por FLUX cuando el banco no sirve) van marcados", async () => {
    const { r } = await correr("evento");
    expect(r.doc.secciones.map((s) => s.tipo)).toContain("dato-en-vivo");
    expect(r.doc.secciones.find((s) => s.tipo === "dato-en-vivo")?.variante).toBe("fase-lunar");
    const conRuta = r.doc.assets.filter((a) => a.ruta);
    expect(conRuta.length).toBeGreaterThan(0);
    for (const a of conRuta) expect(a).toMatchObject({ fuente: "ia-flux", licencia: "generada", generada: true });
    const heroe = r.doc.secciones[0];
    expect(heroe.ajustes.slot).toBe("heroe-imagen");
    expect(r.doc.assets.find((a) => a.slot === "heroe-imagen")?.ruta).toBeTruthy();
  });
});

describe("16-A · el intake no inventa", () => {
  it("con la fecha ausente, la fecha va a faltantes aunque el modelo la invente", async () => {
    const { r } = await correr("evento", { inventaFecha: true });
    expect(r.brief.fecha).toBeUndefined();
    expect(r.brief.lugar).toBeUndefined(); // el lugar inventado por el modelo tampoco se conserva
    expect(r.faltantes.map((f) => f.clave)).toEqual(expect.arrayContaining(["fecha", "lugar"]));
    expect(r.avisos.join(" ")).toContain("15 de agosto");
    expect(JSON.stringify(r.doc)).not.toContain("Chicamocha");
  });

  it("lo que la persona fija a mano se impone y deja de faltar", async () => {
    const { r } = await correr("evento", {}, { datos: { fecha: "sábado 12 de octubre", whatsapp: "3001234567" } });
    expect(r.brief.fecha).toBe("sábado 12 de octubre");
    expect(r.brief.whatsapp).toBe("3001234567");
    expect(r.faltantes).toEqual([]);
  });

  it("un precio inventado se quita en un producto y se pide; uno dicho se conserva", () => {
    const b = { tipo: "producto", nombre: "Lámpara", tematica: "producto", publico: "Quien decora su cuarto", propuesta: "Una lámpara con la forma de la Luna", beneficios: ["Una", "Dos", "Tres"], datosClave: [], faltantes: [], precio: 89900 } as BriefGeneral;
    const sin = sanearBrief(b, { descripcion: "Landing para vender una lámpara de luna" });
    expect(sin.brief.precio).toBeUndefined();
    expect(sin.brief.faltantes.map((f) => f.clave)).toContain("precio");
    const con = sanearBrief(b, { descripcion: "Landing para vender una lámpara de luna a $89.900" });
    expect(con.brief.precio).toBe(89900);
    expect(con.brief.faltantes.map((f) => f.clave)).not.toContain("precio");
  });

  it("los faltantes son máximo 3 y los datos de otras fuentes no se descartan", () => {
    const b = { tipo: "curso", nombre: "Curso", tematica: "general", publico: "Quien quiere aprender", propuesta: "Aprender fotografía con el celular", beneficios: ["Uno", "Dos", "Tres"], datosClave: [{ nombre: "Duración", valor: "3 semanas", origen: "usuario" }, { nombre: "Dato", valor: "La Luna mide 3.474 km", origen: "NASA" }], faltantes: [{ clave: "horario", pregunta: "¿Horario?" }, { clave: "nivel", pregunta: "¿Nivel?" }] } as BriefGeneral;
    const r = sanearBrief(b, { descripcion: "Curso de fotografía con el celular" });
    expect(r.brief.faltantes.length).toBeLessThanOrEqual(3);
    expect(r.brief.datosClave.map((d) => d.nombre)).toEqual(["Dato"]); // «3 semanas» no lo dijo nadie
    expect(rastreable("3 semanas", "curso de tres semanas")).toBe(false);
  });

  it("el prompt del intake tiene la estructura completa y prohíbe inventar", () => {
    const p = promptIntake({ descripcion: "Landing para una noche de observación", datos: { lugar: "Villa de Leyva" } });
    for (const s of ["## ROL", "## TAREA", "## CONOCIMIENTO", "## RESTRICCIONES", "## FORMATO", "## AUTOCONTROL"]) expect(p.sistema).toContain(s);
    expect(p.sistema).toContain("NUNCA inventes fecha, lugar, precio");
    expect(p.usuario).toContain("Villa de Leyva");
  });
});

describe("16-A · enrutamiento de fuentes por temática", () => {
  it("espacio → NASA, APOD, NeoWs, NOAA, USNO, ISS, Launch Library, datos curiosos y FLUX", () => {
    const e = enrutarFuentes({ tipo: "evento", tematica: "espacio", descripcion: DESCRIPCIONES.evento });
    expect(e.fuentes).toEqual(expect.arrayContaining(["nasa-images", "apod", "neows", "noaa-kp", "usno-luna", "iss", "lanzamientos", "datos-curiosos", "flux"]));
    expect(e.fuentes).not.toContain("openverse");
    expect(e.widget).toBe("fase-lunar");
    expect(e.imagenes).toEqual(["nasa-images", "flux"]);
  });

  it("producto → Google Shopping (y Open Food o Beauty Facts si aplica); no usa Openverse", () => {
    const p = enrutarFuentes({ tipo: "producto", tematica: "general", descripcion: "vender un termo" });
    expect(p.fuentes).toEqual(["serpapi-shopping", "flux"]);
    expect(enrutarFuentes({ tipo: "producto", tematica: "alimentos", descripcion: "vender granola" }).fuentes).toContain("open-food-facts");
    expect(enrutarFuentes({ tipo: "producto", tematica: "belleza", descripcion: "vender un sérum" }).fuentes).toContain("open-beauty-facts");
    const lampara = enrutarFuentes({ tipo: "producto", tematica: "espacio", descripcion: DESCRIPCIONES.producto });
    expect(lampara.fuentes).toEqual(expect.arrayContaining(["serpapi-shopping", "usno-luna", "nasa-images"]));
    expect(lampara.widget).toBe("fase-lunar");
  });

  it("todo lo demás → Openverse y Wikimedia, y siempre FLUX al final", () => {
    const c = enrutarFuentes({ tipo: "causa", tematica: "general", descripcion: DESCRIPCIONES.causa });
    expect(c.fuentes).toEqual(["openverse", "wikimedia", "flux"]);
    expect(c.widget).toBeNull();
    for (const tipo of TIPOS_LANDING) expect(enrutarFuentes({ tipo, tematica: "general", descripcion: "tema libre" }).fuentes.at(-1)).toBe("flux");
  });

  it("el dato en vivo sigue al tema: lanzamiento, ISS, asteroides, auroras y luna", () => {
    expect(detectarWidget("ver en vivo el próximo lanzamiento de cohete")).toBe("cuenta-regresiva-lanzamiento");
    expect(detectarWidget("dónde está la Estación Espacial")).toBe("iss");
    expect(detectarWidget("asteroides que pasan hoy")).toBe("asteroides");
    expect(detectarWidget("tours de auroras")).toBe("auroras");
    expect(detectarWidget("vender una lámpara de luna")).toBe("fase-lunar");
    expect(detectarWidget("vender zapatos")).toBeNull();
    expect(enrutarFuentes({ tipo: "servicio", tematica: "espacio", descripcion: DESCRIPCIONES.servicio }).datosEnVivo).toEqual(["noaa-kp"]);
  });
});

describe("POST /api/generar", () => {
  it("responde NDJSON con las etapas, guarda la landing y termina con `listo` y su id", async () => {
    const reg: Registro = { roles: [] };
    const b = base();
    const manejador = crearManejadorGenerar({
      enrutador: enr(simulado("servicio", reg)),
      fuentes: fuentesSin(),
      ejecucion: { almacen: almacenMemoria() },
      dirMedia: b.dirMedia,
      candidatos: async () => [],
      generar: b.generar,
    });
    const res = await manejador(new Request("http://x/api/generar", { method: "POST", body: JSON.stringify({ descripcion: DESCRIPCIONES.servicio, tipo: "servicio" }) }));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/x-ndjson");
    const lineas = (await res.text()).trim().split("\n").map((l) => JSON.parse(l) as EventoGenerar);
    expect(lineas[0]).toMatchObject({ tipo: "etapa", etapa: "intake" });
    const ultimo = lineas.at(-1) as Extract<EventoGenerar, { tipo: "listo" }>;
    expect(ultimo.tipo).toBe("listo");
    expect(ultimo.id).toBeTruthy();
    const guardada = await obtenerPorSlug(ultimo.slug!);
    expect(guardada?.doc.meta.tipo).toBe("servicio");
    expect(guardada?.id).toBe(ultimo.id);
  });

  it("400 con un cuerpo que no es JSON o sin descripción; los fallos de la IA salen como evento de error", async () => {
    const m = crearManejadorGenerar({ enrutador: enr(simulado("evento", { roles: [] })), dirMedia: base().dirMedia });
    expect((await m(new Request("http://x", { method: "POST", body: "{roto" }))).status).toBe(400);
    expect((await m(new Request("http://x", { method: "POST", body: JSON.stringify({ descripcion: "" }) }))).status).toBe(400);
    const malo: ProveedorIA = { id: "gemini", disponible: () => true, async generarJSON() { throw new Error("sin cuota"); } };
    const m2 = crearManejadorGenerar({ enrutador: enr(malo), dirMedia: base().dirMedia, fuentes: fuentesSin() });
    const res = await m2(new Request("http://x", { method: "POST", body: JSON.stringify({ descripcion: "Landing de prueba" }) }));
    const lineas = (await res.text()).trim().split("\n").map((l) => JSON.parse(l));
    expect(lineas.at(-1).tipo).toBe("error");
  });

  it("la ruta real exporta POST (compatibilidad con /api/construir intacta)", async () => {
    expect(typeof rutaPOST).toBe("function");
    fijarDepsEnrutador(undefined);
  });
});
