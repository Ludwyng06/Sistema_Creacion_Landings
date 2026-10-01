import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { CATALOGO_EFECTOS, type Asset, type Brief, type DatoCurioso, type LandingDoc, type MedioBanco, type PromptEstructurado, type ResultadoValidador } from "@/lib/contratos";
import { buscarMedios } from "@/lib/bancos/repositorio";
import { ErrorCascadaAgotada } from "@/lib/ia/tipos";
import { validarTodo } from "@/lib/validadores";
import { investigarEntrada } from "./investigar";
import { publicarEnVitrina, slotsDelDoc } from "./medios";
import { correrIntento, MAX_INTENTOS, prepararCorrida, UMBRAL_VITRINA, type DepsPipeline, type NotaVuelta } from "./pipeline";
import type { EntradaVitrina, InvestigacionVitrina } from "./tipos";

// Construye una landing de la vitrina con el pipeline por etapas de `pipeline.ts`: hasta 4 intentos, cada uno con hasta 3 vueltas
// de crítico y corrección dirigida; se conserva el mejor. No baja la vara: si no llega al umbral, la deja marcada como pendiente.

export const PUNTAJE_VITRINA = UMBRAL_VITRINA;
/** Preguntas reales que se suman a las objeciones del brief. */
const MAX_OBJECIONES = 7;

export type DepsVitrina = DepsPipeline;

export interface ConteoMedios {
  reales: number;
  marcadores: number;
}

export interface ResultadoVitrina {
  entrada: EntradaVitrina;
  doc: LandingDoc;
  prompt: PromptEstructurado;
  brief: Brief;
  salud: ResultadoValidador[];
  proveedor: string;
  puntaje: number | null;
  rojos: number;
  listaNegra: number;
  medios: ConteoMedios;
  widget: string;
  segundos: number;
  intentos: number;
  avisos: string[];
  investigacion: InvestigacionVitrina;
  /** `true` si el crítico no llegó al umbral o quedó un rojo. */
  pendiente: boolean;
  /** La nota de cada vuelta de cada intento, con la de cada criterio. */
  notas: NotaVuelta[];
  imagenes: { reales: number; generadas: number; marcadores: number };
  efectos: string[];
  nivel3: number;
}

export class ErrorVitrina extends Error {
  constructor(
    readonly tipo: "cuota" | "ia",
    mensaje: string,
  ) {
    super(mensaje);
    this.name = "ErrorVitrina";
  }
}

/** El brief con las preguntas reales de la gente sumadas a sus objeciones (sin repetir). */
export function briefConPreguntas(brief: Brief, preguntas: string[]): Brief {
  const norm = (t: string) => t.toLowerCase().replace(/[¿?¡!.\s]+/g, " ").trim();
  const existentes = new Set(brief.objeciones.map(norm));
  const extra = preguntas.filter((p) => !existentes.has(norm(p)));
  return { ...brief, objeciones: [...brief.objeciones, ...extra].slice(0, MAX_OBJECIONES) };
}

/** Elige una frase del banco b8 para la entrada: las de sus temas, sin repetir una que ya usó otra landing. */
export function elegirDatoCurioso(e: EntradaVitrina, datos: DatoCurioso[], usadas: Set<string>): DatoCurioso | null {
  for (const tema of e.temasCuriosos ?? []) {
    const d = datos.find((x) => x.tema === tema && !usadas.has(x.id));
    if (d) return d;
  }
  return null;
}

/** Cuántos slots que las secciones usan tienen una imagen real y cuántos siguen con su marcador de Grok. */
export function contarMedios(doc: LandingDoc): ConteoMedios {
  const slots = slotsDelDoc(doc).map((s) => s.slot);
  const usados = doc.assets.filter((a) => slots.includes(a.slot));
  return { reales: usados.filter((a) => a.ruta).length, marcadores: slots.length - usados.filter((a) => a.ruta).length };
}

const NOMBRE_WIDGET: Record<string, string> = { auroras: "NOAA", "fase-lunar": "USNO", iss: "wheretheiss.at", "cuenta-regresiva-lanzamiento": "The Space Devs", asteroides: "NASA NeoWs" };
const NOMBRE_MEDIO: Record<string, string> = { "nasa-images": "NASA", apod: "NASA", epic: "NASA", wikimedia: "Wikimedia Commons", openverse: "Openverse", pixabay: "Pixabay", pexels: "Pexels", "open-food-facts": "Open Food Facts", "open-beauty-facts": "Open Beauty Facts" };

/** Nombres de las fuentes que de verdad usó la landing: /banco los muestra («NASA · NOAA», «Open Beauty Facts · SerpAPI»). */
export function nombresFuentes(e: EntradaVitrina, doc: LandingDoc, inv: InvestigacionVitrina): string[] {
  const nombres: string[] = [];
  for (const a of doc.assets) if (a.ruta && a.fuente && NOMBRE_MEDIO[a.fuente]) nombres.push(NOMBRE_MEDIO[a.fuente]);
  if (e.widget && inv.widget?.responde) nombres.push(NOMBRE_WIDGET[e.widget.variante]);
  for (const f of inv.fuentes) {
    if (f.estado !== "ok") continue;
    if (f.fuente === "serpapi") nombres.push("SerpAPI");
    else if (f.fuente === "open-food-facts" || f.fuente === "open-beauty-facts") nombres.push(NOMBRE_MEDIO[f.fuente]);
  }
  return [...new Set(nombres)];
}

const contarRojos = (salud: ResultadoValidador[]) => salud.filter((s) => s.estado === "rojo").length;
const contarListaNegra = (salud: ResultadoValidador[]) => salud.find((s) => s.id === "lista-negra")?.problemas.length ?? 0;

async function candidatosDe(e: EntradaVitrina, d: DepsVitrina): Promise<MedioBanco[]> {
  const leer = d.medios ?? ((banco: string) => buscarMedios({ banco, limite: 100 }));
  const salida: MedioBanco[] = [];
  for (const b of e.bancos) salida.push(...(await leer(b)));
  return salida;
}

/** Construye una entrada de la vitrina con el pipeline por etapas. Lanza `ErrorVitrina` si la IA no responde. */
export async function construirEntrada(e: EntradaVitrina, d: DepsVitrina): Promise<ResultadoVitrina> {
  const log = d.log ?? (() => undefined);
  const inicio = performance.now();
  const umbral = d.umbral ?? UMBRAL_VITRINA;
  const investigacion = await investigarEntrada(e, { fuentes: d.fuentes, ejecucion: d.ejecucion, ahora: d.ahora });
  const brief = briefConPreguntas(e.brief, investigacion.preguntas);
  const candidatos = await candidatosDe(e, d);
  const dato = e.tematica === "espacio" ? elegirDatoCurioso(e, d.curiosos ?? [], d.frasesUsadas ?? new Set()) : null;

  const previos = new Map<string, Asset>();
  const notas: NotaVuelta[] = [];
  const avisos: string[] = [];
  const proveedores = new Set<string>();
  let mejor: (Awaited<ReturnType<typeof correrIntento>> & { c: Awaited<ReturnType<typeof prepararCorrida>> }) | null = null;
  const alternos: string[] = [];
  const maxIntentos = d.maxIntentos ?? MAX_INTENTOS;
  let intentos = 0;

  for (let intento = 1; intento <= maxIntentos; intento++) {
    intentos = intento;
    // Intento 2 y 3: otro ángulo de la estrategia. Intento 4: además otra semilla.
    const angulo = intento > 1 ? alternos[intento - 2] : undefined;
    const c = await prepararCorrida(e, d, brief, investigacion, e.numeroSemilla + (intento >= 4 ? 97 : 0));
    try {
      let r: Awaited<ReturnType<typeof correrIntento>> | undefined;
      // Cuota agotada: se pausa y se sigue con el mismo intento (hasta 3 pausas); nunca se baja el criterio.
      for (let pausa = 0; !r; pausa++) {
        try {
          r = await correrIntento({ c, d, intento, angulo, previosImagenes: previos, alternos, dato, candidatos });
        } catch (err) {
          if (!(err instanceof ErrorCascadaAgotada) || pausa >= (d.maxPausas ?? 3)) throw err;
          log(`  ${e.slug} · cuota de IA agotada; pausa de ${Math.round((d.esperaCuotaMs ?? 120_000) / 60_000)} min y se sigue con el intento ${intento}`);
          await new Promise((res) => setTimeout(res, d.esperaCuotaMs ?? 120_000));
        }
      }
      for (const a of r.imagenes.assets) if (a.ruta && !previos.has(a.slot)) previos.set(a.slot, a);
      notas.push(...r.notas);
      avisos.push(...r.avisos);
      r.proveedores.forEach((p) => proveedores.add(p));
      const puntaje = r.critica?.puntaje ?? 0;
      if (!mejor || puntaje > (mejor.critica?.puntaje ?? 0)) mejor = { ...r, c };
      if (puntaje >= umbral) break;
      log(`  ${e.slug} · intento ${intento} cerró en ${puntaje.toFixed(2)} (umbral ${umbral})`);
    } catch (err) {
      if (err instanceof ErrorCascadaAgotada) throw new ErrorVitrina("cuota", `la cascada de IA se agotó (${err.intentos.map((i) => `${i.proveedor}: ${i.tipo}`).join(", ")})`);
      const m = err instanceof Error ? `${err.message.split("\n")[0]} @ ${(err.stack ?? "").split("\n")[1]?.trim() ?? ""}` : String(err);
      avisos.push(`El intento ${intento} falló: ${m}`);
      log(`  ${e.slug} · intento ${intento} falló: ${m}`);
      if (!mejor && intento >= maxIntentos) throw new ErrorVitrina("ia", m);
    }
  }
  if (!mejor) throw new ErrorVitrina("ia", "ningún intento produjo una landing");

  const conFuentes: LandingDoc = { ...mejor.doc, meta: { ...mejor.doc.meta, tematica: e.tematica, fuentes: nombresFuentes(e, mejor.doc, investigacion) } };
  const docFinal = await publicarEnVitrina(conFuentes, e.slug, d.dirMedia, d.protegidas);
  const { doc, salud } = validarTodo(docFinal, brief);
  const rojos = contarRojos(salud);
  const puntaje = doc.critica?.puntaje ?? null;
  if (dato) d.frasesUsadas?.add(dato.id);
  const efectos = doc.secciones.flatMap((s) => s.efectos ?? []);
  const prompt: PromptEstructurado = {
    rol: mejor.prompt.sistema.split("## TAREA")[0].replace("## ROL\n", "").trim(),
    tarea: "Pipeline por etapas: investigación → estrategia → plan de secciones → redacción por sección → imágenes → crítico desacoplado → corrección dirigida.",
    contexto: mejor.prompt.usuario,
    formato: `Estrategia de la corrida (JSON): ${JSON.stringify(mejor.estrategia)}\nPlan: ${mejor.plan.map((p) => p.tipo).join(" → ")}`,
    aportes: [],
  };
  return {
    entrada: e,
    doc,
    prompt,
    brief,
    salud,
    proveedor: [...proveedores][0] ?? "desconocido",
    puntaje,
    rojos,
    listaNegra: contarListaNegra(salud),
    medios: contarMedios(doc),
    widget: e.widget ? e.widget.variante : "—",
    segundos: Math.round((performance.now() - inicio) / 1000),
    intentos,
    avisos,
    investigacion,
    pendiente: rojos > 0 || (puntaje ?? 0) < umbral,
    notas,
    imagenes: { reales: doc.assets.filter((a) => a.ruta && !a.generada).length, generadas: doc.assets.filter((a) => a.ruta && a.generada).length, marcadores: contarMedios(doc).marcadores },
    efectos: [...new Set(efectos)],
    nivel3: efectos.filter((x) => CATALOGO_EFECTOS[x]?.nivel === 3).length,
  };
}

/** Datos que se guardan en `datos/vitrina/<slug>.json`: con esto se siembra el banco sin claves de IA. */
export interface ArchivoVitrina {
  slug: string;
  numero: number;
  brief: Brief;
  tecnicas: EntradaVitrina["tecnicas"];
  numeroSemilla: number;
  prompt: PromptEstructurado;
  doc: LandingDoc;
  proveedor: string;
  informe: {
    puntaje: number | null;
    rojos: number;
    listaNegra: number;
    medios: ConteoMedios;
    widget: string;
    segundos: number;
    intentos: number;
    investigacion: InvestigacionVitrina;
    notas: NotaVuelta[];
    imagenes: { reales: number; generadas: number; marcadores: number };
    efectos: string[];
    nivel3: number;
  };
}

export function aArchivo(r: ResultadoVitrina): ArchivoVitrina {
  return {
    slug: r.entrada.slug,
    numero: r.entrada.numero,
    brief: r.brief,
    tecnicas: r.entrada.tecnicas,
    numeroSemilla: r.entrada.numeroSemilla,
    prompt: r.prompt,
    doc: r.doc,
    proveedor: r.proveedor,
    informe: { puntaje: r.puntaje, rojos: r.rojos, listaNegra: r.listaNegra, medios: r.medios, widget: r.widget, segundos: r.segundos, intentos: r.intentos, investigacion: r.investigacion, notas: r.notas, imagenes: r.imagenes, efectos: r.efectos, nivel3: r.nivel3 },
  };
}

export async function escribirArchivo(ruta: string, r: ResultadoVitrina): Promise<void> {
  await mkdir(dirname(ruta), { recursive: true });
  await writeFile(ruta, `${JSON.stringify(aArchivo(r), null, 2)}\n`, "utf8");
}
