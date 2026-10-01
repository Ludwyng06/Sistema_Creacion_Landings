import "../ayudas-db";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import type { ZodType } from "zod";
import { LandingDoc, TIPOS_LANDING, type Critica, type TipoLanding, type TipoSeccion } from "@/lib/contratos";
import { MAX_EFECTOS_NIVEL_3, CATALOGO_EFECTOS } from "@/lib/contratos/efectos";
import { almacenMemoria } from "@/lib/fuentes/cache";
import { crearFuentes } from "@/lib/fuentes/registro";
import { BLUEPRINTS, planBlueprint } from "@/lib/generar/blueprints";
import { DISTANCIA_MINIMA, HEROES_DE_UNA_IMAGEN, MARCO_EN_META, RECIENTES, decidir, distanciaHuellas, elegirDiversidad, huellaDeDoc, huellaDeDecisiones, type Huella } from "@/lib/generar/diversidad";
import { detectarWidget, esEspacial } from "@/lib/generar/fuentes";
import { generarLanding } from "@/lib/generar/pipeline";
import { EJEMPLO_ESTRATEGIA } from "@/lib/ia/prompts/estrategia";
import { ejemploDeSeccion } from "@/lib/ia/prompts/seccion";
import type { ProveedorIA } from "@/lib/ia/tipos";
import { mulberry32, PALETAS, TIPOGRAFIAS, ESTILOS, PERFILES_ESTILO, tirarSemilla } from "@/lib/tecnicas/semillas";
import { contraste } from "@/lib/tecnicas/semillas";
import { validarTodo } from "@/lib/validadores";
import { briefCompatible } from "@/lib/generar/pipeline";

// 24-A · motor de diversidad: cada landing distinta de las anteriores (proveedores simulados, azar inyectado).

const DESC = "Landing para vender una lámpara de luna";
const critica = (puntaje: number): Critica => ({ puntaje, porCriterio: [{ criterio: "Claridad en 3 s", puntaje: 9, evidencia: "secciones[0].ajustes.titular" }], problemas: [], correcciones: [] });

function proveedor(tipo: TipoLanding, vistos: { sistema: string; usuario: string; rol: string }[] = [], retardoMs = 0, marcas: { rol: string; t: number }[] = []): ProveedorIA {
  return {
    id: "gemini",
    disponible: () => true,
    soportaImagen: true,
    async generarJSON<T>(p: { sistema: string; usuario: string; esquema: ZodType<T>; imagen?: unknown }) {
      const s = p.sistema;
      let datos: unknown;
      let rol = "otro";
      if (retardoMs) await new Promise((r) => setTimeout(r, retardoMs));
      if (p.imagen) {
        rol = "validar";
        datos = { apta: false, motivo: "No muestra lo esperado", confianza: 0.9 };
      } else if (s.includes("analista de encargos")) {
        rol = "intake";
        datos = { tipo, nombre: "Lámpara de luna", tematica: esEspacial(DESC) ? "espacio" : "general", publico: "Quien decora su cuarto.", propuesta: "Una lámpara con la forma de la Luna en su fase real.", beneficios: ["Luz suave", "Forma de la Luna", "Se carga por USB"], datosClave: [], faltantes: [] };
      } else if (s.includes("estratega senior")) {
        rol = "estrategia";
        datos = EJEMPLO_ESTRATEGIA;
      } else if (s.includes("arquitecto de landings")) {
        rol = "plan";
        const pl = planBlueprint(tipo, {}, detectarWidget(DESC) !== null && esEspacial(DESC));
        datos = { secciones: [...pl.obligatorias, ...pl.opcionales].map((t) => ({ tipo: t, variante: null, objetivoPsicologico: `Responder la pregunta de ${t}.`, notasCopy: "Usar el dato del brief.", datoAUsar: "Datos del brief." })) };
      } else if (s.includes("Escribes UNA sección")) {
        const t = /Escribe el contenido de la sección «([a-z-]+)/.exec(s)![1] as TipoSeccion;
        rol = `seccion:${t}`;
        datos = ejemploDeSeccion(t);
      } else if (s.includes("director de arte")) {
        rol = "imagenes";
        const slots = [...p.usuario.matchAll(/^- ([a-z0-9-]+) \(/gm)].map((m) => m[1]);
        datos = { ficha: { paleta: "deep navy and teal", luz: "soft side light", lente: "50 mm lens", estilo: "clean editorial photo", fondo: "plain wall" }, slots: slots.map((slot) => ({ slot, prompt: `A clean editorial photo for ${slot} with deep navy and teal palette, soft side light, 50 mm lens, centered subject. No text.`, alt: `Descripción de la imagen del lugar ${slot} con luz suave y fondo liso` })) };
      } else if (s.includes("director creativo y especialista en CRO")) {
        rol = "critico";
        datos = critica(9);
      } else if (s.includes("editor de estilo")) datos = { correcciones: [] };
      else throw new Error(`Sin manejador: ${s.slice(0, 60)}`);
      vistos.push({ sistema: p.sistema, usuario: p.usuario, rol });
      marcas.push({ rol, t: Date.now() });
      return { datos: p.esquema.parse(datos), proveedor: "gemini" as const, modelo: "sim", ms: 1 };
    },
  } as ProveedorIA;
}

const fuentesSin = () => crearFuentes({ fetchFn: (async () => new Response("no", { status: 404 })) as typeof fetch, esperaReintentoMs: 0, env: {} });

async function generar(tipo: TipoLanding, historial: LandingDoc[], azar: () => number, extra: { vistos?: { sistema: string; usuario: string; rol: string }[]; cache?: boolean; retardoMs?: number; marcas?: { rol: string; t: number }[]; generarOpenAI?: (p: string, r: string) => Promise<{ ruta: string; modelo: string }> } = {}) {
  const dirMedia = mkdtempSync(join(tmpdir(), "div-"));
  mkdirSync(join(dirMedia, "bancos", "generadas"), { recursive: true });
  let n = 0;
  const memoria = new Map<string, string>();
  return generarLanding({ descripcion: DESC, tipo }, () => {}, {
    enrutador: { proveedores: [proveedor(tipo, extra.vistos, extra.retardoMs, extra.marcas)], registrarUso: async () => {}, modo: "cascada", config: {}, espera: async () => {}, ...(extra.cache ? { cache: { leer: async (h: string) => memoria.get(h) ?? null, escribir: async (h: string, v: string) => void memoria.set(h, v) } } : {}) },
    fuentes: fuentesSin(),
    ejecucion: { almacen: almacenMemoria() },
    dirMedia,
    candidatos: async () => [],
    generar: async () => {
      const ruta = `/media/bancos/generadas/g${++n}.webp`;
      await sharp({ create: { width: 200, height: 120, channels: 3, background: "#224466" } }).webp().toFile(join(dirMedia, ruta.replace(/^\/media\//, "")));
      return { ruta };
    },
    guardar: async (p) => ({ id: "x", slug: p.doc.meta.slug }),
    ...(extra.generarOpenAI ? { generarOpenAI: extra.generarOpenAI as never } : {}),
    historial: async () => historial,
    azar,
  });
}

describe("24-A · tokens que varían con el estilo", () => {
  it("cada estilo tiene su perfil y los tokens salen de él (brutalismo → radio 0 y borde grueso; ma → aireado sin borde; Memphis → radio 999 o 16)", () => {
    expect(Object.keys(PERFILES_ESTILO).sort()).toEqual([...ESTILOS].sort());
    for (let n = 0; n < 300; n++) {
      const { semilla, tokens } = tirarSemilla(n, 2);
      const perfil = PERFILES_ESTILO[semilla.estilo as (typeof ESTILOS)[number]];
      expect(perfil.radios, semilla.estilo).toContain(tokens.radio);
      expect(perfil.bordes).toContain(tokens.borde);
      expect(perfil.espaciados).toContain(tokens.espaciado);
      expect(perfil.imagenes).toContain(tokens.imagen);
      expect(perfil.escalas).toContain(tokens.tipografia.escala);
      if (semilla.estilo === "brutalismo tipográfico") expect(tokens).toMatchObject({ radio: 0, borde: "grueso" });
      if (semilla.estilo === "japonés ma (espacio negativo)") expect(tokens).toMatchObject({ espaciado: "aireado", borde: "ninguno" });
    }
  });

  it("sin número fijo la semilla es otra cada vez y el número queda para reproducirla", () => {
    const a = tirarSemilla(undefined, 3, mulberry32(1));
    const b = tirarSemilla(undefined, 3, mulberry32(2));
    expect(a.semilla.numero).not.toBe(b.semilla.numero);
    expect(tirarSemilla(a.semilla.numero, 3)).toEqual(a);
  });
});

describe("24-A · decisiones y huella", () => {
  const base = { tipo: "producto" as TipoLanding, ...(() => {
    const pl = planBlueprint("producto", {}, false);
    return { obligatorias: pl.obligatorias, opcionales: pl.opcionales, delSistema: pl.delSistema };
  })(), historial: [] as Huella[], heroesRecientes: [] as string[] };

  it("el mismo número da las mismas decisiones (reproducible) y otro número, otras", () => {
    expect(decidir({ ...base, numero: 123 })).toEqual(decidir({ ...base, numero: 123 }));
    expect(huellaDeDecisiones(decidir({ ...base, numero: 123 }))).not.toEqual(huellaDeDecisiones(decidir({ ...base, numero: 124 })));
  });

  it("el héroe es siempre uno de una sola imagen del catálogo (nunca el partido) y la intensidad va de 2 a 3 según el tipo", () => {
    const intens: Record<string, Set<number>> = {};
    for (const tipo of TIPOS_LANDING) {
      const pl = planBlueprint(tipo, {}, false);
      for (let n = 0; n < 60; n++) {
        const d = decidir({ tipo, numero: n * 7919, ...pl, historial: [], heroesRecientes: [] });
        expect(HEROES_DE_UNA_IMAGEN as readonly string[]).toContain(d.heroe);
        expect(d.orden[0]).toBe("heroe");
        expect([2, 3]).toContain(d.tokens.intensidad);
        (intens[tipo] ??= new Set()).add(d.tokens.intensidad);
        // efectos del catálogo, compatibles, de nivel ≤ intensidad y como mucho 2 de nivel 3 por landing
        let n3 = 0;
        for (const [t, es] of Object.entries(d.efectos)) for (const e of es) {
          const def = CATALOGO_EFECTOS[e];
          expect(def.nivel).toBeLessThanOrEqual(d.tokens.intensidad);
          if (def.nivel === 3) n3++;
          expect(def.secciones.includes("global") || (def.secciones as string[]).includes(t), `${e} en ${t}`).toBe(true);
        }
        expect(n3).toBeLessThanOrEqual(MAX_EFECTOS_NIVEL_3);
      }
    }
    expect([...intens.producto]).toContain(3);
    expect([...intens.divulgacion]).toContain(2);
  });

  it("el orden cambia entre tiradas pero el héroe va primero y el formulario al final de lo que escribe la IA", () => {
    const ordenes = new Set<string>();
    for (let n = 0; n < 80; n++) {
      const d = decidir({ ...base, numero: n * 104729 });
      ordenes.add(d.orden.join(">"));
      expect(d.orden[0]).toBe("heroe");
      expect(d.orden.at(-1)).toBe("formulario-lead");
      expect(new Set(d.orden).size).toBe(d.orden.length);
    }
    expect(ordenes.size).toBeGreaterThan(5);
  });

  it("anti-repetición: sin repetir paleta, tipografía ni héroe de las últimas 4 y a ≥ 0,5 de las últimas 12", () => {
    const azar = mulberry32(2024);
    const historial: Huella[] = [];
    for (let i = 0; i < 30; i++) {
      const r = elegirDiversidad({ ...base, historial }, azar);
      expect(r.agotado, `tirada ${i}`).toBe(false);
      for (const h of historial.slice(0, RECIENTES)) {
        expect(h.paleta).not.toBe(r.huella.paleta);
        expect(h.tipografia).not.toBe(r.huella.tipografia);
        expect(h.heroe).not.toBe(r.huella.heroe);
      }
      for (const h of historial.slice(0, 12)) expect(distanciaHuellas(r.huella, h)).toBeGreaterThanOrEqual(DISTANCIA_MINIMA);
      historial.unshift(r.huella);
    }
  });

  it("la distancia es 0 entre iguales; si 20 tiradas no bastan, la reparación deja paleta y tipografía distintas de las últimas 4", () => {
    const h = huellaDeDecisiones(decidir({ ...base, numero: 5 }));
    expect(distanciaHuellas(h, h)).toBe(0);
    // Historial adversarial: las 4 más recientes ocupan casi todas las paletas y tipografías que el azar constante va a pedir.
    const numero = Math.floor(0.5 * 1_000_000);
    const igual = huellaDeDecisiones(decidir({ ...base, numero }));
    const r = elegirDiversidad({ ...base, historial: [igual, { ...igual, heroe: "x" }, { ...igual, heroe: "y" }, { ...igual, heroe: "z" }] }, () => 0.5, 20);
    expect(r.intentos).toBe(20);
    for (const rec of [igual]) {
      expect(r.huella.paleta).not.toBe(rec.paleta);
      expect(r.huella.tipografia).not.toBe(rec.tipografia);
    }
  });
});

describe("24-A · 8 generaciones del mismo encargo", () => {
  it("dan 8 huellas distintas entre sí (≥ 0,5), sin repetir paleta, tipografía ni héroe en 4 seguidas, y con validadores sin rojo", async () => {
    const azar = mulberry32(7);
    const docs: LandingDoc[] = [];
    const resultados: { huella: Huella; distanciaMinima: number; agotado: boolean }[] = [];
    for (let i = 0; i < 8; i++) {
      const r = await generar("producto", docs, azar);
      expect(LandingDoc.safeParse(r.doc).success).toBe(true);
      expect(r.diversidad.agotado).toBe(false);
      docs.unshift(r.doc);
      resultados.push({ huella: huellaDeDoc(r.doc), distanciaMinima: r.diversidad.distanciaMinima, agotado: r.diversidad.agotado });
      // validadores en verde: héroe nunca partido, máximo 3 efectos de nivel 3, contraste y estructura
      const { salud } = validarTodo(r.doc, briefCompatible(r.brief));
      expect(salud.filter((s) => s.estado === "rojo").map((s) => `${s.id}: ${s.problemas.map((p) => p.mensaje).join(" | ")}`), `landing ${i}`).toEqual([]);
      const n3 = r.doc.secciones.flatMap((s) => s.efectos ?? []).filter((e) => CATALOGO_EFECTOS[e].nivel === 3).length;
      expect(n3).toBeLessThanOrEqual(MAX_EFECTOS_NIVEL_3);
      expect(contraste(r.doc.tokens.colores.texto, r.doc.tokens.colores.fondo)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(r.doc.tokens.colores.acentoTexto, r.doc.tokens.colores.acento)).toBeGreaterThanOrEqual(4.5);
      expect(r.doc.secciones[0].variante).toBeTruthy();
      expect(r.doc.meta.marco).toBe(MARCO_EN_META[(Object.keys(MARCO_EN_META) as (keyof typeof MARCO_EN_META)[]).find((m) => MARCO_EN_META[m] === r.doc.meta.marco)!]);
    }
    const hs = resultados.map((x) => x.huella);
    const dists: number[] = [];
    for (let i = 0; i < hs.length; i++) for (let j = i + 1; j < hs.length; j++) dists.push(distanciaHuellas(hs[i], hs[j]));
    expect(Math.min(...dists)).toBeGreaterThanOrEqual(DISTANCIA_MINIMA);
    for (let i = 0; i + RECIENTES <= hs.length; i++) {
      const ventana = hs.slice(i, i + RECIENTES);
      expect(new Set(ventana.map((h) => h.paleta)).size).toBe(RECIENTES);
      expect(new Set(ventana.map((h) => h.tipografia)).size).toBe(RECIENTES);
      expect(new Set(ventana.map((h) => h.heroe)).size).toBe(RECIENTES);
    }
    expect(PALETAS.length).toBeGreaterThan(RECIENTES);
    expect(TIPOGRAFIAS.length).toBeGreaterThan(RECIENTES);
  });

  it("el número de semilla queda en meta.semilla.numero y reproduce los mismos tokens", async () => {
    const r = await generar("producto", [], mulberry32(99));
    const { tokens } = tirarSemilla(r.doc.meta.semilla.numero, r.doc.tokens.intensidad);
    expect(r.doc.tokens.radio).toBe(tokens.radio);
    expect(r.doc.tokens.borde).toBe(tokens.borde);
    expect(r.doc.tokens.imagen).toBe(tokens.imagen);
    expect(r.doc.meta.nivelConciencia).toBe(EJEMPLO_ESTRATEGIA.nivelConciencia); // sale de la estrategia, no es constante
  });

  it("la estrategia recibe lo de las últimas landings para evitarlo y un marco sugerido", async () => {
    const previa = await generar("producto", [], mulberry32(3));
    const vistos: { sistema: string; usuario: string; rol: string }[] = [];
    await generar("producto", [previa.doc], mulberry32(4), { vistos });
    const est = vistos.find((v) => v.rol === "estrategia")!;
    expect(est.usuario).toContain("evita estos ángulos, titulares y estructuras");
    expect(est.usuario).toMatch(/Marco de copy sugerido para esta landing: (PAS|AIDA|BAB|4P|StoryBrand)/);
    expect(est.usuario).toContain(previa.doc.meta.nombre);
  });

  it("la caché no devuelve la redacción de una landing a otra: con la misma caché el prompt de estrategia cambia con la semilla", async () => {
    const v1: { sistema: string; usuario: string; rol: string }[] = [];
    const v2: { sistema: string; usuario: string; rol: string }[] = [];
    await generar("producto", [], mulberry32(11), { vistos: v1, cache: true });
    await generar("producto", [], mulberry32(12), { vistos: v2, cache: true });
    const hash = (x: { usuario: string }[]) => x.map((y) => y.usuario).join("\n#");
    expect(v2.some((v) => v.rol === "estrategia")).toBe(true); // no salió de la caché del primero
    expect(v1.find((v) => v.rol === "estrategia")!.usuario).not.toBe(v2.find((v) => v.rol === "estrategia")!.usuario);
    expect(hash(v1)).not.toBe(hash(v2));
  });

  it("los ocho tipos de landing generan con la diversidad activa y el héroe elegido es del catálogo", async () => {
    for (const tipo of TIPOS_LANDING) {
      const r = await generar(tipo, [], mulberry32(5));
      expect(LandingDoc.safeParse(r.doc).success, tipo).toBe(true);
      expect(r.doc.secciones[0].tipo).toBe("heroe");
      expect(BLUEPRINTS[tipo]).toBeTruthy();
    }
  });
});

describe("24-A · grafo: imágenes y redacción corren a la vez", () => {
  it("con proveedores de 250 ms por llamada el total es menor que la suma en serie y las imágenes arrancan antes de que termine la redacción", async () => {
    const RETARDO = 250;
    const marcas: { rol: string; t: number }[] = [];
    const generaciones: number[] = [];
    const t0 = Date.now();
    const r = await generar("producto", [], mulberry32(21), {
      retardoMs: RETARDO,
      marcas,
      generarOpenAI: async () => {
        generaciones.push(Date.now());
        await new Promise((x) => setTimeout(x, RETARDO));
        return { ruta: `/media/bancos/generadas/oa-${generaciones.length}.webp`, modelo: "gpt-image-2" };
      },
    });
    const total = Date.now() - t0;
    const llamadasTexto = marcas.length;
    const serie = (llamadasTexto + generaciones.length) * RETARDO; // suma de todo lo que habría tardado en serie
    expect(r.criticoPendiente).toBe(false);
    expect(generaciones.length).toBeGreaterThan(0);
    expect(total).toBeLessThan(serie * 0.6);
    // las generaciones de imagen empezaron antes de que terminara la última redacción de sección
    const ultimaSeccion = Math.max(...marcas.filter((m) => m.rol.startsWith("seccion:")).map((m) => m.t));
    expect(Math.min(...generaciones)).toBeLessThan(ultimaSeccion);
    // y antes de que terminara la estrategia
    expect(Math.min(...generaciones)).toBeLessThanOrEqual(marcas.find((m) => m.rol === "estrategia")!.t + 20);
    expect(r.tiempos.total).toBeGreaterThan(0);
    expect(r.tiempos).toHaveProperty("redaccion");
    expect(r.tiempos).toHaveProperty("imagenes");
  });
});
