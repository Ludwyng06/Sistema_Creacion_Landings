import { createHash } from "node:crypto";
import type { CategoriaBrief } from "@/lib/contratos";
import type { DepsEnrutador } from "@/lib/ia/enrutador";
import { armarBorrador } from "./borrador";
import { normalizarNombre } from "./cifras";
import { extraerFragmentos } from "./fragmentos";
import { identificarProducto } from "./identificar";
import { precioReferencia } from "./precio";
import { resumirFragmentos, type ResumenIA } from "./resumen";
import { buscar, claveSerpApi, ErrorSerpApi, leerCuenta, regionSerpApi, type OpcionesSerpApi, type RespuestaBusqueda } from "./serpapi";
import type { Identificacion, RespuestaInvestigar } from "@/lib/contratos";

export const MAX_BUSQUEDAS = 3;
export const TTL_INVESTIGACION_MS = 7 * 24 * 60 * 60 * 1000;

/** Caché de búsquedas de SerpAPI (por consulta normalizada y región). Por defecto la tabla `Ajuste` (`serpapi:<hash>`). */
export interface AlmacenBusquedas {
  leer(clave: string): Promise<string | null>;
  escribir(clave: string, valor: string): Promise<void>;
}

export const almacenBusquedasAjuste: AlmacenBusquedas = {
  async leer(clave) {
    const { db } = await import("@/lib/db");
    return (await db.ajuste.findUnique({ where: { clave: `serpapi:${clave}` } }))?.valor ?? null;
  },
  async escribir(clave, valor) {
    const { db } = await import("@/lib/db");
    await db.ajuste.upsert({ where: { clave: `serpapi:${clave}` }, update: { valor }, create: { clave: `serpapi:${clave}`, valor } });
  },
};

export interface EntradaInvestigar {
  nombre: string;
  categoria?: CategoriaBrief;
  /** Foto ya preparada (JPEG en base64 para la IA, colores y ruta pública donde quedó guardada). */
  foto?: { jpegBase64: string; colores: string[]; ruta?: string };
}

export interface DepsInvestigar {
  serpapi?: OpcionesSerpApi;
  enrutador?: DepsEnrutador;
  cache?: AlmacenBusquedas;
  ahora?: () => number;
}

/** Sin clave de SerpAPI: la API responde 503 con un mensaje legible. */
export class ErrorSinClaveSerpApi extends Error {
  constructor() {
    super("La investigación es opcional. Agrega SERPAPI_API_KEY en app/.env.local para usarla.");
    this.name = "ErrorSinClaveSerpApi";
  }
}

/** 2 o 3 consultas (beneficios, problemas u objeciones, opiniones o preguntas) a partir del nombre y la categoría. */
export function armarConsultas(nombre: string, categoria?: string, sugeridas: string[] = []): string[] {
  const limpias = sugeridas.map((c) => c.replace(/\s+/g, " ").trim()).filter(Boolean);
  if (limpias.length >= 2) return limpias.slice(0, MAX_BUSQUEDAS);
  const n = nombre.replace(/\s+/g, " ").trim();
  const base = [`${n} beneficios para qué sirve`, `${n} problemas desventajas`, `${n} opiniones preguntas frecuentes`];
  const cat = categoria && categoria !== "otro" ? ` ${categoria.replace(/-/g, " ")}` : "";
  return [...new Set([...limpias, ...base.map((q, i) => (i === 0 ? q + cat : q))])].slice(0, MAX_BUSQUEDAS);
}

const claveBusqueda = (q: string, region: { gl: string; hl: string }) =>
  createHash("sha256").update(JSON.stringify([normalizarNombre(q), region.gl, region.hl])).digest("hex");

const RESUMEN_VACIO: ResumenIA = { beneficios: [], objeciones: [], preguntas: [], incluye: [] };

/**
 * Investiga el producto: identifica la foto (si hay), hace hasta 3 búsquedas (con caché de 7 días), resume con IA
 * y arma el borrador del brief. Lanza `ErrorSinClaveSerpApi` sin clave y `ErrorSerpApi` si ninguna búsqueda funcionó.
 */
export async function investigar(e: EntradaInvestigar, deps: DepsInvestigar = {}): Promise<RespuestaInvestigar> {
  const env = deps.serpapi?.env ?? process.env;
  if (!claveSerpApi(env)) throw new ErrorSinClaveSerpApi();
  const avisos: string[] = [];
  const region = regionSerpApi(env);
  const ahora = deps.ahora ?? Date.now;
  const almacen = deps.cache ?? (deps.serpapi?.fetchFn ? undefined : almacenBusquedasAjuste);

  let identificacion: Identificacion | null = null;
  if (e.foto) {
    try {
      identificacion = (await identificarProducto({ nombre: e.nombre, categoria: e.categoria, jpegBase64: e.foto.jpegBase64 }, deps.enrutador)).identificacion;
      if (!identificacion.reconocido) avisos.push("La foto no dejó reconocer el producto: se siguió solo con el nombre.");
    } catch (err) {
      avisos.push(`No se pudo mirar la foto (${err instanceof Error ? err.message : String(err)}): se siguió solo con el nombre.`);
    }
  }

  const consultas = armarConsultas(e.nombre, e.categoria ?? (identificacion?.reconocido ? identificacion.categoriaSugerida : undefined), identificacion?.consultas);
  const respuestas: RespuestaBusqueda[] = [];
  let usadas = 0;
  let ultimoError: ErrorSerpApi | undefined;
  for (const q of consultas) {
    const clave = claveBusqueda(q, region);
    if (almacen) {
      try {
        const crudo = await almacen.leer(clave);
        if (crudo) {
          const g = JSON.parse(crudo) as { t: number; r: RespuestaBusqueda };
          if (ahora() - g.t <= TTL_INVESTIGACION_MS) {
            respuestas.push(g.r);
            continue;
          }
        }
      } catch {
        // caché ilegible: se busca de nuevo
      }
    }
    try {
      const r = await buscar(q, deps.serpapi);
      usadas++;
      respuestas.push(r);
      if (almacen) await almacen.escribir(clave, JSON.stringify({ t: ahora(), r })).catch(() => undefined);
    } catch (err) {
      if (!(err instanceof ErrorSerpApi)) throw err;
      ultimoError = err;
      avisos.push(`Una búsqueda falló: ${err.message}`);
      if (err.tipo === "auth" || err.tipo === "cupo") break;
    }
  }
  if (respuestas.length === 0 && ultimoError) throw ultimoError;

  const fragmentos = extraerFragmentos(respuestas);
  let resumen = RESUMEN_VACIO;
  let sugerencias: RespuestaInvestigar["sugerencias"] = { beneficios: [], objeciones: [], preguntas: [] };
  if (fragmentos.length > 0) {
    const r = await resumirFragmentos(
      { nombre: e.nombre, categoria: e.categoria, rasgos: identificacion?.reconocido ? identificacion.rasgosVisibles : [], fragmentos },
      deps.enrutador,
    );
    resumen = r.resumen;
    sugerencias = r.sugerencias;
  } else {
    avisos.push("Las búsquedas no devolvieron resultados útiles.");
  }

  let cuota: RespuestaInvestigar["cuota"] = null;
  try {
    const c = await leerCuenta(deps.serpapi);
    cuota = { usadasMes: c.usadasMes, limiteMes: c.limiteMes };
  } catch {
    // la cuota es informativa: si no se pudo leer, sigue en null
  }

  return {
    sugerencias,
    consultas,
    usadas,
    cuota,
    borrador: armarBorrador({
      nombre: e.nombre,
      categoria: e.categoria,
      identificacion,
      resumen,
      sugerencias,
      fragmentos,
      colores: e.foto?.colores ?? [],
      fotoRuta: e.foto?.ruta,
    }),
    identificacion,
    precioReferencia: precioReferencia(fragmentos, region.gl),
    avisos,
  };
}
