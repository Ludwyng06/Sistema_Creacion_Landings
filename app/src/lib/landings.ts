import { Brief, LandingDoc, PromptEstructurado, TecnicaId, type ResultadoValidador } from "@/lib/contratos";
import { db } from "@/lib/db";
import { aTexto } from "@/lib/tecnicas/plantillas";
import { validarTodo } from "@/lib/validadores";

// Única puerta a Prisma para landings, versiones y leads (docs/05 §5).
// Serializa y deserializa los JSON y valida `doc` con `LandingDoc` al leer.

export class LandingNoEncontrada extends Error {
  constructor(id: string) {
    super(`No existe la landing «${id}».`);
    this.name = "LandingNoEncontrada";
  }
}

export class VersionNoEncontrada extends Error {
  constructor(id: string) {
    super(`No existe la versión «${id}» en esta landing.`);
    this.name = "VersionNoEncontrada";
  }
}

export type EstadoLanding = "borrador" | "en-banco";

export interface ResumenLanding {
  id: string;
  nombre: string;
  slug: string;
  tecnicas: TecnicaId[];
  puntaje: number | null;
  /** Sin nota del crítico (falló por cuota al generar): se reintenta con `POST /api/landings/[id]/critico`. */
  criticoPendiente: boolean;
  favorita: boolean;
  estado: EstadoLanding;
  proveedor: string;
  miniatura: string | null;
  creadoEn: string;
  actualizadoEn: string;
}

export interface LandingCompleta extends ResumenLanding {
  brief: Brief;
  /** Prompt final en texto (`aTexto`). */
  prompt: string;
  promptBloques: PromptEstructurado;
  doc: LandingDoc;
}

export interface ResumenVersion {
  id: string;
  landingId: string;
  nota: string | null;
  creadoEn: string;
}

export interface LeadGuardado {
  id: string;
  landingId: string;
  datos: Record<string, string>;
  creadoEn: string;
}

interface FilaLanding {
  id: string;
  nombre: string;
  slug: string;
  brief: string;
  tecnicas: string;
  prompt: string;
  promptBloques: string;
  doc: string;
  puntaje: number | null;
  favorita: boolean;
  estado: string;
  proveedor: string;
  miniatura: string | null;
  creadoEn: Date;
  actualizadoEn: Date;
}

const leerDoc = (json: string): LandingDoc => LandingDoc.parse(JSON.parse(json));

function aResumen(f: FilaLanding): ResumenLanding {
  return {
    id: f.id,
    nombre: f.nombre,
    slug: f.slug,
    tecnicas: JSON.parse(f.tecnicas) as TecnicaId[],
    puntaje: f.puntaje,
    criticoPendiente: f.puntaje === null,
    favorita: f.favorita,
    estado: f.estado as EstadoLanding,
    proveedor: f.proveedor,
    miniatura: f.miniatura,
    creadoEn: f.creadoEn.toISOString(),
    actualizadoEn: f.actualizadoEn.toISOString(),
  };
}

function aCompleta(f: FilaLanding): LandingCompleta {
  return {
    ...aResumen(f),
    brief: Brief.parse(JSON.parse(f.brief)),
    prompt: f.prompt,
    promptBloques: PromptEstructurado.parse(JSON.parse(f.promptBloques)),
    doc: leerDoc(f.doc),
  };
}

async function fila(id: string): Promise<FilaLanding> {
  const f = await db.landing.findUnique({ where: { id } });
  if (!f) throw new LandingNoEncontrada(id);
  return f;
}

/** `slug`, `slug-2`, `slug-3`… hasta encontrar uno libre. */
async function slugLibre(base: string): Promise<string> {
  for (let n = 1; ; n++) {
    const candidato = n === 1 ? base : `${base}-${n}`;
    if (!(await db.landing.findUnique({ where: { slug: candidato }, select: { id: true } }))) return candidato;
  }
}

export interface DatosNuevaLanding {
  brief: Brief;
  tecnicas: TecnicaId[];
  prompt: PromptEstructurado;
  doc: LandingDoc;
  proveedor: string;
}

/** Crea la landing con su versión inicial «Generada por IA». */
export async function crearLanding(d: DatosNuevaLanding): Promise<LandingCompleta> {
  const doc = LandingDoc.parse(d.doc);
  const slug = await slugLibre(doc.meta.slug);
  const final: LandingDoc = { ...doc, meta: { ...doc.meta, slug } };
  const creada = await db.landing.create({
    data: {
      nombre: final.meta.nombre,
      slug,
      brief: JSON.stringify(d.brief),
      tecnicas: JSON.stringify(d.tecnicas),
      prompt: aTexto(d.prompt),
      promptBloques: JSON.stringify(d.prompt),
      doc: JSON.stringify(final),
      puntaje: final.critica?.puntaje ?? null,
      proveedor: d.proveedor,
      versiones: { create: { doc: JSON.stringify(final), nota: "Generada por IA" } },
    },
  });
  return aCompleta(creada);
}

export async function obtenerLanding(id: string): Promise<LandingCompleta> {
  return aCompleta(await fila(id));
}

export async function obtenerPorSlug(slug: string): Promise<LandingCompleta | null> {
  const f = await db.landing.findUnique({ where: { slug } });
  return f ? aCompleta(f) : null;
}

export interface FiltrosLandings {
  tecnica?: TecnicaId;
  puntajeMin?: number;
  favoritas?: boolean;
  estado?: EstadoLanding;
  /** Incluye `doc` en cada elemento (por defecto solo el resumen). */
  conDoc?: boolean;
}

export async function listarLandings(filtros: FiltrosLandings & { conDoc: true }): Promise<(ResumenLanding & { doc: LandingDoc })[]>;
export async function listarLandings(filtros?: FiltrosLandings): Promise<ResumenLanding[]>;
export async function listarLandings(filtros: FiltrosLandings = {}): Promise<ResumenLanding[]> {
  const filas = await db.landing.findMany({
    where: {
      ...(filtros.estado && { estado: filtros.estado }),
      ...(filtros.favoritas && { favorita: true }),
      ...(filtros.puntajeMin !== undefined && { puntaje: { gte: filtros.puntajeMin } }),
      ...(filtros.tecnica && { tecnicas: { contains: `"${filtros.tecnica}"` } }),
    },
    orderBy: { actualizadoEn: "desc" },
  });
  return filas.map((f) => (filtros.conDoc ? { ...aResumen(f), doc: leerDoc(f.doc) } : aResumen(f)));
}

/** Como `listarLandings`, pero con brief, prompt y documento de cada una (para el banco). */
export async function listarLandingsCompletas(filtros: Omit<FiltrosLandings, "conDoc"> = {}): Promise<LandingCompleta[]> {
  const filas = await db.landing.findMany({
    where: {
      ...(filtros.estado && { estado: filtros.estado }),
      ...(filtros.favoritas && { favorita: true }),
      ...(filtros.puntajeMin !== undefined && { puntaje: { gte: filtros.puntajeMin } }),
      ...(filtros.tecnica && { tecnicas: { contains: `"${filtros.tecnica}"` } }),
    },
    orderBy: { actualizadoEn: "desc" },
  });
  return filas.map(aCompleta);
}

/**
 * Crea o actualiza (por slug) una landing de la vitrina con todos sus datos y deja el rastro en una versión.
 * La base, el JSON y las imágenes quedan sincronizados sin borrar la fila (los leads y el id se conservan).
 */
export async function upsertLandingPorSlug(d: DatosNuevaLanding): Promise<LandingCompleta> {
  const doc = LandingDoc.parse(d.doc);
  const previa = await db.landing.findUnique({ where: { slug: doc.meta.slug } });
  if (!previa) return crearLanding(d);
  const f = await db.landing.update({
    where: { id: previa.id },
    data: {
      nombre: doc.meta.nombre,
      brief: JSON.stringify(d.brief),
      tecnicas: JSON.stringify(d.tecnicas),
      prompt: aTexto(d.prompt),
      promptBloques: JSON.stringify(d.prompt),
      doc: JSON.stringify(doc),
      puntaje: doc.critica?.puntaje ?? null,
      proveedor: d.proveedor,
      versiones: { create: { doc: JSON.stringify(doc), nota: "Actualizada por la vitrina" } },
    },
  });
  return aCompleta(f);
}

/** Autoguardado: reemplaza el documento sin crear versión. */
export async function actualizarDoc(id: string, doc: LandingDoc): Promise<LandingCompleta> {
  await fila(id);
  const valido = LandingDoc.parse(doc);
  const f = await db.landing.update({
    where: { id },
    data: { doc: JSON.stringify(valido), puntaje: valido.critica?.puntaje ?? null },
  });
  return aCompleta(f);
}

/** Copia la landing como borrador nuevo: mismo brief, técnicas, prompt y documento, con nombre y slug propios y su versión inicial. */
export async function duplicarLanding(id: string): Promise<LandingCompleta> {
  const origen = await obtenerLanding(id);
  const nombre = `${origen.nombre} (copia)`;
  const doc: LandingDoc = { ...origen.doc, meta: { ...origen.doc.meta, nombre } };
  const copia = await crearLanding({ brief: origen.brief, tecnicas: origen.tecnicas, prompt: origen.promptBloques, doc, proveedor: origen.proveedor });
  await db.version.updateMany({ where: { landingId: copia.id }, data: { nota: `Copia de «${origen.nombre}»` } });
  return copia;
}

export async function renombrarLanding(id: string, nombre: string): Promise<LandingCompleta> {
  const actual = await obtenerLanding(id);
  const doc: LandingDoc = { ...actual.doc, meta: { ...actual.doc.meta, nombre } };
  const f = await db.landing.update({ where: { id }, data: { nombre, doc: JSON.stringify(doc) } });
  return aCompleta(f);
}

/** Crea una versión con el documento actual. */
export async function guardarVersion(id: string, nota?: string): Promise<ResumenVersion> {
  const f = await fila(id);
  const v = await db.version.create({ data: { landingId: id, doc: f.doc, nota: nota ?? null } });
  return aVersion(v);
}

const aVersion = (v: { id: string; landingId: string; nota: string | null; creadoEn: Date }): ResumenVersion => ({
  id: v.id,
  landingId: v.landingId,
  nota: v.nota,
  creadoEn: v.creadoEn.toISOString(),
});

/** Versiones de la más nueva a la más antigua (sin el documento). */
export async function listarVersiones(id: string): Promise<ResumenVersion[]> {
  await fila(id);
  const versiones = await db.version.findMany({
    where: { landingId: id },
    orderBy: [{ creadoEn: "desc" }, { id: "desc" }],
    select: { id: true, landingId: true, nota: true, creadoEn: true },
  });
  return versiones.map(aVersion);
}

export async function obtenerVersion(id: string, versionId: string): Promise<ResumenVersion & { doc: LandingDoc }> {
  const v = await db.version.findFirst({ where: { id: versionId, landingId: id } });
  if (!v) throw new VersionNoEncontrada(versionId);
  return { ...aVersion(v), doc: leerDoc(v.doc) };
}

/** Restaura una versión; antes guarda la actual como «Antes de restaurar». */
export async function restaurarVersion(id: string, versionId: string): Promise<LandingCompleta> {
  const version = await obtenerVersion(id, versionId);
  await guardarVersion(id, "Antes de restaurar");
  return actualizarDoc(id, version.doc);
}

export interface MotivoBanco {
  validador: string;
  ruta: string;
  mensaje: string;
}

export type ResultadoBanco = { ok: true; landing: LandingCompleta } | { ok: false; motivos: MotivoBanco[] };

/**
 * Pasa la landing a `en-banco` solo si ningún validador queda en rojo.
 * `saludRender` (el validador anti-split de render, medido en el navegador) sustituye al pendiente.
 */
export async function guardarEnBanco(id: string, saludRender?: ResultadoValidador): Promise<ResultadoBanco> {
  const landing = await obtenerLanding(id);
  const { salud } = validarTodo(landing.doc, landing.brief);
  const completa = saludRender ? salud.map((s) => (s.id === "anti-split-render" ? saludRender : s)) : salud;
  const motivos = completa
    .filter((s) => s.estado === "rojo")
    .flatMap((s) =>
      s.problemas.length > 0
        ? s.problemas.map((p) => ({ validador: s.id, ruta: p.ruta, mensaje: p.mensaje }))
        : [{ validador: s.id, ruta: "", mensaje: `El validador «${s.id}» está en rojo.` }],
    );
  if (motivos.length > 0) return { ok: false, motivos };
  const f = await db.landing.update({ where: { id }, data: { estado: "en-banco" } });
  return { ok: true, landing: aCompleta(f) };
}

export async function alternarFavorita(id: string): Promise<LandingCompleta> {
  const f = await fila(id);
  return aCompleta(await db.landing.update({ where: { id }, data: { favorita: !f.favorita } }));
}

export async function eliminarLanding(id: string): Promise<void> {
  await fila(id);
  await db.landing.delete({ where: { id } });
  await db.ajuste.deleteMany({ where: { clave: `checkpoint:${id}` } }); // checkpoint de la generación (20-A)
}

export async function actualizarMiniatura(id: string, ruta: string): Promise<void> {
  await fila(id);
  await db.landing.update({ where: { id }, data: { miniatura: ruta } });
}

// ---------- Leads ----------

export async function crearLead(landingId: string, datos: Record<string, string>): Promise<LeadGuardado> {
  await fila(landingId);
  const l = await db.lead.create({ data: { landingId, datos: JSON.stringify(datos) } });
  return { id: l.id, landingId, datos, creadoEn: l.creadoEn.toISOString() };
}

/** Leads de la más nueva a la más antigua. */
export async function listarLeads(landingId: string): Promise<LeadGuardado[]> {
  await fila(landingId);
  const leads = await db.lead.findMany({ where: { landingId }, orderBy: [{ creadoEn: "desc" }, { id: "desc" }] });
  return leads.map((l) => ({
    id: l.id,
    landingId,
    datos: JSON.parse(l.datos) as Record<string, string>,
    creadoEn: l.creadoEn.toISOString(),
  }));
}

// ---------- Assets ----------

/** Registra un recurso subido (uno por slot y landing). */
export async function registrarAsset(d: { landingId: string; slot: string; tipo: "imagen" | "video"; ruta: string; promptGrok?: string }) {
  await db.asset.deleteMany({ where: { landingId: d.landingId, slot: d.slot } });
  return db.asset.create({ data: { ...d, promptGrok: d.promptGrok ?? null } });
}
