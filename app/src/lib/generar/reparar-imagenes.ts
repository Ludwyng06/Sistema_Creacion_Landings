import { join } from "node:path";
import type { Asset, BriefGeneral, LandingDoc, MedioBanco, TipoLanding } from "@/lib/contratos";
import { crearFuentes, type Fuentes } from "@/lib/fuentes/registro";
import type { DepsEnrutador } from "@/lib/ia/enrutador";
import { generarImagenOpenAI } from "@/lib/imagenes/openai";
import { actualizarDoc, guardarVersion, obtenerLanding, type LandingCompleta } from "@/lib/landings";
import { consultasDeBanco, palabrasClave } from "@/lib/vitrina/imagenes-sin-ia";
import { slotsDelDoc } from "@/lib/vitrina/medios";
import type { EntradaVitrina } from "@/lib/vitrina/tipos";
import { almacenCheckpointAjuste, type AlmacenCheckpoint } from "./checkpoint";
import { candidatosPorDefecto } from "./candidatos";
import { enrutarFuentes } from "./fuentes";
import { resolverConCompetencia, type DepsCompetencia, type NotaSlot } from "./imagenes-competencia";
import { briefCompatible, slotsDeDoc } from "./pipeline";
import { esSlotDeIcono } from "./slots";

// POST /api/landings/[id]/imagenes: llena los marcadores de una landing ya guardada con la misma regla de la generación
// (bancos y APIs gratuitas por palabras clave, OpenAI fuera de espacio, crítico de imágenes, FLUX de último recurso).
// No usa IA de texto para los prompts: salen de la plantilla.

export interface DepsReparar {
  enrutador?: DepsEnrutador;
  fuentes?: Fuentes;
  dirMedia?: string;
  checkpoint?: AlmacenCheckpoint;
  candidatos?: (consulta: string) => Promise<MedioBanco[]>;
  generarOpenAI?: DepsCompetencia["generarOpenAI"];
  generarFlux?: DepsCompetencia["generarFlux"];
  elegir?: DepsCompetencia["elegir"];
}

export interface ResultadoReparar {
  landing: LandingCompleta;
  /** Slots que no tenían imagen y la recibieron. */
  asignados: string[];
  /** Slots que siguen con marcador. */
  marcadores: string[];
  avisos: string[];
  notas: Record<string, NotaSlot>;
  /** Candidatas de banco y APIs que llegaron, por fuente. */
  fuentes: Record<string, number>;
}

const tieneRuta = (doc: LandingDoc, slot: string) => doc.assets.some((a) => a.slot === slot && a.ruta);

export async function repararImagenes(id: string, d: DepsReparar = {}): Promise<ResultadoReparar> {
  const landing = await obtenerLanding(id);
  const doc = landing.doc;
  const dirMedia = d.dirMedia ?? join(process.cwd(), "public", "media");
  const tipo = (doc.meta.tipo ?? "producto") as TipoLanding;
  const tematica = doc.meta.tematica ?? "general";
  const bc = landing.brief;
  const brief = { tipo, tematica, nombre: bc.nombre, publico: bc.publico, propuesta: bc.problema, beneficios: bc.beneficios, datosClave: [], faltantes: [] } as unknown as BriefGeneral;

  const pedidos = slotsDelDoc(doc).filter((p) => !esSlotDeIcono(p.slot)).map((p) => ({ slot: p.slot, rol: p.rol as string }));
  const heroe = doc.secciones.find((s) => s.tipo === "heroe");
  const heroeSinSlot = heroe !== undefined && typeof heroe.ajustes.slot !== "string";
  if (heroeSinSlot && !pedidos.some((p) => p.slot === "heroe-imagen")) pedidos.unshift({ slot: "heroe-imagen", rol: "heroe" });
  const faltan = pedidos.filter((p) => !tieneRuta(doc, p.slot));
  if (faltan.length === 0) return { landing, asignados: [], marcadores: [], avisos: ["Todos los slots ya tienen imagen."], notas: {}, fuentes: {} };

  await guardarVersion(id, "Antes de buscar fotos");
  const consultas = [brief.nombre, ...consultasDeBanco(brief.nombre, [brief.propuesta], tematica)].slice(0, 4);
  const enrutado = enrutarFuentes({ tipo, tematica, descripcion: `${brief.nombre} ${brief.propuesta}` });
  const fuentes = d.fuentes ?? crearFuentes();
  const buscar = d.candidatos ?? ((q: string) => candidatosPorDefecto(q, enrutado, { dirMedia, fuentes }));
  const lotes = await Promise.all(consultas.map((q) => buscar(q).catch(() => [] as MedioBanco[])));
  const visto = new Set<string>();
  const candidatos = lotes.flat().filter((m) => (visto.has(m.id) ? false : (visto.add(m.id), true)));

  const entrada = {
    numero: 0,
    slug: "reparar",
    tematica: tematica === "espacio" ? "espacio" : "producto",
    brief: briefCompatible(brief),
    tecnicas: [],
    numeroSemilla: 0,
    bancos: tematica === "espacio" ? ["b1", "b3", "b4", "b5", "b7"] : [],
    claves: palabrasClave([brief.nombre, brief.propuesta], tematica),
    fuentes: [],
    consultas: {},
    ficha: [],
    textoCta: "",
  } as unknown as EntradaVitrina;

  const r = await resolverConCompetencia(slotsDeDoc(faltan, brief), {
    enrutador: d.enrutador,
    dirMedia,
    candidatos,
    entrada,
    espacial: tematica === "espacio",
    contexto: { nombre: brief.nombre, descripcion: brief.propuesta, tematica, tipo, colores: { fondo: doc.tokens.colores.fondo, acento: doc.tokens.colores.acento } },
    briefTxt: `Nombre: ${brief.nombre}\nPropuesta: ${brief.propuesta}\nPúblico: ${brief.publico}`,
    fichaTxt: `Estilo ${doc.meta.semilla.estilo}; colores de fondo ${doc.tokens.colores.fondo} y acento ${doc.tokens.colores.acento}.`,
    acento: doc.tokens.colores.acento,
    generarOpenAI: d.generarOpenAI ?? ((prompt, relacion) => generarImagenOpenAI(prompt, relacion, { dirMedia })),
    generarFlux: d.generarFlux,
    elegir: d.elegir,
  });

  const nuevos = new Map(r.assets.filter((a) => a.ruta).map((a) => [a.slot, a]));
  const mantenidos: Asset[] = doc.assets.filter((a) => !(nuevos.has(a.slot) || (!a.ruta && faltan.some((f) => f.slot === a.slot))));
  const sinResolver = r.assets.filter((a) => !a.ruta);
  let secciones = doc.secciones;
  // Un héroe que quedó sin imagen (pasó a «problema-primero») recupera su foto a sangre.
  if (heroe && heroeSinSlot && nuevos.has("heroe-imagen")) {
    secciones = secciones.map((s) => (s.tipo === "heroe" ? { ...s, variante: "poster-a-sangre", ajustes: { ...s.ajustes, slot: "heroe-imagen" } } : s));
  }
  const nuevoDoc: LandingDoc = { ...doc, secciones, assets: [...mantenidos, ...nuevos.values(), ...sinResolver] };
  const actualizada = await actualizarDoc(id, nuevoDoc);

  const almacen = d.checkpoint ?? almacenCheckpointAjuste;
  const previo = await almacen.leer(id).catch(() => null);
  await almacen
    .escribir(id, {
      etapa: previo?.etapa ?? "imagenes",
      criticoPendiente: previo?.criticoPendiente ?? actualizada.criticoPendiente,
      briefTxt: previo?.briefTxt ?? `Nombre: ${brief.nombre}\nPropuesta: ${brief.propuesta}`,
      umbral: previo?.umbral ?? 8,
      avisos: previo?.avisos ?? [],
      seccionesPorCompletar: previo?.seccionesPorCompletar ?? [],
      actualizadoEn: new Date().toISOString(),
      tiempos: previo?.tiempos,
      imagenes: { notas: { ...(previo?.imagenes?.notas ?? {}), ...r.notas }, alternativas: { ...(previo?.imagenes?.alternativas ?? {}), ...r.alternativas }, fuentes: r.fuentes },
    })
    .catch(() => undefined);

  return { landing: actualizada, asignados: [...nuevos.keys()], marcadores: sinResolver.map((a) => a.slot), avisos: r.avisos, notas: r.notas, fuentes: r.fuentes };
}
