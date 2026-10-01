import { createHash } from "node:crypto";
import { VARIANTES_HEROE, type Asset, type Brief, type BriefGeneral, type Critica, type Encargo, type LandingDoc, type MedioBanco, type PromptEstructurado, type Seccion, type TipoSeccion } from "@/lib/contratos";
import { ejecutar, type DepsEnrutador, type PeticionIA } from "@/lib/ia/enrutador";
import { aplicarCambios, corregirListaNegra, infraccionesCorregibles } from "@/lib/ia/corregir";
import { CriticaDelModelo, promptCritico } from "@/lib/ia/prompts/critico";
import { textoEstrategia, textoSemilla } from "@/lib/ia/prompts/contexto";
import { Estrategia, promptEstrategia } from "@/lib/ia/prompts/estrategia";
import { PlanSecciones, promptPlan, type SeccionPlanificada } from "@/lib/ia/prompts/plan";
import { promptSeccion } from "@/lib/ia/prompts/seccion";
import { resumirParaCritico } from "@/lib/ia/resumen-critico";
import { ErrorCascadaAgotada, type ResultadoIA } from "@/lib/ia/tipos";
import { tirarSemilla, tokensParaBrief } from "@/lib/tecnicas/semillas";
import { validarTodo } from "@/lib/validadores";
import type { OpcionesFlux, Relacion } from "@/lib/imagenes/flux";
import type { Fuentes } from "@/lib/fuentes/registro";
import { crearFuentes } from "@/lib/fuentes/registro";
import type { OpcionesEjecucion } from "@/lib/fuentes/ejecutar";
import { obtenerDatoVivo } from "@/lib/vivo";
import { escribirPromptsDeImagen, resolverImagenes, type SlotVitrina } from "@/lib/vitrina/imagenes";
import { conLimite, esquemaDeRedaccion, heroeSinImagen, seccionesADeCorregir } from "@/lib/vitrina/pipeline";
import { slotsDelDoc, type RolSlot } from "@/lib/vitrina/medios";
import { agregarSeccionesDelSistema, filasFicha, widgetDeVariante } from "@/lib/vitrina/plan";
import type { EntradaVitrina } from "@/lib/vitrina/tipos";
import { BLUEPRINTS, planBlueprint } from "./blueprints";
import { enrutarFuentes, type Enrutado } from "./fuentes";
import { ejecutarIntake } from "./intake";

// Pipeline genérico por tipo de landing (tarea-16 §16-A.4): intake → fuentes → estrategia → plan → redacción por sección → imágenes → crítico.
// Emite los eventos que consume /crear (forma de `EventoGenerar` de la 16-B).

export type Etapa = "intake" | "fuentes" | "estrategia" | "redaccion" | "critico";

export type EventoGenerar =
  | { tipo: "etapa"; etapa: Etapa; mensaje: string; n?: number; total?: number }
  | { tipo: "faltantes"; faltantes: { clave: string; pregunta: string }[]; detectado?: { tipo: string; tematica?: string } }
  | { tipo: "listo"; id: string; slug?: string }
  | { tipo: "error"; mensaje: string };

export const UMBRAL_GENERAR = 8;
const SIMULTANEAS = 3;

export interface DepsGenerar {
  enrutador?: DepsEnrutador;
  fuentes?: Fuentes;
  ejecucion?: OpcionesEjecucion;
  dirMedia: string;
  flux?: Partial<OpcionesFlux>;
  /** Candidatos de imagen real (NASA, Openverse, Wikimedia) para un tema; por defecto se piden a las fuentes. */
  candidatos?: (consulta: string, enrutado: Enrutado) => Promise<MedioBanco[]>;
  validar?: (ruta: string, esperado: string) => Promise<{ apta: boolean; motivo: string }>;
  generar?: (prompt: string, relacion: Relacion) => Promise<{ ruta: string }>;
  /** Guarda la landing y devuelve su id y slug. */
  guardar: (p: { brief: Brief; tecnicas: never[]; prompt: PromptEstructurado; doc: LandingDoc; proveedor: string }) => Promise<{ id: string; slug: string }>;
  ahora?: () => Date;
  maxVueltas?: number;
  umbral?: number;
}

const sinTildes = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function textoBriefGeneral(b: BriefGeneral): string {
  const l = [
    `Tipo de landing: ${b.tipo} (temática ${b.tematica})`,
    `Nombre: ${b.nombre}`,
    `Público: ${b.publico}`,
    `Propuesta: ${b.propuesta}`,
    `Beneficios: ${b.beneficios.join(" | ")}`,
    b.fecha ? `Fecha (dada por la persona): ${b.fecha}` : b.tipo === "evento" || b.tipo === "curso" ? "Fecha: NO DADA. Usa [COMPLETAR]; no la inventes." : "",
    b.lugar ? `Lugar (dado por la persona): ${b.lugar}` : b.tipo === "evento" || b.tipo === "local" ? "Lugar: NO DADO. Usa [COMPLETAR]; no lo inventes." : "",
    b.precio !== undefined ? `Precio (dado por la persona): $${b.precio.toLocaleString("es-CO")} COP. Es el único precio que se usa.` : b.tipo === "producto" || b.tipo === "curso" ? "Precio: NO DADO. Usa [COMPLETAR]; no lo inventes." : "",
    b.whatsapp ? `WhatsApp: ${b.whatsapp}` : "",
    b.ponentes?.length ? `Personas (dadas por la persona): ${b.ponentes.map((p) => `${p.nombre} (${p.rol})`).join(" | ")}` : "",
    b.agenda?.length ? `Agenda (dada por la persona): ${b.agenda.map((a) => `${a.cuando} ${a.titulo}`).join(" | ")}` : b.tipo === "evento" || b.tipo === "curso" ? "Agenda: NO DADA. Las horas van como [COMPLETAR]; describe los momentos sin inventar horarios." : "",
    b.modulos?.length ? `Módulos: ${b.modulos.join(" | ")}` : "",
    b.datosClave.length ? `Datos clave:\n${b.datosClave.map((d) => `- ${d.nombre}: ${d.valor} [${d.origen}]`).join("\n")}` : "",
    "Prueba social: no hay testimonios ni calificaciones y no se inventan.",
  ];
  return l.filter(Boolean).join("\n");
}

/** Un `Brief` de producto mínimo para guardar la landing (la base de datos lo exige); los datos reales viven en el documento. */
export function briefCompatible(b: BriefGeneral): Brief {
  const base = [...b.beneficios];
  while (base.length < 3) base.push(b.propuesta.slice(0, 120));
  return {
    nombre: b.nombre,
    categoria: "otro",
    problema: b.propuesta,
    publico: b.publico,
    beneficios: base.slice(0, 5),
    precio: { valor: b.precio ?? 0, moneda: "COP" },
    objeciones: [],
    nivelConciencia: "problema",
    intensidad: 3,
  } as Brief;
}

const hash = (t: string) => Number.parseInt(createHash("sha256").update(t).digest("hex").slice(0, 6), 16);

function slugDe(nombre: string): string {
  const base = sinTildes(nombre).replace(/[^a-z0-9]+/g, "-").slice(0, 40).replace(/^-+|-+$/g, "") || "landing";
  return `${base}-${hash(nombre + Date.now()).toString(36)}`;
}

async function llamar<T>(d: DepsGenerar, p: PeticionIA<T>): Promise<ResultadoIA<T>> {
  return ejecutar(p, d.enrutador);
}

function slotsGenerales(doc: LandingDoc): SlotVitrina[] {
  return slotsDelDoc(doc).slice(0, 8).map(({ slot, rol }) => {
    const relacion: Relacion = rol === "heroe" || rol === "problema" ? "16:9" : "1:1";
    return { slot, rol: rol as RolSlot, origen: "banco" as const, relacion, que: `imagen para el lugar «${slot}» de la landing, sin personas`, esperado: `una imagen relacionada con ${slot.replace(/-/g, " ")}, sin texto, logos ni personas identificables` };
  });
}

/** Hero válido y con el slot de imagen fijado por el sistema; las fotos de personas nunca se generan. */
export function fijarGeneral(secciones: Seccion[], tipo: BriefGeneral["tipo"], brief: BriefGeneral): Seccion[] {
  const bp = BLUEPRINTS[tipo];
  return secciones.map((s) => {
    if (s.tipo === "heroe") {
      const pedida = s.variante && bp.heroes.includes(s.variante) ? s.variante : bp.heroes[0];
      const variante = (VARIANTES_HEROE as readonly string[]).includes(pedida) ? pedida : "producto-monumental";
      const { slots: _s, ...aj } = s.ajustes as Record<string, unknown>;
      void _s;
      return { ...s, variante, ajustes: { ...aj, ...(variante === "problema-primero" ? {} : { slot: "heroe-imagen" }) }, efectos: ["boton-magnetico"] };
    }
    if (s.tipo === "ponentes") return { ...s, bloques: s.bloques.map((b) => ({ ...b, ajustes: { ...b.ajustes, imagen: undefined } })) };
    if (s.tipo === "oferta") return { ...s, ajustes: { ...s.ajustes, precio: brief.precio ?? "[COMPLETAR]", moneda: "COP", precioAnterior: undefined }, bloques: [{ id: "opc-1", tipo: "opcion-cantidad", ajustes: { unidades: 1, precio: brief.precio ?? "[COMPLETAR]" } }] };
    if (s.tipo === "garantia") return { ...s, ajustes: { ...s.ajustes, dias: "[COMPLETAR]" } };
    return s;
  });
}

export interface ResultadoGenerar {
  id: string;
  slug: string;
  doc: LandingDoc;
  brief: BriefGeneral;
  puntaje: number | null;
  faltantes: { clave: string; pregunta: string }[];
  fuentes: string[];
  avisos: string[];
}

/** Corre todas las etapas y guarda la landing. Emite los eventos de `EventoGenerar`. */
export async function generarLanding(encargo: Encargo, emitir: (e: EventoGenerar) => void, d: DepsGenerar): Promise<ResultadoGenerar> {
  const avisos: string[] = [];
  const proveedores = new Set<string>();

  // 1 · Intake
  emitir({ tipo: "etapa", etapa: "intake", mensaje: "Entendiendo tu idea…" });
  const intake = await ejecutarIntake(encargo, d.enrutador);
  const brief = intake.brief;
  if (intake.proveedor) proveedores.add(intake.proveedor);
  if (intake.descartados.length) avisos.push(`Se quitaron datos que no dijiste: ${intake.descartados.join("; ")}.`);
  emitir({ tipo: "faltantes", faltantes: brief.faltantes, detectado: { tipo: brief.tipo, tematica: brief.tematica } });

  // 2 · Fuentes
  emitir({ tipo: "etapa", etapa: "fuentes", mensaje: "Buscando datos e imágenes…" });
  const enrutado = enrutarFuentes({ tipo: brief.tipo, tematica: brief.tematica, descripcion: encargo.descripcion });
  const fuentes = d.fuentes ?? crearFuentes();
  let precios: { titulo: string; precio: number }[] = [];
  let widgetActivo = enrutado.widget;
  if (enrutado.widget) {
    const dato = await obtenerDatoVivo(widgetDeVariante(enrutado.widget), { fuentes, ahora: d.ahora }).catch(() => null);
    if (!dato) {
      avisos.push(`El dato en vivo «${enrutado.widget}» no respondió: la sección se oculta sola.`);
    }
  }
  if (enrutado.fuentes.includes("serpapi-shopping") && fuentes.serpapiShopping.habilitada()) {
    try {
      const { consultarSuave } = await import("@/lib/fuentes/ejecutar");
      const r = await consultarSuave(fuentes.serpapiShopping, { q: brief.nombre, max: 8 }, d.ejecucion ?? {});
      precios = (r?.datos ?? []).map((p) => ({ titulo: p.titulo.slice(0, 80), precio: p.precio }));
    } catch {
      avisos.push("Google Shopping no respondió.");
    }
  }
  const candidatos = await (d.candidatos?.(brief.nombre, enrutado) ?? Promise.resolve([] as MedioBanco[])).catch(() => [] as MedioBanco[]);
  if (!enrutado.widget) widgetActivo = null;

  const { semilla } = tirarSemilla(hash(brief.nombre) % 1000, 3);
  const tokens = tokensParaBrief(semilla, { intensidad: 3, coloresMarca: undefined });
  const briefTxt = textoBriefGeneral(brief);
  const invTxt = precios.length ? `Precios de referencia en tiendas (Google Shopping CO; solo comparan, nunca se copian):\n${precios.map((p) => `- ${p.titulo}: $${p.precio.toLocaleString("es-CO")}`).join("\n")}` : "";
  const semillaTxt = textoSemilla(semilla, tokens);
  const bp = BLUEPRINTS[brief.tipo];

  // 3 · Estrategia
  emitir({ tipo: "etapa", etapa: "estrategia", mensaje: "Definiendo la estrategia…" });
  const pe = promptEstrategia({ contextoBrief: briefTxt, contextoInvestigacion: invTxt, contextoSemilla: semillaTxt, enfoque: brief.tipo === "producto" ? undefined : { tipo: brief.tipo, conversion: bp.conversion, verbo: bp.verbo } });
  const re = await llamar(d, { tarea: "estrategia", sistema: pe.sistema, usuario: pe.usuario, esquema: Estrategia, maxTokens: 3500, temperatura: 0.4 });
  proveedores.add(re.proveedor);
  const estrategia = re.datos;
  const estrategiaTxt = textoEstrategia(estrategia);

  // Plan de secciones (blueprint del tipo)
  const plan0 = planBlueprint(brief.tipo, brief, widgetActivo !== null);
  const pp = promptPlan({ contextoBrief: briefTxt, contextoEstrategia: estrategiaTxt, contextoInvestigacion: invTxt, obligatorias: plan0.obligatorias, opcionales: plan0.opcionales, delSistema: plan0.delSistema, variantesHeroe: bp.heroes, espacial: brief.tematica === "espacio" });
  const rp = await llamar(d, { tarea: "plan-secciones", sistema: pp.sistema, usuario: pp.usuario, esquema: PlanSecciones, maxTokens: 3000, temperatura: 0.3 });
  proveedores.add(rp.proveedor);
  const plan = normalizarPlanGeneral(rp.datos, plan0.obligatorias, plan0.opcionales);

  // 4 · Redacción: una llamada por sección, máximo 3 a la vez
  const titulares: string[] = [];
  const secciones: Seccion[] = new Array(plan.length);
  let hechas = 0;
  const escribir = async (i: number, correccion?: string) => {
    const tipo = plan[i].tipo as TipoSeccion;
    const entrada = { tipo, plan: plan[i], contextoBrief: briefTxt, contextoEstrategia: estrategiaTxt, contextoInvestigacion: invTxt, titularesPrevios: titulares, slots: [], correccion };
    const comp = promptSeccion(entrada);
    const compacto = promptSeccion({ ...entrada, compacto: true });
    const r = await llamar(d, { tarea: "redactar-seccion", sistema: comp.sistema, usuario: comp.usuario, esquema: esquemaDeRedaccion(tipo), maxTokens: 2500, temperatura: 0.5, evitar: i % 2 === 1 ? "gemini" : undefined, compacta: { sistema: compacto.sistema, usuario: compacto.usuario, maxTokens: 1800 }, ...(correccion ? { sinCache: true } : {}) });
    proveedores.add(r.proveedor);
    secciones[i] = {
      id: tipo,
      tipo,
      ...(tipo === "heroe" ? { variante: plan[i].variante ?? undefined } : {}),
      visible: true,
      intencion: { objetivo: plan[i].objetivoPsicologico },
      ajustes: r.datos.ajustes,
      bloques: r.datos.bloques.map((b) => ({ id: b.id, tipo: b.tipo, ajustes: b.ajustes })),
      animacion: { entrada: "subir", retraso: 0 },
    };
    const t = (r.datos.ajustes as { titular?: unknown; titulo?: unknown }).titular ?? (r.datos.ajustes as { titulo?: unknown }).titulo;
    if (typeof t === "string") titulares.push(t);
    if (!correccion) emitir({ tipo: "etapa", etapa: "redaccion", mensaje: `Escribiendo sección ${++hechas}/${plan.length}…`, n: hechas, total: plan.length });
  };
  const iHeroe = plan.findIndex((p) => p.tipo === "heroe");
  if (iHeroe >= 0) await escribir(iHeroe);
  const resto = plan.map((_, i) => i).filter((i) => i !== iHeroe);
  const res = await conLimite(SIMULTANEAS, resto.map((i) => () => escribir(i)));
  const rechazos: unknown[] = [];
  res.forEach((r, k) => {
    if (r.status === "rejected") {
      rechazos.push(r.reason);
      avisos.push(`No se pudo redactar «${plan[resto[k]].tipo}».`);
    }
  });
  for (const k of Array.from(secciones.keys()).filter((i) => !secciones[i])) {
    try {
      await escribir(k);
    } catch (e) {
      rechazos.push(e);
    }
  }
  if (Array.from(secciones).some((s) => !s)) throw rechazos.find((r) => r instanceof ErrorCascadaAgotada) ?? new Error("No se pudieron redactar todas las secciones.");

  // Ensamblaje
  const ensamblar = (imgs: Asset[], sinImagenes = false): LandingDoc => {
    const fijas = fijarGeneral(secciones, brief.tipo, brief);
    const base: LandingDoc = {
      version: 1,
      meta: { nombre: brief.nombre, slug: "", producto: brief.nombre, tecnicas: [], semilla, nivelConciencia: "problema", marco: "PAS", eliminadas: [], tipo: brief.tipo, tematica: brief.tematica },
      tokens,
      secciones: fijas,
      assets: imgs,
    };
    const conHeroe = sinImagenes ? base : heroeSinImagen(base);
    const e0 = entradaFalsa(brief, widgetActivo);
    const filas = filasFicha(e0, { preciosReferencia: precios });
    const sistema = plan0.delSistema.filter((t) => t !== "ficha-tecnica" || filas.length >= 4);
    const orden = ["heroe", "dato-en-vivo", "sellos-confianza", ...plan.map((p) => p.tipo), "ficha-tecnica", "creditos", "cta-fija"];
    return agregarSeccionesDelSistema(conHeroe, { entrada: e0, dato: null, hayCreditos: imgs.some((a) => a.credito && a.ruta), permitidas: plan.map((p) => p.tipo), sistema, orden, investigacion: { preciosReferencia: precios } });
  };
  // Imágenes: banco o fuente real validada con visión; si no, FLUX. Las secciones ya nombran sus slots.
  const docSinImg = ensamblar([], true);
  const slots = slotsGenerales(docSinImg);
  let assets: Asset[] = [];
  if (slots.length) {
    const e0 = entradaFalsa(brief, widgetActivo);
    const briefC = briefCompatible(brief);
    const prompts = await escribirPromptsDeImagen(e0, briefC, semillaTxt, estrategiaTxt, briefTxt, slots, d.enrutador);
    const out = await resolverImagenes(slots, prompts, e0, { enrutador: d.enrutador, flux: { dirMedia: d.dirMedia, ...d.flux }, dirMedia: d.dirMedia, candidatos, acento: tokens.colores.acento, validar: d.validar, generar: d.generar });
    assets = out.assets;
    avisos.push(...out.avisos);
  }
  let doc = ensamblar(assets);
  doc = { ...doc, meta: { ...doc.meta, slug: slugDe(brief.nombre) } };

  // 5 · Crítico y corrección dirigida
  emitir({ tipo: "etapa", etapa: "critico", mensaje: "Revisando como director creativo…" });
  const limpiar = async (x: LandingDoc): Promise<LandingDoc> => {
    if (infraccionesCorregibles(x).length === 0) return x;
    try {
      const r = await corregirListaNegra(x, { llamar: (p) => llamar(d, p), avisos });
      return aplicarCambios(x, r.cambios);
    } catch {
      return x;
    }
  };
  doc = await limpiar(doc);
  let critica: Critica | null = null;
  const umbral = d.umbral ?? UMBRAL_GENERAR;
  for (let vuelta = 1; vuelta <= (d.maxVueltas ?? 2); vuelta++) {
    try {
      const pc = promptCritico({ documento: resumirParaCritico(doc), contextoBrief: briefTxt });
      const cr = await llamar(d, { tarea: "critico", sistema: pc.sistema, usuario: pc.usuario, esquema: CriticaDelModelo, maxTokens: 3000, temperatura: 0, rapido: true, plazoMs: 420_000, sinCache: true });
      proveedores.add(cr.proveedor);
      critica = cr.datos;
      doc = { ...doc, critica };
      if (cr.datos.puntaje >= umbral || vuelta === (d.maxVueltas ?? 2)) break;
      const objetivos = [...seccionesADeCorregir(cr.datos, doc, new Set(plan.map((p) => p.tipo))).entries()].slice(0, 4);
      if (!objetivos.length) break;
      await conLimite(SIMULTANEAS, objetivos.map(([i, lineas]) => async () => {
        const j = plan.findIndex((p) => p.tipo === doc.secciones[i].tipo);
        if (j >= 0) await escribir(j, `El auditor puntuó con ${cr.datos.puntaje.toFixed(1)}. Pidió:\n${lineas.slice(0, 5).map((l) => `- ${l}`).join("\n")}`);
      }));
      doc = { ...ensamblar(assets), meta: doc.meta };
      doc = await limpiar(doc);
    } catch (e) {
      avisos.push(`El crítico no pudo evaluar: ${e instanceof Error ? e.message.split("\n")[0] : String(e)}`);
      break;
    }
  }
  if (critica) doc = { ...doc, critica };

  const { doc: final } = validarTodo(doc, briefCompatible(brief));
  const prompt: PromptEstructurado = { rol: pe.sistema.split("## TAREA")[0].replace("## ROL\n", "").trim(), tarea: `Pipeline por etapas para una landing de tipo ${brief.tipo}.`, contexto: pe.usuario, formato: `Estrategia (JSON): ${JSON.stringify(estrategia)}`, aportes: [] };
  const guardada = await d.guardar({ brief: briefCompatible(brief), tecnicas: [], prompt, doc: final, proveedor: [...proveedores][0] ?? "desconocido" });
  return { id: guardada.id, slug: guardada.slug, doc: final, brief, puntaje: critica?.puntaje ?? null, faltantes: brief.faltantes, fuentes: enrutado.fuentes, avisos };
}

/** Deja en el plan todas las obligatorias, en orden, y solo las opcionales permitidas. */
export function normalizarPlanGeneral(plan: PlanSecciones, obligatorias: TipoSeccion[], opcionales: TipoSeccion[]): SeccionPlanificada[] {
  const orden = [...obligatorias, ...opcionales];
  const por = new Map<string, SeccionPlanificada>();
  for (const s of plan.secciones) if (orden.includes(s.tipo as TipoSeccion) && !por.has(s.tipo)) por.set(s.tipo, s);
  const salida: SeccionPlanificada[] = [];
  for (const tipo of orden) {
    const s = por.get(tipo);
    if (s) salida.push(s);
    else if (obligatorias.includes(tipo)) salida.push({ tipo, variante: null, objetivoPsicologico: `Cumplir el papel de «${tipo}» en el camino de la persona.`, notasCopy: "Usa los datos del brief y la estrategia; responde la duda que esta sección debe resolver.", datoAUsar: "Datos del brief; lo que falte va como [COMPLETAR]." });
  }
  return salida;
}

/** `EntradaVitrina` mínima: solo lo que leen el ranking de medios y las secciones del sistema. */
function entradaFalsa(b: BriefGeneral, widget: Enrutado["widget"]): EntradaVitrina {
  const claves = sinTildes(`${b.nombre} ${b.propuesta}`).split(/[^a-z]+/).filter((p) => p.length > 4).slice(0, 12);
  return {
    numero: 0,
    slug: "generada",
    tematica: b.tematica === "espacio" ? "espacio" : "producto",
    brief: briefCompatible(b),
    tecnicas: [],
    numeroSemilla: 0,
    widget: widget ? { variante: widget, titulo: "En vivo", contexto: b.propuesta.slice(0, 120) } : undefined,
    bancos: b.tematica === "espacio" ? ["b1", "b3", "b4", "b5", "b7"] : [],
    claves,
    fuentes: [],
    consultas: {},
    ficha: b.datosClave.filter((x) => x.valor.length <= 60 && x.nombre.length <= 40).slice(0, 6).map((x) => ({ nombre: x.nombre, valor: x.valor })),
    textoCta: b.tipo === "producto" ? "Pídelo y paga al recibir" : b.tipo === "evento" ? "Reservar mi cupo" : b.tipo === "causa" ? "Quiero apoyar" : "Quiero empezar",
  } as EntradaVitrina;
}
