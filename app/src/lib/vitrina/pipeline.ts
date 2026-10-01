import { z } from "zod";
import { VARIANTES_HEROE, type Asset, type Brief, type Critica, type DatoCurioso, type LandingDoc, type MedioBanco, type PromptEstructurado, type ResultadoValidador, type Seccion, type TipoSeccion } from "@/lib/contratos";
import { ejecutar, type DepsEnrutador, type PeticionIA } from "@/lib/ia/enrutador";
import { aplicarCambios, corregirListaNegra, infraccionesCorregibles } from "@/lib/ia/corregir";
import { CriticaDelModelo, promptCritico } from "@/lib/ia/prompts/critico";
import { textoBrief, textoEstrategia, textoInvestigacion, textoSemilla, type PaqueteInvestigacion } from "@/lib/ia/prompts/contexto";
import { Estrategia, promptEstrategia } from "@/lib/ia/prompts/estrategia";
import { PlanSecciones, promptPlan, type SeccionPlanificada } from "@/lib/ia/prompts/plan";
import { promptSeccion } from "@/lib/ia/prompts/seccion";
import { resumirParaCritico } from "@/lib/ia/resumen-critico";
import { ErrorCascadaAgotada, type ResultadoIA } from "@/lib/ia/tipos";
import { tirarSemilla, tokensParaBrief } from "@/lib/tecnicas/semillas";
import { validarTodo } from "@/lib/validadores";
import { ESQUEMAS_SECCION } from "@/secciones/esquemas";
import { validarEstructura } from "@/lib/validadores/estructura";
import type { OpcionesFlux } from "@/lib/imagenes/flux";
import type { OpcionesEjecucion } from "@/lib/fuentes/ejecutar";
import type { Fuentes } from "@/lib/fuentes/registro";
import { escribirPromptsDeImagen, resolverImagenes, slotsDeVitrina, type ResultadoImagenes } from "./imagenes";
import { investigarEntrada } from "./investigar";
import { agregarSeccionesDelSistema, HEROE_ESPACIAL, tiposDelSistema } from "./plan";
import type { EntradaVitrina, InvestigacionVitrina } from "./tipos";
import { publicarEnVitrina } from "./medios";

// Pipeline por etapas de la vitrina (docs/bitacora/tarea-15-A.md): investigación → estrategia → plan de secciones → redacción
// por sección (una llamada por sección, máximo 3 a la vez) → imágenes → crítico desacoplado → corrección dirigida de las secciones flojas.

export const UMBRAL_VITRINA = 9.5;
export const MAX_INTENTOS = 4;
export const MAX_VUELTAS = 3;
export const SIMULTANEAS = 3;
const MAX_SECCIONES_POR_VUELTA = 4;
const MAX_SECCIONES = 16;

export interface DepsPipeline {
  enrutador?: DepsEnrutador;
  fuentes?: Fuentes;
  ejecucion?: OpcionesEjecucion;
  dirMedia: string;
  flux?: Partial<OpcionesFlux>;
  medios?: (banco: string) => Promise<MedioBanco[]>;
  curiosos?: DatoCurioso[];
  frasesUsadas?: Set<string>;
  log?: (linea: string) => void;
  ahora?: () => Date;
  umbral?: number;
  /** Rutas de imágenes de la vitrina que alguna landing usa: no se borran. */
  protegidas?: ReadonlySet<string>;
  /** Pausa entre reintentos cuando se agota la cuota de la IA (por defecto 2 min). */
  esperaCuotaMs?: number;
  /** Cuántas pausas por cuota se aceptan en un intento antes de rendirse (por defecto 3). */
  maxPausas?: number;
  maxIntentos?: number;
  maxVueltas?: number;
  validar?: (ruta: string, esperado: string) => Promise<{ apta: boolean; motivo: string }>;
  generar?: (prompt: string, relacion: import("@/lib/imagenes/flux").Relacion) => Promise<{ ruta: string }>;
}

export interface NotaVuelta {
  intento: number;
  vuelta: number;
  puntaje: number;
  criterios: { criterio: string; puntaje: number }[];
  angulo: string;
}

export interface ResultadoPipeline {
  doc: LandingDoc;
  brief: Brief;
  prompt: PromptEstructurado;
  estrategia: Estrategia;
  investigacion: InvestigacionVitrina;
  imagenes: ResultadoImagenes;
  salud: ResultadoValidador[];
  notas: NotaVuelta[];
  intentos: number;
  avisos: string[];
  proveedores: string[];
}

// ---------- Utilidades ----------

/** Corre `tareas` con como máximo `n` a la vez y devuelve los resultados en el mismo orden. */
export async function conLimite<T>(n: number, tareas: (() => Promise<T>)[]): Promise<PromiseSettledResult<T>[]> {
  const salida: PromiseSettledResult<T>[] = new Array(tareas.length);
  let siguiente = 0;
  const obrero = async () => {
    for (;;) {
      const i = siguiente++;
      if (i >= tareas.length) return;
      try {
        salida[i] = { status: "fulfilled", value: await tareas[i]() };
      } catch (reason) {
        salida[i] = { status: "rejected", reason };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, tareas.length) }, obrero));
  return salida;
}

const mensaje = (e: unknown) => {
  if (e instanceof ErrorCascadaAgotada) return `cascada agotada: ${e.intentos.map((i) => `${i.proveedor} ${i.tipo}: ${i.mensaje.slice(0, 70)}`).join(" | ")}`;
  return e instanceof Error ? e.message.split("\n")[0] : String(e);
};

/** El esquema de una sección tolera que el modelo omita los `id` de los bloques y `bloques` en secciones sin ellos. */
export function esquemaDeRedaccion(tipo: TipoSeccion): z.ZodType<{ ajustes: Record<string, unknown>; bloques: { id: string; tipo: string; ajustes: Record<string, unknown> }[] }> {
  const base = (ESQUEMAS_SECCION as Record<string, z.ZodType>)[tipo];
  return z.preprocess((v) => {
    const o = (v && typeof v === "object" ? v : {}) as { ajustes?: unknown; bloques?: unknown };
    const bloques = Array.isArray(o.bloques) ? o.bloques : [];
    return { ajustes: o.ajustes ?? {}, bloques: bloques.map((b: { id?: unknown }, i) => ({ ...b, id: typeof b?.id === "string" && b.id ? b.id : `${tipo}-${i + 1}` })) };
  }, base) as never;
}

// ---------- Etapas ----------

export function tiposObligatorios(e: EntradaVitrina): TipoSeccion[] {
  const base: TipoSeccion[] = ["cinta-anuncio", "heroe", "problema-solucion", "beneficios", "galeria", "incluye", "oferta", "garantia", "faq", "formulario-lead"];
  if (e.tematica === "producto") base.splice(4, 0, "como-funciona");
  return base;
}

export function tiposOpcionales(e: EntradaVitrina): TipoSeccion[] {
  const libres = MAX_SECCIONES - tiposDelSistema(e).length - tiposObligatorios(e).length;
  const candidatos: TipoSeccion[] = e.tematica === "espacio" ? ["como-funciona", "comparativa"] : ["comparativa"];
  return libres > 0 ? candidatos.slice(0, libres) : [];
}

const HEROES_DE_PRODUCTO = ["producto-monumental", "titular-tipografico", "orbita-beneficios"];

/** Deja el plan con todas las obligatorias, en su orden, sin tipos desconocidos ni repetidos. */
export function normalizarPlan(plan: PlanSecciones, e: EntradaVitrina): SeccionPlanificada[] {
  const oblig = tiposObligatorios(e);
  const opc = new Set<string>(tiposOpcionales(e));
  const orden = [...oblig, ...tiposOpcionales(e)];
  const porTipo = new Map<string, SeccionPlanificada>();
  for (const s of plan.secciones) if ((oblig as string[]).includes(s.tipo) || opc.has(s.tipo)) if (!porTipo.has(s.tipo)) porTipo.set(s.tipo, s);
  const salida: SeccionPlanificada[] = [];
  for (const tipo of orden) {
    const s = porTipo.get(tipo);
    if (s) salida.push(s);
    else if ((oblig as string[]).includes(tipo)) {
      salida.push({ tipo, variante: null, objetivoPsicologico: `Cumplir el papel de «${tipo}» en el camino de compra.`, notasCopy: "Usa los datos del brief y la estrategia; responde la duda que esta sección debe matar.", datoAUsar: "Datos del brief y de la investigación con fuente." });
    }
  }
  return salida;
}

/** Contexto común de las llamadas de una corrida. */
interface Corrida {
  e: EntradaVitrina;
  brief: Brief;
  paquete: PaqueteInvestigacion;
  briefTxt: string;
  invTxt: string;
  semillaTxt: string;
  tokens: ReturnType<typeof tokensParaBrief>;
  semilla: ReturnType<typeof tirarSemilla>["semilla"];
}

async function llamar<T>(d: DepsPipeline, p: PeticionIA<T>): Promise<ResultadoIA<T>> {
  return ejecutar(p, d.enrutador);
}

async function etapaEstrategia(c: Corrida, d: DepsPipeline, angulo?: string): Promise<{ estrategia: Estrategia; proveedor: string; prompt: { sistema: string; usuario: string } }> {
  const p = promptEstrategia({ contextoBrief: c.briefTxt, contextoInvestigacion: c.invTxt, contextoSemilla: c.semillaTxt, anguloForzado: angulo });
  const r = await llamar(d, { tarea: "estrategia", sistema: p.sistema, usuario: p.usuario, esquema: Estrategia, maxTokens: 3500, temperatura: 0.4 });
  return { estrategia: r.datos, proveedor: r.proveedor, prompt: p };
}

async function etapaPlan(c: Corrida, d: DepsPipeline, estrategia: Estrategia): Promise<SeccionPlanificada[]> {
  const p = promptPlan({ contextoBrief: c.briefTxt, contextoEstrategia: textoEstrategia(estrategia), contextoInvestigacion: c.invTxt, obligatorias: tiposObligatorios(c.e), opcionales: tiposOpcionales(c.e), delSistema: tiposDelSistema(c.e), variantesHeroe: VARIANTES_HEROE, espacial: c.e.tematica === "espacio" });
  const r = await llamar(d, { tarea: "plan-secciones", sistema: p.sistema, usuario: p.usuario, esquema: PlanSecciones, maxTokens: 3000, temperatura: 0.3 });
  return normalizarPlan(r.datos, c.e);
}

/** Slots que usa cada tipo de sección: nombres que fija el sistema. */
function slotsDeSeccion(tipo: string, e: EntradaVitrina): { slot: string; que: string }[] {
  const todos = slotsDeVitrina(e);
  const de = (prefijo: string) => todos.filter((s) => s.slot.startsWith(prefijo)).map((s) => ({ slot: s.slot, que: s.que }));
  if (tipo === "heroe") return [...de("heroe")];
  if (tipo === "galeria") return de("galeria");
  if (tipo === "problema-solucion") return de("problema");
  if (tipo === "incluye") return de("incluye");
  return [];
}

async function redactarUna(c: Corrida, d: DepsPipeline, estrategiaTxt: string, plan: SeccionPlanificada, indice: number, previos: string[], correccion?: string): Promise<{ seccion: Seccion; proveedor: string }> {
  const tipo = plan.tipo as TipoSeccion;
  const slots = slotsDeSeccion(tipo, c.e);
  const entrada = { tipo, plan, contextoBrief: c.briefTxt, contextoEstrategia: estrategiaTxt, contextoInvestigacion: c.invTxt, titularesPrevios: previos, slots, correccion };
  const completo = promptSeccion(entrada);
  const compacto = promptSeccion({ ...entrada, compacto: true });
  // Repartidas entre Gemini y Groq: las de índice impar prueban primero con Groq (entrada compacta por su cupo por minuto).
  const alterna = indice % 2 === 1;
  const r = await llamar(d, {
    tarea: "redactar-seccion",
    sistema: completo.sistema,
    usuario: completo.usuario,
    esquema: esquemaDeRedaccion(tipo),
    maxTokens: 2500,
    temperatura: 0.5,
    evitar: alterna ? "gemini" : undefined,
    compacta: { sistema: compacto.sistema, usuario: compacto.usuario, maxTokens: 1800 },
    ...(correccion ? { sinCache: true } : {}),
  });
  const datos = r.datos;
  const seccion: Seccion = {
    id: tipo,
    tipo,
    ...(tipo === "heroe" ? { variante: plan.variante && (VARIANTES_HEROE as readonly string[]).includes(plan.variante) ? plan.variante : undefined } : {}),
    visible: true,
    intencion: { objetivo: plan.objetivoPsicologico },
    ajustes: datos.ajustes,
    bloques: datos.bloques.map((b) => ({ id: b.id, tipo: b.tipo, ajustes: b.ajustes })),
    animacion: { entrada: "subir", retraso: 0 },
  };
  return { seccion, proveedor: r.proveedor };
}

// ---------- Ensamblaje determinista ----------

const EFECTOS: Partial<Record<TipoSeccion, Seccion["efectos"]>> = {
  "cinta-anuncio": ["marquee-reactivo"],
  // Un momento memorable de nivel 3 por tercio de la página (máximo 3 por landing): héroe, beneficios y galería.
  heroe: ["boton-magnetico", "shader-ondas"],
  beneficios: ["pin-coreografia"],
  galeria: ["horizontal"],
  oferta: ["precio-cae"],
};

/** Lo que el sistema fija con datos reales, sin dejarlo a la IA: precio, garantía, slots de imagen, variante y efectos. */
export function fijarSecciones(secciones: Seccion[], e: EntradaVitrina, brief: Brief, plan: SeccionPlanificada[]): Seccion[] {
  const espacial = e.tematica === "espacio";
  return secciones.map((s) => {
    const efectos = EFECTOS[s.tipo];
    const base: Seccion = { ...s, ...(efectos ? { efectos } : {}) };
    switch (s.tipo) {
      case "heroe": {
        const pedida = plan.find((p) => p.tipo === "heroe")?.variante ?? undefined;
        const variante = espacial ? "producto-monumental" : pedida && HEROES_DE_PRODUCTO.includes(pedida) ? pedida : "producto-monumental";
        const { slots: _slots, ...ajustes } = base.ajustes as Record<string, unknown>;
        void _slots;
        return { ...base, variante, ajustes: { ...ajustes, slot: "heroe-producto", ...(espacial ? { slots: ["heroe-fondo"] } : {}) } };
      }
      case "problema-solucion":
        return { ...base, ajustes: { ...base.ajustes, imagen: "problema" } };
      case "incluye":
        return { ...base, ajustes: { ...base.ajustes, imagen: "incluye-empaque" } };
      case "galeria":
        return { ...base, bloques: base.bloques.slice(0, 4).map((b, i) => ({ ...b, ajustes: { ...b.ajustes, slot: `galeria-${i + 1}` } })) };
      case "oferta":
        return {
          ...base,
          ajustes: { ...base.ajustes, precio: brief.precio.valor, moneda: brief.precio.moneda, ...(brief.precio.anterior ? { precioAnterior: brief.precio.anterior } : { precioAnterior: undefined }) },
          bloques: [{ id: "opc-1", tipo: "opcion-cantidad", ajustes: { unidades: 1, precio: brief.precio.valor } }],
        };
      case "garantia":
        return brief.garantia ? { ...base, ajustes: { ...base.ajustes, dias: brief.garantia.dias } } : base;
      default:
        return base;
    }
  });
}

// ---------- Crítico y corrección dirigida ----------

async function etapaCritico(c: Corrida, d: DepsPipeline, doc: LandingDoc): Promise<{ critica: Critica; proveedor: string }> {
  const p = promptCritico({ documento: resumirParaCritico(doc), contextoBrief: c.briefTxt });
  const compacto = promptCritico({ documento: resumirParaCritico(doc), contextoBrief: c.briefTxt, compacto: true });
  const r = await llamar(d, { tarea: "critico", sistema: p.sistema, usuario: p.usuario, esquema: CriticaDelModelo, maxTokens: 3000, temperatura: 0, rapido: true, plazoMs: 420_000, sinCache: true, compacta: { sistema: compacto.sistema, usuario: compacto.usuario, maxTokens: 2200 } });
  return { critica: r.datos, proveedor: r.proveedor };
}

/** Índices de sección que el crítico señala, con las instrucciones que les tocan. Solo criterios bajo 9 y hallazgos con ruta. */
export function seccionesADeCorregir(critica: Critica, doc: LandingDoc, escritas: Set<string>): Map<number, string[]> {
  const mapa = new Map<number, string[]>();
  const anota = (texto: string, extra?: string) => {
    for (const m of texto.matchAll(/secciones\[(\d+)\]/g)) {
      const i = Number(m[1]);
      const s = doc.secciones[i];
      if (!s || !escritas.has(s.tipo)) continue;
      mapa.set(i, [...(mapa.get(i) ?? []), extra ? `${extra}: ${texto}` : texto]);
    }
  };
  for (const x of critica.porCriterio) if (x.puntaje < 9) anota(x.evidencia, `Criterio «${x.criterio}» con ${x.puntaje}`);
  for (const t of [...critica.problemas, ...critica.correcciones]) anota(t);
  return mapa;
}

function textoCorreccion(critica: Critica, lineas: string[]): string {
  return `El auditor puntuó la landing con ${critica.puntaje.toFixed(1)} de 10. Para esta sección pidió:\n${[...new Set(lineas)].slice(0, 6).map((l) => `- ${l}`).join("\n")}`;
}

// ---------- Corrida completa ----------

export interface ResultadoIntento {
  doc: LandingDoc;
  critica: Critica | null;
  notas: NotaVuelta[];
  estrategia: Estrategia;
  prompt: { sistema: string; usuario: string };
  plan: SeccionPlanificada[];
  proveedores: string[];
  avisos: string[];
}

async function ensamblar(c: Corrida, d: DepsPipeline, secciones: Seccion[], plan: SeccionPlanificada[], imagenes: ResultadoImagenes, dato: DatoCurioso | null, escritas: string[]): Promise<LandingDoc> {
  const fijas = fijarSecciones(secciones, c.e, c.brief, plan);
  const base: LandingDoc = {
    version: 1,
    meta: {
      nombre: c.brief.nombre,
      slug: c.e.slug,
      producto: c.brief.nombre,
      tecnicas: c.e.tecnicas,
      semilla: c.semilla,
      nivelConciencia: c.brief.nivelConciencia,
      marco: "PAS",
      eliminadas: [],
      tematica: c.e.tematica,
    },
    tokens: c.tokens,
    secciones: fijas,
    assets: imagenes.assets,
  };
  const conHeroe = heroeSinImagen(base);
  const completo = agregarSeccionesDelSistema(conHeroe, { entrada: c.e, dato, hayCreditos: conHeroe.assets.some((a) => a.credito && a.ruta), permitidas: escritas, investigacion: c.paquete });
  return completo;
}

/** Sin imagen real del producto en el héroe (ni generada) no hay marcador en el primer viewport: pasa a `problema-primero`. */
export function heroeSinImagen(doc: LandingDoc): LandingDoc {
  const i = doc.secciones.findIndex((s) => s.tipo === "heroe");
  if (i === -1) return doc;
  const heroe = doc.secciones[i];
  const slot = typeof heroe.ajustes.slot === "string" ? heroe.ajustes.slot : undefined;
  if (slot && doc.assets.find((a) => a.slot === slot)?.ruta) {
    // El fondo del banco es opcional: sin él, el héroe queda sobre el color de fondo.
    const fondos = Array.isArray(heroe.ajustes.slots) ? (heroe.ajustes.slots as string[]).filter((f) => doc.assets.find((a) => a.slot === f)?.ruta) : [];
    if (fondos.length === (heroe.ajustes.slots as string[] | undefined)?.length) return doc;
    const { slots: _s, ...resto } = heroe.ajustes as Record<string, unknown>;
    void _s;
    return { ...doc, secciones: doc.secciones.map((s, k) => (k === i ? { ...heroe, ajustes: { ...resto, ...(fondos.length ? { slots: fondos } : {}) } } : s)) };
  }
  const { slot: _a, slots: _b, ...resto } = heroe.ajustes as Record<string, unknown>;
  void _a;
  void _b;
  return { ...doc, secciones: doc.secciones.map((s, k) => (k === i ? { ...heroe, variante: "problema-primero", ajustes: resto } : s)) };
}

/** Corrige la lista negra con el corrector del proyecto. */
async function limpiarListaNegra(d: DepsPipeline, doc: LandingDoc, avisos: string[]): Promise<LandingDoc> {
  if (infraccionesCorregibles(doc).length === 0) return doc;
  try {
    const r = await corregirListaNegra(doc, { llamar: (p) => llamar(d, p), avisos });
    return aplicarCambios(doc, r.cambios);
  } catch (e) {
    avisos.push(`No se pudo corregir la lista negra: ${mensaje(e)}`);
    return doc;
  }
}

export interface EntradaIntento {
  c: Corrida;
  d: DepsPipeline;
  intento: number;
  angulo?: string;
  previosImagenes: Map<string, Asset>;
  /** Se llena con los ángulos alternos apenas sale la estrategia, para que un intento que falla después no los pierda. */
  alternos?: string[];
  dato: DatoCurioso | null;
  candidatos: MedioBanco[];
}

export async function correrIntento(x: EntradaIntento): Promise<ResultadoIntento & { imagenes: ResultadoImagenes }> {
  const { c, d, intento } = x;
  const log = d.log ?? (() => undefined);
  const umbral = d.umbral ?? UMBRAL_VITRINA;
  const avisos: string[] = [];
  const proveedores: string[] = [];
  const slug = c.e.slug;

  // 1 y 2: estrategia y plan
  const est = await etapaEstrategia(c, d, x.angulo);
  proveedores.push(est.proveedor);
  if (x.alternos && x.alternos.length === 0) x.alternos.push(...est.estrategia.angulos.alternos);
  log(`  ${slug} · intento ${intento} · estrategia ok (${est.proveedor}) · ángulo: ${est.estrategia.angulos.principal.slice(0, 70)}`);
  const estrategiaTxt = textoEstrategia(est.estrategia);
  const plan = await etapaPlan(c, d, est.estrategia);
  log(`  ${slug} · plan de ${plan.length} secciones`);

  // 3: redacción, una llamada por sección, máximo 3 a la vez. El héroe primero para que los demás no repitan su titular.
  const titulares: string[] = [];
  const secciones: Seccion[] = new Array(plan.length);
  const escribir = async (i: number, correccion?: string) => {
    const r = await redactarUna(c, d, estrategiaTxt, plan[i], i, titulares, correccion);
    secciones[i] = r.seccion;
    proveedores.push(r.proveedor);
    const t = (r.seccion.ajustes as { titular?: unknown; titulo?: unknown }).titular ?? (r.seccion.ajustes as { titulo?: unknown }).titulo;
    if (typeof t === "string") titulares.push(t);
  };
  const iHeroe = plan.findIndex((p) => p.tipo === "heroe");
  if (iHeroe >= 0) await escribir(iHeroe);
  const resto = plan.map((_, i) => i).filter((i) => i !== iHeroe);
  const resultados = await conLimite(d.enrutador ? SIMULTANEAS : SIMULTANEAS, resto.map((i) => () => escribir(i)));
  const rechazos: unknown[] = [];
  resultados.forEach((r, k) => {
    if (r.status === "rejected") {
      rechazos.push(r.reason);
      avisos.push(`No se pudo redactar «${plan[resto[k]].tipo}»: ${mensaje(r.reason)}`);
    }
  });
  // Una sección que falló se reintenta una vez, sola, antes de rendirse (`some` no ve los huecos: se revisa con `Array.from`).
  for (const k of Array.from(secciones.keys()).filter((i) => !secciones[i])) {
    await new Promise((res) => setTimeout(res, d.esperaCuotaMs === 0 ? 0 : 3000));
    try {
      await escribir(k);
    } catch (e) {
      rechazos.push(e);
    }
  }
  if (Array.from(secciones).some((s) => !s)) {
    const cuota = rechazos.find((r) => r instanceof ErrorCascadaAgotada);
    if (cuota) throw cuota;
  }
  if (Array.from(secciones).some((s) => !s)) throw new Error(`Faltan secciones tras la redacción: ${plan.filter((_, i) => !secciones[i]).map((p) => p.tipo).join(", ")}. ${avisos.join(" ")}`);
  log(`  ${slug} · ${secciones.length} secciones redactadas`);

  // Imágenes (una sola vez por landing: los intentos siguientes reutilizan lo ya resuelto)
  const slots = slotsDeVitrina(c.e);
  // Si todos los slots ya tienen imagen (otro intento), no se vuelven a pedir prompts ni a generar nada.
  const prompts = slots.every((s) => x.previosImagenes.has(s.slot)) ? { ficha: { paleta: "", luz: "", lente: "", estilo: "", fondo: "" }, slots: [] } : await escribirPromptsDeImagen(c.e, c.brief, c.semillaTxt, estrategiaTxt, c.briefTxt, slots, d.enrutador);
  const imagenes = await resolverImagenes(slots, prompts, c.e, { enrutador: d.enrutador, flux: { dirMedia: d.dirMedia, ...d.flux }, dirMedia: d.dirMedia, candidatos: x.candidatos, acento: c.tokens.colores.acento, log, validar: d.validar, generar: d.generar }, x.previosImagenes);
  avisos.push(...imagenes.avisos);
  for (const a of imagenes.assets) if (a.ruta) x.previosImagenes.set(a.slot, a); // se conservan aunque el intento falle después
  log(`  ${slug} · imágenes: ${imagenes.reales} reales, ${imagenes.generadas} generadas, ${imagenes.marcadores} marcadores`);

  const escritas = plan.map((p) => p.tipo);
  const escritasSet = new Set<string>(escritas);
  let doc = await ensamblar(c, d, secciones, plan, imagenes, x.dato, escritas);
  doc = await limpiarListaNegra(d, doc, avisos);

  // 4 y 5: crítico desacoplado y corrección dirigida, hasta MAX_VUELTAS
  const notas: NotaVuelta[] = [];
  let mejor: { doc: LandingDoc; critica: Critica } | null = null;
  const maxVueltas = d.maxVueltas ?? MAX_VUELTAS;
  for (let vuelta = 1; vuelta <= maxVueltas; vuelta++) {
    let cr: { critica: Critica; proveedor: string };
    try {
      cr = await etapaCritico(c, d, doc);
    } catch (e) {
      // Sin cuota no hay nota: se pausa y se sigue (lo resuelve quien llama); nunca se entrega una landing sin crítico como si estuviera aprobada.
      if (e instanceof ErrorCascadaAgotada && !mejor) throw e;
      avisos.push(`El crítico falló en la vuelta ${vuelta}: ${mensaje(e)}`);
      break;
    }
    proveedores.push(cr.proveedor);
    notas.push({ intento, vuelta, puntaje: cr.critica.puntaje, criterios: cr.critica.porCriterio.map((p) => ({ criterio: p.criterio, puntaje: p.puntaje })), angulo: est.estrategia.angulos.principal });
    log(`  ${slug} · intento ${intento} vuelta ${vuelta} · crítico ${cr.critica.puntaje.toFixed(2)} (${cr.proveedor}) · ${cr.critica.porCriterio.map((p) => `${p.criterio.split(" ")[0]} ${p.puntaje}`).join(", ")}`);
    for (const t of cr.critica.problemas.slice(0, 4)) log(`      · ${t.slice(0, 200)}`);
    if (!mejor || cr.critica.puntaje > mejor.critica.puntaje) mejor = { doc: { ...doc, critica: cr.critica }, critica: cr.critica };
    if (cr.critica.puntaje >= umbral) break;
    if (vuelta === maxVueltas) break;
    const objetivos = [...seccionesADeCorregir(cr.critica, doc, escritasSet).entries()].sort((a, b) => b[1].length - a[1].length).slice(0, MAX_SECCIONES_POR_VUELTA);
    if (objetivos.length === 0) {
      avisos.push(`Vuelta ${vuelta}: el crítico no señaló ninguna sección concreta; no hay qué corregir.`);
      break;
    }
    const nuevos = [...secciones];
    await conLimite(SIMULTANEAS, objetivos.map(([i, lineas]) => async () => {
      const tipo = doc.secciones[i].tipo;
      const j = plan.findIndex((p) => p.tipo === tipo);
      if (j < 0) return;
      const r = await redactarUna(c, d, estrategiaTxt, plan[j], j, titulares, textoCorreccion(cr.critica, lineas));
      nuevos[j] = r.seccion;
      proveedores.push(r.proveedor);
    }));
    secciones.splice(0, secciones.length, ...nuevos);
    doc = await ensamblar(c, d, secciones, plan, imagenes, x.dato, escritas);
    doc = await limpiarListaNegra(d, doc, avisos);
  }
  const final = mejor?.doc ?? doc;
  return { doc: final, critica: mejor?.critica ?? null, notas, estrategia: est.estrategia, prompt: est.prompt, plan, proveedores, avisos, imagenes };
}

export interface ContextoCorrida {
  c: Corrida;
  investigacion: InvestigacionVitrina;
}

/** Arma el contexto de una corrida: investigación, brief con preguntas reales, semilla y tokens. */
export async function prepararCorrida(e: EntradaVitrina, d: DepsPipeline, brief: Brief, investigacion: InvestigacionVitrina, semillaNumero: number): Promise<Corrida> {
  const { semilla } = tirarSemilla(semillaNumero, brief.intensidad);
  const tokens = tokensParaBrief(semilla, brief);
  const paquete: PaqueteInvestigacion = investigacion;
  return { e, brief, paquete, briefTxt: textoBrief(brief), invTxt: textoInvestigacion(paquete), semillaTxt: textoSemilla(semilla, tokens), tokens, semilla };
}

export { investigarEntrada, publicarEnVitrina, validarTodo, validarEstructura, HEROE_ESPACIAL };
