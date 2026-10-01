import "../ayudas-db";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import type { ZodType } from "zod";
import { LandingDoc, TIPOS_LANDING, type BriefGeneral, type Critica, type TipoLanding, type TipoSeccion } from "@/lib/contratos";
import { almacenCheckpointMemoria } from "@/lib/generar/checkpoint";
import { BLUEPRINTS, planBlueprint } from "@/lib/generar/blueprints";
import { detectarWidget, esEspacial } from "@/lib/generar/fuentes";
import { generarLanding, marcarCompletar, type EventoGenerar } from "@/lib/generar/pipeline";
import { reintentarCritico } from "@/lib/generar/reintentar-critico";
import { crearFuentes } from "@/lib/fuentes/registro";
import { almacenMemoria } from "@/lib/fuentes/cache";
import { EJEMPLO_ESTRATEGIA } from "@/lib/ia/prompts/estrategia";
import { ejemploDeSeccion } from "@/lib/ia/prompts/seccion";
import { ErrorCascadaAgotada, ErrorIA, type ProveedorIA } from "@/lib/ia/tipos";
import { GET as criticoGET } from "@/app/api/landings/[id]/critico/route";
import { actualizarDoc, crearLanding, obtenerLanding } from "@/lib/landings";

// 20-A · proveedores simulados que fallan por cuota en cada etapa: la landing se entrega igual.

const DESC = "Landing para una noche de observación de la lluvia de meteoros Orionidas en Villa de Leyva";
const critica = (puntaje: number): Critica => ({ puntaje, porCriterio: [{ criterio: "Claridad en 3 s", puntaje: 9, evidencia: "secciones[0].ajustes.titular" }], problemas: [], correcciones: [] });

type Rol = string;

/** Responde según el rol del prompt; `falla(rol)` lanza un 429 de cuota para ese rol. */
function proveedor(id: "cerebras" | "gemini", tipo: TipoLanding, opc: { falla?: (rol: Rol) => boolean; roles?: Rol[]; puntaje?: number } = {}): ProveedorIA {
  return {
    id,
    disponible: () => true,
    soportaImagen: true,
    async generarJSON<T>(p: { sistema: string; usuario: string; esquema: ZodType<T>; imagen?: unknown }) {
      const s = p.sistema;
      let rol: Rol;
      if (p.imagen) rol = "validar";
      else if (s.includes("analista de encargos")) rol = "intake";
      else if (s.includes("estratega senior")) rol = "estrategia";
      else if (s.includes("arquitecto de landings")) rol = "plan";
      else if (s.includes("Escribes UNA sección")) rol = `seccion:${/Escribe el contenido de la sección «([a-z-]+)/.exec(s)![1]}`;
      else if (s.includes("director de arte")) rol = "imagenes";
      else if (s.includes("director creativo y especialista en CRO")) rol = "critico";
      else if (s.includes("editor de estilo")) rol = "estilo";
      else throw new Error(`Sin manejador: ${s.slice(0, 60)}`);
      opc.roles?.push(`${id}:${rol}`);
      if (opc.falla?.(rol)) throw new ErrorIA("limite", `${id}: límite o saturación (429): Daily token limit exceeded`);
      let datos: unknown;
      if (rol === "validar") datos = { apta: false, motivo: "No muestra lo esperado", confianza: 0.9 };
      else if (rol === "intake") {
        datos = { tipo, nombre: "Noche de observación de Orionidas", tematica: esEspacial(DESC) ? "espacio" : "general", publico: "Personas curiosas que quieren ver estrellas.", propuesta: "Una noche para ver la lluvia de meteoros sin complicaciones.", beneficios: ["Cielo oscuro", "Guía en vivo", "Información clara"], datosClave: [], faltantes: [], lugar: "Villa de Leyva" } as BriefGeneral;
      } else if (rol === "estrategia") datos = EJEMPLO_ESTRATEGIA;
      else if (rol === "plan") {
        const pl = planBlueprint(tipo, {}, detectarWidget(DESC) !== null && esEspacial(DESC));
        datos = { secciones: [...pl.obligatorias, ...pl.opcionales].map((t) => ({ tipo: t, variante: null, objetivoPsicologico: `Responder la pregunta de ${t}.`, notasCopy: "Usar el dato del brief.", datoAUsar: "Datos del brief." })) };
      } else if (rol.startsWith("seccion:")) datos = ejemploDeSeccion(rol.slice(8) as TipoSeccion);
      else if (rol === "imagenes") {
        const slots = [...p.usuario.matchAll(/^- ([a-z0-9-]+) \(/gm)].map((m) => m[1]);
        datos = { ficha: { paleta: "deep navy and teal", luz: "soft side light", lente: "50 mm lens", estilo: "clean editorial photo", fondo: "plain wall" }, slots: slots.map((slot) => ({ slot, prompt: `A clean editorial photo for ${slot} with deep navy and teal palette, soft side light, 50 mm lens, centered subject. No text.`, alt: `Descripción de la imagen del lugar ${slot} con luz suave y fondo liso` })) };
      } else if (rol === "critico") datos = critica(opc.puntaje ?? 9);
      else datos = { correcciones: [] };
      return { datos: p.esquema.parse(datos), proveedor: id, modelo: "sim", ms: 1 };
    },
  } as ProveedorIA;
}

const enr = (...ps: ProveedorIA[]) => ({ proveedores: ps, registrarUso: async () => {}, modo: "cascada" as const, config: {}, espera: async () => {} });
const fuentesSin = () => crearFuentes({ fetchFn: (async () => new Response("no", { status: 404 })) as typeof fetch, esperaReintentoMs: 0, env: {} });

async function correr(tipo: TipoLanding, ps: ProveedorIA[], extra: { conBase?: boolean } = {}) {
  const dirMedia = mkdtempSync(join(tmpdir(), "gen-"));
  mkdirSync(join(dirMedia, "bancos", "generadas"), { recursive: true });
  let n = 0;
  const eventos: EventoGenerar[] = [];
  const guardados: LandingDoc[] = [];
  const actualizados: LandingDoc[] = [];
  const checkpoint = almacenCheckpointMemoria();
  const r = await generarLanding({ descripcion: DESC, tipo }, (e) => eventos.push(e), {
    enrutador: enr(...ps),
    fuentes: fuentesSin(),
    ejecucion: { almacen: almacenMemoria() },
    dirMedia,
    candidatos: async () => [],
    generar: async () => {
      const ruta = `/media/bancos/generadas/g${++n}.webp`;
      await sharp({ create: { width: 200, height: 120, channels: 3, background: "#224466" } }).webp().toFile(join(dirMedia, ruta.replace(/^\/media\//, "")));
      return { ruta };
    },
    guardar: async (p) => {
      guardados.push(p.doc);
      if (extra.conBase) {
        const c = await crearLanding({ brief: p.brief, tecnicas: [], prompt: p.prompt, doc: p.doc, proveedor: p.proveedor });
        return { id: c.id, slug: c.slug };
      }
      return { id: "id-1", slug: p.doc.meta.slug };
    },
    actualizar: async (id, doc) => {
      actualizados.push(doc);
      if (extra.conBase) await actualizarDoc(id, doc);
    },
    checkpoint,
  });
  return { r, eventos, guardados, actualizados, checkpoint };
}

describe("20-A · el crítico falla por cuota: la landing se entrega sin nota", () => {
  it("todos los proveedores 429 en el crítico → guardada, criticoPendiente y checkpoint pendiente", async () => {
    const roles: string[] = [];
    const falla = (x: string) => x === "critico";
    const { r, guardados, actualizados, checkpoint } = await correr("evento", [proveedor("cerebras", "evento", { roles, falla }), proveedor("gemini", "evento", { roles, falla })]);
    expect(r.criticoPendiente).toBe(true);
    expect(r.puntaje).toBeNull();
    expect(r.doc.critica).toBeUndefined();
    expect(LandingDoc.safeParse(r.doc).success).toBe(true);
    expect(r.avisos.join(" ")).toMatch(/Crítico pendiente/);
    expect(r.avisos.join(" ")).toMatch(/El crítico no pudo evaluar: Todos los proveedores fallaron/);
    expect(guardados).toHaveLength(1); // se guardó ANTES del crítico
    expect(actualizados).toHaveLength(1); // y el final solo la actualiza
    expect(roles.filter((x) => x.endsWith(":critico")).length).toBeGreaterThanOrEqual(2); // probó con los dos proveedores
    expect(await checkpoint.leer("id-1")).toMatchObject({ etapa: "critico", criticoPendiente: true });
    expect((await checkpoint.leer("id-1"))?.briefTxt).toContain("Noche de observación de Orionidas");
  });

  it("no emite `error`: el flujo termina con la landing guardada", async () => {
    const { eventos, r } = await correr("evento", [proveedor("gemini", "evento", { falla: (x) => x === "critico" })]);
    expect(eventos.some((e) => e.tipo === "error")).toBe(false);
    expect(r.id).toBe("id-1");
  });

  it("si el crítico responde en la primera vuelta pero falla la segunda, conserva la nota que sí llegó", async () => {
    let llamadas = 0;
    const p = proveedor("gemini", "evento", { puntaje: 6 });
    const orig = p.generarJSON.bind(p) as (y: unknown) => Promise<unknown>;
    (p as { generarJSON: unknown }).generarJSON = async (x: { sistema: string }) => {
      if (x.sistema.includes("director creativo y especialista en CRO") && ++llamadas === 2) throw new ErrorIA("limite", "gemini: 429");
      return orig(x);
    };
    const { r } = await correr("evento", [p]);
    expect(r.criticoPendiente).toBe(false);
    expect(r.puntaje).toBe(6);
  });

  it("reintentar el crítico: sin cupo sigue pendiente; con cupo agrega la nota y limpia el pendiente", async () => {
    const { r, checkpoint } = await correr("evento", [proveedor("gemini", "evento", { falla: (x) => x === "critico" })], { conBase: true });
    expect(r.criticoPendiente).toBe(true);
    const antes = await obtenerLanding(r.id);
    expect(antes.criticoPendiente).toBe(true);
    expect(antes.puntaje).toBeNull();
    await expect(reintentarCritico(r.id, { enrutador: enr(proveedor("gemini", "evento", { falla: (x) => x === "critico" })), checkpoint })).rejects.toBeInstanceOf(ErrorCascadaAgotada);
    expect((await obtenerLanding(r.id)).criticoPendiente).toBe(true);
    expect((await checkpoint.leer(r.id))?.criticoPendiente).toBe(true);
    const ok = await reintentarCritico(r.id, { enrutador: enr(proveedor("cerebras", "evento", { puntaje: 8.4 })), checkpoint });
    expect(ok.puntaje).toBe(8.4);
    expect(ok.bajoUmbral).toBe(false);
    const despues = await obtenerLanding(r.id);
    expect(despues.criticoPendiente).toBe(false);
    expect(despues.puntaje).toBe(8.4);
    expect(despues.doc.critica?.puntaje).toBe(8.4);
    const cp = await checkpoint.leer(r.id);
    expect(cp?.criticoPendiente).toBe(false);
    expect(cp?.avisos.join(" ")).not.toMatch(/Crítico pendiente/);
  });
});

describe("20-A · API del checkpoint del crítico", () => {
  it("GET informa el pendiente de una landing sin nota y 404 si no existe", async () => {
    const { r } = await correr("evento", [proveedor("gemini", "evento", { falla: (x) => x === "critico" })], { conBase: true });
    const res = await criticoGET(new Request("http://x"), { params: Promise.resolve({ id: r.id }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ criticoPendiente: true, puntaje: null });
    const no = await criticoGET(new Request("http://x"), { params: Promise.resolve({ id: "no-existe" }) });
    expect(no.status).toBe(404);
  });
});

describe("20-A · falla la redacción de una sección", () => {
  it("el primer proveedor falla y el siguiente la redacta: sin [COMPLETAR]", async () => {
    const roles: string[] = [];
    const { r } = await correr("evento", [proveedor("cerebras", "evento", { roles, falla: (x) => x === "seccion:faq" }), proveedor("gemini", "evento", { roles })]);
    expect(r.seccionesPorCompletar).toEqual([]);
    expect(roles).toContain("cerebras:seccion:faq");
    expect(roles).toContain("gemini:seccion:faq");
    expect(JSON.stringify(r.doc)).not.toContain("[COMPLETAR] ");
  });

  it("ningún proveedor la redacta: queda con su ejemplo y [COMPLETAR], y la landing se entrega igual", async () => {
    const falla = (x: string) => x === "seccion:faq";
    const { r } = await correr("evento", [proveedor("cerebras", "evento", { falla }), proveedor("gemini", "evento", { falla })]);
    expect(r.seccionesPorCompletar).toEqual(["faq"]);
    expect(LandingDoc.safeParse(r.doc).success).toBe(true);
    const faq = r.doc.secciones.find((s) => s.tipo === "faq")!;
    expect(JSON.stringify(faq)).toContain("[COMPLETAR]");
    expect(faq.bloques.length).toBeGreaterThan(0);
    expect(r.avisos.join(" ")).toMatch(/Ningún proveedor pudo redactar «faq»/);
    expect(r.criticoPendiente).toBe(false); // lo demás sí funcionó
  });

  it("falla el héroe (se escribe primero): también queda con su ejemplo", async () => {
    const { r } = await correr("evento", [proveedor("gemini", "evento", { falla: (x) => x === "seccion:heroe" })]);
    expect(r.seccionesPorCompletar).toEqual(["heroe"]);
    expect(r.doc.secciones[0].tipo).toBe("heroe");
  });

  it("cuota agotada en todo después del plan (secciones, imágenes y crítico): entrega la landing con ejemplos, en los 8 tipos", async () => {
    const tras = (x: string) => x.startsWith("seccion:") || x === "imagenes" || x === "critico" || x === "validar" || x === "estilo";
    for (const tipo of TIPOS_LANDING) {
      const { r, guardados } = await correr(tipo, [proveedor("cerebras", tipo, { falla: tras }), proveedor("gemini", tipo, { falla: tras })]);
      expect(LandingDoc.safeParse(r.doc).success, tipo).toBe(true);
      expect(r.criticoPendiente, tipo).toBe(true);
      expect(r.seccionesPorCompletar.length, tipo).toBeGreaterThanOrEqual(BLUEPRINTS[tipo].obligatorias.length);
      expect(guardados, tipo).toHaveLength(1);
      expect(r.doc.secciones[0].tipo, tipo).toBe("heroe");
      // Con TODA la IA de texto caída, las imágenes salen igual (FLUX por prompts deterministas): ningún marcador en el héroe ni en la galería.
      const heroe = r.doc.secciones[0];
      if (typeof heroe.ajustes.slot === "string") expect(r.doc.assets.find((x) => x.slot === heroe.ajustes.slot)?.ruta, `${tipo}: héroe`).toBeTruthy();
      for (const g of r.doc.secciones.filter((x) => x.tipo === "galeria")) {
        for (const slot of [g.ajustes.slots, g.bloques.map((b) => b.ajustes.slot)].flat().filter((v): v is string => typeof v === "string")) expect(r.doc.assets.find((x) => x.slot === slot)?.ruta, `${tipo}: ${slot}`).toBeTruthy();
      }
    }
  });
});

describe("20-A · fallan las imágenes", () => {
  it("sin cupo para los prompts de imagen la landing se entrega con marcadores", async () => {
    const { r } = await correr("evento", [proveedor("gemini", "evento", { falla: (x) => x === "imagenes" })]);
    expect(LandingDoc.safeParse(r.doc).success).toBe(true);
    expect(r.criticoPendiente).toBe(false);
  });
});

describe("20-A · marcarCompletar", () => {
  it("reemplaza lo que parece dato (cifras) y marca títulos, sin tocar identificadores", () => {
    const m = marcarCompletar({ titular: "Reserva tu cupo", precio: "$89.900", slot: "heroe-imagen", icono: "luna", nota: "Sábado 12 de octubre" }) as Record<string, string>;
    expect(m.titular).toBe("[COMPLETAR] Reserva tu cupo");
    expect(m.precio).toBe("[COMPLETAR]");
    expect(m.slot).toBe("heroe-imagen");
    expect(m.icono).toBe("luna");
    expect(m.nota).toBe("[COMPLETAR]");
  });
});
