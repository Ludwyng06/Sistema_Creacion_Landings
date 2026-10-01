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
import { proveedoresDisponibles } from "@/lib/ia/registro";
import { ErrorCascadaAgotada, type ResultadoIA } from "@/lib/ia/tipos";
import { tokensParaBrief } from "@/lib/tecnicas/semillas";
import { HISTORIAL, MARCO_EN_META, aplicarASeccion, elegirDiversidad, huellaDeDoc, ordenarSegunDecisiones, resumenParaEvitar, type ResultadoDiversidad } from "./diversidad";
import { validarTodo } from "@/lib/validadores";
import type { OpcionesFlux, Relacion } from "@/lib/imagenes/flux";
import type { Fuentes } from "@/lib/fuentes/registro";
import { crearFuentes } from "@/lib/fuentes/registro";
import type { OpcionesEjecucion } from "@/lib/fuentes/ejecutar";
import { obtenerDatoVivo } from "@/lib/vivo";
import { conLimite, esquemaDeRedaccion, heroeSinImagen, seccionesADeCorregir } from "@/lib/vitrina/pipeline";
import { slotsDelDoc, type RolSlot } from "@/lib/vitrina/medios";
import { EJEMPLO_POR_TIPO } from "@/secciones/ejemplos-por-tipo";
import { consultasDeBanco, palabrasClave } from "@/lib/vitrina/imagenes-sin-ia";
import { resolverConCompetencia, type Alternativa, type DepsCompetencia, type NotaSlot, type SlotImagen } from "./imagenes-competencia";
import { agregarSeccionesDelSistema, filasFicha, widgetDeVariante } from "@/lib/vitrina/plan";
import type { EntradaVitrina } from "@/lib/vitrina/tipos";
import { BLUEPRINTS, planBlueprint } from "./blueprints";
import { enrutarFuentes, type Enrutado } from "./fuentes";
import { ejecutarIntake } from "./intake";
import type { AlmacenCheckpoint, EtapaCheckpoint } from "./checkpoint";
import { ejemploDeSeccion } from "@/lib/ia/prompts/seccion";
import { esSlotDeIcono } from "./slots";

// Pipeline genérico por tipo de landing (tarea-16 §16-A.4): intake → fuentes → estrategia → plan → redacción por sección → imágenes → crítico.
// Emite los eventos que consume /crear (forma de `EventoGenerar` de la 16-B).

export type Etapa = "intake" | "fuentes" | "estrategia" | "redaccion" | "critico";

export type EventoGenerar =
  | { tipo: "etapa"; etapa: Etapa; mensaje: string; n?: number; total?: number; /** Varias etapas corren a la vez: `inicio` cuando empieza y `fin` cuando termina (opcional, compatible con lo anterior). */ estado?: "inicio" | "fin" }
  | { tipo: "faltantes"; faltantes: { clave: string; pregunta: string }[]; detectado?: { tipo: string; tematica?: string } }
  | { tipo: "listo"; id: string; slug?: string; /** `true` si el crítico no pudo evaluar (cuota): la landing se entrega sin nota y se reintenta con `POST /api/landings/[id]/critico`. */ criticoPendiente?: boolean; /** Secciones que quedaron con su ejemplo y [COMPLETAR]. */ seccionesPorCompletar?: string[]; avisos?: string[] }
  | { tipo: "error"; mensaje: string };

export const UMBRAL_GENERAR = 8;
const SIMULTANEAS = 3;
/** Secciones a la vez cuando OpenAI es el primero de la cascada (500 RPM y 200K TPM de la cuenta). */
export const SIMULTANEAS_OPENAI = 6;

export function simultaneasPara(e?: DepsEnrutador, openai = SIMULTANEAS_OPENAI): number {
  const lista = e?.proveedores ?? proveedoresDisponibles(e?.env ?? process.env);
  return lista[0]?.id === "openai" ? openai : SIMULTANEAS;
}

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
  /** Actualiza la landing ya guardada. Si existe, la landing se guarda antes del crítico y el crítico solo la completa. */
  actualizar?: (id: string, doc: LandingDoc) => Promise<void>;
  /** Checkpoint por etapa (para retomar el crítico desde el visor). */
  checkpoint?: AlmacenCheckpoint;
  /** Documentos de las últimas landings guardadas, la más reciente primero (para no repetir semilla, héroe ni estructura). */
  historial?: () => Promise<LandingDoc[]>;
  /** Genera una imagen con OpenAI (gpt-image-2 low); en producción lo pone `http.ts`. Sin él no se generan imágenes con OpenAI. */
  generarOpenAI?: (prompt: string, relacion: Relacion) => Promise<{ ruta: string; modelo: string }>;
  /** Crítico de imágenes (tarea `elegir-imagen`); por defecto una llamada por slot al enrutador. */
  elegirImagen?: DepsCompetencia["elegir"];
  /** Modo de razonamiento y temperatura del texto con OpenAI (por defecto `low`; también `GENERAR_MODO_TEXTO`). */
  modoTexto?: ModoTexto;
  /** Tope de espera de la investigación antes de arrancar la estrategia (8 s por defecto). */
  esperaInvestigacionMs?: number;
  /** Log de tiempos por etapa («generar: etapa X ms»); por defecto `console.info`. */
  log?: (linea: string) => void;
  /** Fuente de azar de la semilla; los tests la inyectan para que sea reproducible. */
  azar?: () => number;
  ahora?: () => Date;
  maxVueltas?: number;
  umbral?: number;
}

/**
 * Cómo se redacta con OpenAI (24-A entrega 2):
 *  - `low`: razonamiento «low» y sin `temperature` en estrategia, plan, redacción y crítico; la diversidad sale de la semilla y la huella;
 *  - `none-0.7`: «low» en estrategia y plan y «none» con `temperature` 0,7 solo en la redacción.
 */
export type ModoTexto = "low" | "none-0.7";
export const MODO_TEXTO_POR_DEFECTO: ModoTexto = "low";
export const TEMPERATURA_REDACCION = 0.7;

function modoTextoDe(d: DepsGenerar): ModoTexto {
  const env = (d.enrutador?.env ?? process.env).GENERAR_MODO_TEXTO;
  return d.modoTexto ?? (env === "low" || env === "none-0.7" ? env : MODO_TEXTO_POR_DEFECTO);
}

function creativaPara(e: DepsEnrutador | undefined, modo: ModoTexto): number | undefined {
  return modo === "none-0.7" && (e?.proveedores ?? proveedoresDisponibles(e?.env ?? process.env))[0]?.id === "openai" ? TEMPERATURA_REDACCION : undefined;
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

const SECCION_DE_ROL: Record<string, string> = { heroe: "héroe", galeria: "galería", problema: "problema y solución", incluye: "qué incluye", otro: "sección" };

/** Slots de imagen (con su relación, lo que deben mostrar y si son el producto) a partir de los pedidos `{ slot, rol }`. */
export function slotsDeDoc(pedidos: { slot: string; rol: string }[], brief: BriefGeneral): SlotImagen[] {
  return pedidos.slice(0, 8).map(({ slot, rol }) => {
    const relacion: Relacion = rol === "heroe" || rol === "problema" ? "16:9" : "1:1";
    return {
      slot,
      rol: rol as RolSlot,
      origen: "banco" as const,
      relacion,
      seccion: SECCION_DE_ROL[rol] ?? "sección",
      esProducto: brief.tipo === "producto" && rol === "heroe",
      que: `imagen para el lugar «${slot}» de la landing «${brief.nombre}», sin personas`,
      esperado: `una imagen relacionada con ${brief.nombre} (${slot.replace(/-/g, " ")}), sin texto, logos ni personas identificables`,
    };
  });
}

/**
 * Los slots salen del blueprint, no de la redacción: se leen de los ejemplos de cada tipo de sección y el héroe usa `heroe-imagen`
 * (salvo `problema-primero`, que no lleva imagen). Así las imágenes corren mientras se escribe el texto.
 */
export function slotsDeBlueprint(tipos: TipoSeccion[], brief: BriefGeneral, heroe: string): { slots: SlotImagen[]; porSeccion: Map<string, string[]> } {
  const porSeccion = new Map<string, string[]>();
  const pedidos: { slot: string; rol: string }[] = [];
  for (const tipo of tipos) {
    const ej = EJEMPLO_POR_TIPO[tipo];
    if (!ej) continue;
    const seccion = tipo === "heroe" ? { ...ej, variante: heroe, ajustes: { ...ej.ajustes, slot: heroe === "problema-primero" ? undefined : "heroe-imagen", slots: undefined } } : ej;
    const slots = slotsDelDoc({ secciones: [seccion] } as unknown as LandingDoc);
    porSeccion.set(tipo, slots.map((x) => x.slot));
    for (const x of slots) if (!esSlotDeIcono(x.slot) && !pedidos.some((p) => p.slot === x.slot)) pedidos.push(x);
  }
  return { slots: slotsDeDoc(pedidos, brief), porSeccion };
}

/** Hero válido y con el slot de imagen fijado por el sistema; las fotos de personas nunca se generan. */
export function fijarGeneral(secciones: Seccion[], tipo: BriefGeneral["tipo"], brief: BriefGeneral, heroeDecidido?: string): Seccion[] {
  const bp = BLUEPRINTS[tipo];
  return secciones.map((s) => {
    if (s.tipo === "heroe") {
      const pedida = heroeDecidido ?? (s.variante && bp.heroes.includes(s.variante) ? s.variante : bp.heroes[0]);
      const variante = (VARIANTES_HEROE as readonly string[]).includes(pedida) ? pedida : "producto-monumental";
      const { slots: _s, ...aj } = s.ajustes as Record<string, unknown>;
      void _s;
      return { ...s, variante, ajustes: { ...aj, ...(variante === "problema-primero" ? {} : { slot: "heroe-imagen" }) }, efectos: s.efectos ?? ["boton-magnetico"] };
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
  /** Cómo salió la diversidad: huella, intentos y distancia mínima contra las últimas 12. */
  diversidad: ResultadoDiversidad;
  fuentes: string[];
  avisos: string[];
  /** El crítico no evaluó: la landing quedó sin nota y se puede reintentar. */
  criticoPendiente: boolean;
  seccionesPorCompletar: string[];
  /** Milisegundos por etapa y total. */
  tiempos: Record<string, number>;
  /** Cómo se eligió la imagen de cada slot y las alternativas que quedaron. */
  imagenes: { notas: Record<string, NotaSlot>; alternativas: Record<string, Alternativa[]>; /** Candidatas de banco y APIs que llegaron, por fuente. */ fuentes: Record<string, number> };
}

const CLAVES_TECNICAS = /^(id|tipo|slot|variante|icono|icon|imagen|href|url|enlace|moneda|estilo|tono|alineacion|posicion|layout|modo|forma|color|widget)/i;
const CLAVES_TITULO = /^(titular|titulo|subtitulo|texto|cuerpo|descripcion|lema)$/i;

/** Copia del ejemplo del tipo con lo que podría pasar por dato del brief (cifras, fechas, precios) reemplazado por [COMPLETAR] y los títulos marcados. */
export function marcarCompletar(valor: unknown, clave = ""): unknown {
  if (typeof valor === "string") {
    if (CLAVES_TECNICAS.test(clave) || /^[a-z0-9_-]+$/.test(valor)) return valor;
    if (/\d/.test(valor)) return "[COMPLETAR]";
    return CLAVES_TITULO.test(clave) && !valor.includes("[COMPLETAR]") ? `[COMPLETAR] ${valor}` : valor;
  }
  if (Array.isArray(valor)) return valor.map((v) => marcarCompletar(v, clave));
  if (valor && typeof valor === "object") return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, marcarCompletar(v, k)]));
  return valor;
}

/** La sección que ningún proveedor pudo redactar: su ejemplo del catálogo, marcado [COMPLETAR]. */
export function seccionDeEjemplo(tipo: TipoSeccion, plan: SeccionPlanificada): Seccion {
  const ej = ejemploDeSeccion(tipo);
  const marcado = marcarCompletar(ej ?? { ajustes: {}, bloques: [] }) as NonNullable<ReturnType<typeof ejemploDeSeccion>>;
  return {
    id: tipo,
    tipo,
    ...(tipo === "heroe" ? { variante: plan.variante ?? undefined } : {}),
    visible: true,
    intencion: { objetivo: plan.objetivoPsicologico },
    ajustes: marcado.ajustes,
    bloques: marcado.bloques.map((b, i) => ({ id: `${tipo}-${i + 1}`, tipo: b.tipo, ajustes: b.ajustes })),
    animacion: { entrada: "subir", retraso: 0 },
  } as Seccion;
}

const primeraLinea = (e: unknown) => (e instanceof Error ? e.message : String(e)).split("\n")[0];

/** Pide la nota del crítico para un documento; lanza si ningún proveedor responde (el que llama decide qué hacer). */
export async function pedirCritica(doc: LandingDoc, briefTxt: string, enrutador?: DepsEnrutador): Promise<{ critica: Critica; proveedor: string }> {
  const pc = promptCritico({ documento: resumirParaCritico(doc), contextoBrief: briefTxt });
  const cr = await ejecutar({ tarea: "critico", sistema: pc.sistema, usuario: pc.usuario, esquema: CriticaDelModelo, maxTokens: 3000, temperatura: 0, rapido: true, plazoMs: 420_000, sinCache: true }, enrutador);
  return { critica: cr.datos, proveedor: cr.proveedor };
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

  // El resto corre como un grafo: cada paso empieza apenas tiene lo que necesita (tarea 24-A, «todo en simultáneo»).
  const tiempos: Record<string, number> = {};
  const inicioTotal = Date.now();
  const fase = async <T>(nombre: string, f: () => Promise<T>): Promise<T> => {
    const t0 = Date.now();
    try {
      return await f();
    } finally {
      tiempos[nombre] = Date.now() - t0;
      (d.log ?? ((l: string) => console.info(l)))(`generar: etapa ${nombre} ${tiempos[nombre]} ms`);
    }
  };
  const etapa = (e: Etapa, mensaje: string, estado: "inicio" | "fin" = "inicio") => emitir({ tipo: "etapa", etapa: e, mensaje, estado });

  // Fuentes, investigación y datos en vivo (arrancan ya; la estrategia espera lo que haya en 8 s)
  const enrutado = enrutarFuentes({ tipo: brief.tipo, tematica: brief.tematica, descripcion: encargo.descripcion });
  const fuentes = d.fuentes ?? crearFuentes();
  let precios: { titulo: string; precio: number }[] = [];
  const widgetActivo = enrutado.widget;
  etapa("fuentes", "Buscando datos e imágenes…");
  const fuentesP = fase("fuentes", async () => {
    const consultasDeBancos = consultasDeBanco(brief.nombre, [brief.propuesta, encargo.descripcion], brief.tematica);
    const [, , candidatos] = await Promise.all([
      (async () => {
        if (!enrutado.widget) return;
        const dato = await obtenerDatoVivo(widgetDeVariante(enrutado.widget), { fuentes, ahora: d.ahora }).catch(() => null);
        if (!dato) avisos.push(`El dato en vivo «${enrutado.widget}» no respondió: la sección se oculta sola.`);
      })(),
      (async () => {
        if (!(enrutado.fuentes.includes("serpapi-shopping") && fuentes.serpapiShopping.habilitada())) return;
        try {
          const { consultarSuave } = await import("@/lib/fuentes/ejecutar");
          const r = await consultarSuave(fuentes.serpapiShopping, { q: brief.nombre, max: 8 }, d.ejecucion ?? {});
          precios = (r?.datos ?? []).map((p) => ({ titulo: p.titulo.slice(0, 80), precio: p.precio }));
        } catch {
          avisos.push("Google Shopping no respondió.");
        }
      })(),
      // Candidatas de bancos y APIs gratuitas por palabras clave del brief (sin IA), de varias consultas a la vez.
      (async () => {
        const lotes = await Promise.all([brief.nombre, ...consultasDeBancos].slice(0, 4).map((q) => (d.candidatos?.(q, enrutado) ?? Promise.resolve([] as MedioBanco[])).catch(() => [] as MedioBanco[])));
        const visto = new Set<string>();
        return lotes.flat().filter((m) => (visto.has(m.id) ? false : (visto.add(m.id), true)));
      })(),
    ]);
    etapa("fuentes", "Buscando datos e imágenes…", "fin");
    return candidatos;
  });
  const candidatosP = fuentesP.catch(() => [] as MedioBanco[]);

  const bp = BLUEPRINTS[brief.tipo];
  const plan0 = planBlueprint(brief.tipo, brief, widgetActivo !== null);
  // Diversidad: semilla al azar, sin repetir paleta, tipografía ni héroe de las últimas 4 y a ≥ 0,5 de huella de las últimas 12.
  const previos = await (d.historial?.() ?? Promise.resolve([] as LandingDoc[])).catch(() => [] as LandingDoc[]);
  const diversidad = elegirDiversidad({ tipo: brief.tipo, obligatorias: plan0.obligatorias, opcionales: plan0.opcionales, delSistema: plan0.delSistema, historial: previos.slice(0, HISTORIAL).map(huellaDeDoc) }, d.azar);
  const dec = diversidad.decisiones;
  const semilla = dec.semilla;
  const tokens = tokensParaBrief(semilla, { intensidad: dec.tokens.intensidad, coloresMarca: undefined });
  if (diversidad.agotado) avisos.push("La diversidad no alcanzó todas las reglas en 20 intentos: se usó la tirada que menos se parece a las últimas landings.");
  const briefTxt = textoBriefGeneral(brief);
  const semillaTxt = textoSemilla(semilla, tokens);
  const creativa = creativaPara(d.enrutador, modoTextoDe(d));

  // Imágenes: los slots salen del blueprint (no de la redacción) y los prompts, de la plantilla; corren mientras se escribe todo lo demás.
  const espacial = brief.tematica === "espacio";
  const tiposIA = [...new Set([...dec.orden, ...plan0.obligatorias])] as TipoSeccion[];
  const { slots: slotsBlueprint, porSeccion: slotsPorSeccion } = slotsDeBlueprint(tiposIA, brief, dec.heroe);
  const entradaImg = entradaFalsa(brief, widgetActivo);
  const contextoImg = { nombre: brief.nombre, descripcion: brief.propuesta, tematica: brief.tematica, tipo: brief.tipo, colores: { fondo: tokens.colores.fondo, acento: tokens.colores.acento } };
  const escenasUsadas = new Map<string, number>();
  const resolverSlots = (slots: SlotImagen[], candidatos: MedioBanco[] | Promise<MedioBanco[]>) =>
    resolverConCompetencia(slots, {
      enrutador: d.enrutador,
      dirMedia: d.dirMedia,
      flux: d.flux,
      candidatos,
      entrada: entradaImg,
      espacial,
      contexto: contextoImg,
      escenasUsadas,
      briefTxt,
      fichaTxt: semillaTxt,
      acento: tokens.colores.acento,
      generarOpenAI: d.generarOpenAI,
      generarFlux: d.generar,
      elegir: d.elegirImagen,
    });
  const imagenesP = fase("imagenes", () => resolverSlots(slotsBlueprint, candidatosP)).then(
    (r) => (etapa("fuentes", "Buscando y generando imágenes…", "fin"), r),
    (e) => {
      avisos.push(`Las imágenes no se pudieron resolver (${primeraLinea(e)}): quedaron los marcadores.`);
      return null;
    },
  );

  // 3 · Estrategia (espera lo que haya de la investigación, con tope de 8 s)
  etapa("estrategia", "Definiendo la estrategia…");
  const estrategiaP = fase("estrategia", async () => {
    let esperaCorta: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([candidatosP, new Promise((r) => (esperaCorta = setTimeout(r, d.esperaInvestigacionMs ?? 8000)))]);
    clearTimeout(esperaCorta);
    const inv = precios.length ? `Precios de referencia en tiendas (Google Shopping CO; solo comparan, nunca se copian):\n${precios.map((p) => `- ${p.titulo}: $${p.precio.toLocaleString("es-CO")}`).join("\n")}` : "";
    const pe = promptEstrategia({ contextoBrief: briefTxt, contextoInvestigacion: inv, contextoSemilla: [semillaTxt, `Marco de copy sugerido para esta landing: ${dec.marco}.`, resumenParaEvitar(previos)].filter(Boolean).join("\n\n"), enfoque: brief.tipo === "producto" ? undefined : { tipo: brief.tipo, conversion: bp.conversion, verbo: bp.verbo } });
    const re = await llamar(d, { tarea: "estrategia", sistema: pe.sistema, usuario: pe.usuario, esquema: Estrategia, maxTokens: 3500, temperatura: 0.4 });
    return { re, pe, inv };
  });
  const { re, pe, inv: invTxt } = await estrategiaP;
  etapa("estrategia", "Definiendo la estrategia…", "fin");
  proveedores.add(re.proveedor);
  const estrategia = re.datos;
  const estrategiaTxt = textoEstrategia(estrategia);

  // Plan de secciones (blueprint del tipo)
  const plan = await fase("plan", async () => {
    const pp = promptPlan({ contextoBrief: briefTxt, contextoEstrategia: estrategiaTxt, contextoInvestigacion: invTxt, obligatorias: plan0.obligatorias, opcionales: plan0.opcionales, delSistema: plan0.delSistema, variantesHeroe: [dec.heroe], espacial });
    const rp = await llamar(d, { tarea: "plan-secciones", sistema: pp.sistema, usuario: pp.usuario, esquema: PlanSecciones, maxTokens: 3000, temperatura: 0.3 });
    proveedores.add(rp.proveedor);
    return ordenarSegunDecisiones(normalizarPlanGeneral(rp.datos, plan0.obligatorias, plan0.opcionales), dec.orden).map((s) => (s.tipo === "heroe" ? { ...s, variante: dec.heroe } : s));
  });

  // 4 · Redacción: TODAS las secciones a la vez (héroe incluido; con OpenAI hasta 8), mientras siguen las imágenes
  const titulares: string[] = [];
  const secciones: Seccion[] = new Array(plan.length);
  let hechas = 0;
  const escribir = async (i: number, correccion?: string) => {
    const tipo = plan[i].tipo as TipoSeccion;
    const slotsDeLaSeccion = (slotsPorSeccion.get(tipo) ?? []).map((slot) => ({ slot, que: `imagen para «${slot}»` }));
    const entrada = { tipo, plan: plan[i], contextoBrief: briefTxt, contextoEstrategia: estrategiaTxt, contextoInvestigacion: invTxt, titularesPrevios: titulares, slots: slotsDeLaSeccion, correccion };
    const comp = promptSeccion(entrada);
    const compacto = promptSeccion({ ...entrada, compacto: true });
    const r = await llamar(d, { tarea: "redactar-seccion", sistema: comp.sistema, usuario: comp.usuario, esquema: esquemaDeRedaccion(tipo), maxTokens: 2500, temperatura: creativa ?? 0.5, evitar: i % 2 === 1 ? "gemini" : undefined, compacta: { sistema: compacto.sistema, usuario: compacto.usuario, maxTokens: 1800 }, ...(correccion ? { sinCache: true } : {}) });
    proveedores.add(r.proveedor);
    secciones[i] = aplicarASeccion({
      id: tipo,
      tipo,
      ...(tipo === "heroe" ? { variante: plan[i].variante ?? undefined } : {}),
      visible: true,
      intencion: { objetivo: plan[i].objetivoPsicologico },
      ajustes: r.datos.ajustes,
      bloques: r.datos.bloques.map((b) => ({ id: b.id, tipo: b.tipo, ajustes: b.ajustes })),
      animacion: { entrada: "subir", retraso: 0 },
    }, dec);
    const t = (r.datos.ajustes as { titular?: unknown; titulo?: unknown }).titular ?? (r.datos.ajustes as { titulo?: unknown }).titulo;
    if (typeof t === "string") titulares.push(t);
    if (!correccion) emitir({ tipo: "etapa", etapa: "redaccion", mensaje: `Escribiendo sección ${++hechas}/${plan.length}…`, n: hechas, total: plan.length });
  };
  etapa("redaccion", `Escribiendo sección 0/${plan.length}…`);
  const rechazos: unknown[] = [];
  await fase("redaccion", async () => {
    const res = await conLimite(simultaneasPara(d.enrutador, 8), plan.map((_, i) => () => escribir(i)));
    res.forEach((r, k) => {
      if (r.status === "rejected") {
        rechazos.push(r.reason);
        avisos.push(`No se pudo redactar «${plan[k].tipo}».`);
      }
    });
    for (const k of Array.from(secciones.keys()).filter((i) => !secciones[i])) {
      try {
        await escribir(k);
      } catch (e) {
        rechazos.push(e);
      }
    }
  });
  // Sin proveedor para una sección (cuota agotada en todos): queda con su ejemplo y [COMPLETAR], y la landing se entrega igual.
  const seccionesPorCompletar: string[] = [];
  for (const k of Array.from(secciones.keys()).filter((i) => !secciones[i])) {
    const tipo = plan[k].tipo as TipoSeccion;
    secciones[k] = aplicarASeccion(seccionDeEjemplo(tipo, plan[k]), dec);
    seccionesPorCompletar.push(tipo);
    emitir({ tipo: "etapa", etapa: "redaccion", mensaje: `Escribiendo sección ${++hechas}/${plan.length}…`, n: Math.min(hechas, plan.length), total: plan.length });
  }
  if (seccionesPorCompletar.length) avisos.push(`Ningún proveedor pudo redactar ${seccionesPorCompletar.map((t) => `«${t}»`).join(", ")} (${primeraLinea(rechazos.find((r) => r instanceof ErrorCascadaAgotada) ?? rechazos[0] ?? "sin proveedor")}): quedaron con su ejemplo y [COMPLETAR].`);
  etapa("redaccion", `Escribiendo sección ${plan.length}/${plan.length}…`, "fin");

  // Ensamblaje
  const ensamblar = (imgs: Asset[], sinImagenes = false): LandingDoc => {
    const fijas = fijarGeneral(secciones, brief.tipo, brief, dec.heroe);
    const base: LandingDoc = {
      version: 1,
      meta: { nombre: brief.nombre, slug: "", producto: brief.nombre, tecnicas: [], semilla, nivelConciencia: estrategia.nivelConciencia, marco: MARCO_EN_META[dec.marco], eliminadas: [], tipo: brief.tipo, tematica: brief.tematica },
      tokens,
      secciones: fijas,
      assets: imgs,
    };
    const conHeroe = sinImagenes ? base : heroeSinImagen(base);
    const e0 = entradaFalsa(brief, widgetActivo);
    const filas = filasFicha(e0, { preciosReferencia: precios });
    const sistema = plan0.delSistema.filter((t) => t !== "ficha-tecnica" || filas.length >= 4);
    const orden = ["heroe", "dato-en-vivo", "sellos-confianza", ...plan.map((p) => p.tipo), "ficha-tecnica", "creditos", "cta-fija"];
    const completo = agregarSeccionesDelSistema(conHeroe, { entrada: e0, dato: null, hayCreditos: imgs.some((a) => a.credito && a.ruta), permitidas: plan.map((p) => p.tipo), sistema, orden, investigacion: { preciosReferencia: precios } });
    // Las del sistema (sellos, ficha, créditos, botón fijo) también varían de variante y de entrada.
    return { ...completo, secciones: completo.secciones.map((s) => (plan.some((p) => p.tipo === s.tipo) || s.tipo === "heroe" ? s : aplicarASeccion(s, dec))) };
  };
  // Las imágenes ya corrían desde el intake: aquí solo se esperan y se completan los slots que la redacción nombró distinto.
  const resultadoImg = await imagenesP;
  let assets: Asset[] = resultadoImg?.assets ?? [];
  const alternativas: Record<string, Alternativa[]> = { ...(resultadoImg?.alternativas ?? {}) };
  const notasImagenes: Record<string, NotaSlot> = { ...(resultadoImg?.notas ?? {}) };
  const fuentesImagenes: Record<string, number> = { ...(resultadoImg?.fuentes ?? {}) };
  if (resultadoImg) avisos.push(...resultadoImg.avisos);
  const docSinImg = ensamblar([], true);
  const faltantes = slotsDelDoc(docSinImg).filter(({ slot }) => !esSlotDeIcono(slot) && !assets.some((a) => a.slot === slot));
  if (faltantes.length) {
    try {
      const extra = await fase("imagenes-extra", () => resolverSlots(slotsDeDoc(faltantes, brief), candidatosP));
      assets = [...assets, ...extra.assets];
      Object.assign(alternativas, extra.alternativas);
      Object.assign(notasImagenes, extra.notas);
      for (const [f, n] of Object.entries(extra.fuentes)) fuentesImagenes[f] = Math.max(fuentesImagenes[f] ?? 0, n);
      avisos.push(...extra.avisos);
    } catch (e) {
      avisos.push(`Imágenes extra sin resolver (${primeraLinea(e)}).`);
    }
  }
  let doc = ensamblar(assets);
  doc = { ...doc, meta: { ...doc.meta, slug: slugDe(brief.nombre) } };

  // 5 · Crítico y corrección dirigida. Todo lo posterior a la redacción es degradable: si falla, la landing se guarda igual.
  const limpiar = async (x: LandingDoc): Promise<LandingDoc> => {
    if (infraccionesCorregibles(x).length === 0) return x;
    try {
      const r = await corregirListaNegra(x, { llamar: (p) => llamar(d, p), avisos });
      return aplicarCambios(x, r.cambios);
    } catch {
      return x;
    }
  };
  try {
    doc = await limpiar(doc);
  } catch (e) {
    avisos.push(`La limpieza de lista negra no corrió: ${primeraLinea(e)}`);
  }
  const umbral = d.umbral ?? UMBRAL_GENERAR;
  const prompt: PromptEstructurado = { rol: pe.sistema.split("## TAREA")[0].replace("## ROL\n", "").trim(), tarea: `Pipeline por etapas para una landing de tipo ${brief.tipo}.`, contexto: pe.usuario, formato: `Estrategia (JSON): ${JSON.stringify(estrategia)}`, aportes: [] };
  let guardada: { id: string; slug: string } | null = null;
  const guardarDoc = async (x: LandingDoc, criticoPendiente: boolean, etapa: EtapaCheckpoint): Promise<LandingDoc> => {
    const { doc: valido } = validarTodo(x, briefCompatible(brief));
    if (!guardada) guardada = await d.guardar({ brief: briefCompatible(brief), tecnicas: [], prompt, doc: valido, proveedor: [...proveedores][0] ?? "desconocido" });
    else await d.actualizar?.(guardada.id, valido);
    try {
      await d.checkpoint?.escribir(guardada.id, { etapa, criticoPendiente, briefTxt, umbral, avisos: [...avisos], seccionesPorCompletar, actualizadoEn: new Date().toISOString(), tiempos: { ...tiempos, total: Date.now() - inicioTotal }, imagenes: { notas: notasImagenes, alternativas } });
    } catch {
      // el checkpoint nunca tumba la entrega
    }
    return valido;
  };
  // Con `actualizar`, la landing queda guardada ANTES del crítico: una cuota agotada ya no la pierde.
  if (d.actualizar) await guardarDoc(doc, true, "imagenes");
  emitir({ tipo: "etapa", etapa: "critico", mensaje: "Revisando como director creativo…" });
  let critica: Critica | null = null;
  for (let vuelta = 1; vuelta <= (d.maxVueltas ?? 2); vuelta++) {
    try {
      const cr = await pedirCritica(doc, briefTxt, d.enrutador);
      proveedores.add(cr.proveedor);
      critica = cr.critica;
      doc = { ...doc, critica };
      if (critica.puntaje >= umbral || vuelta === (d.maxVueltas ?? 2)) break;
      const objetivos = [...seccionesADeCorregir(critica, doc, new Set(plan.map((p) => p.tipo))).entries()].slice(0, 4);
      if (!objetivos.length) break;
      const puntaje = critica.puntaje;
      await conLimite(simultaneasPara(d.enrutador), objetivos.map(([i, lineas]) => async () => {
        const j = plan.findIndex((p) => p.tipo === doc.secciones[i].tipo);
        if (j >= 0) await escribir(j, `El auditor puntuó con ${puntaje.toFixed(1)}. Pidió:\n${lineas.slice(0, 5).map((l) => `- ${l}`).join("\n")}`);
      }));
      doc = { ...ensamblar(assets), meta: doc.meta };
      doc = await limpiar(doc);
    } catch (e) {
      avisos.push(`El crítico no pudo evaluar: ${primeraLinea(e)}`);
      break;
    }
  }
  if (critica) doc = { ...doc, critica };
  else avisos.push("Crítico pendiente: la landing se entregó sin nota. Se reintenta desde el visor (POST /api/landings/[id]/critico).");

  const final = await guardarDoc(doc, critica === null, "critico");
  const g = guardada as { id: string; slug: string } | null;
  if (!g) throw new Error("La landing no se guardó.");
  return { id: g.id, slug: g.slug, doc: final, brief, puntaje: critica?.puntaje ?? null, faltantes: brief.faltantes, diversidad, fuentes: enrutado.fuentes, avisos, criticoPendiente: critica === null, seccionesPorCompletar, tiempos: { ...tiempos, total: Date.now() - inicioTotal }, imagenes: { notas: notasImagenes, alternativas, fuentes: fuentesImagenes } };
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
  const claves = [...new Set([...sinTildes(`${b.nombre} ${b.propuesta}`).split(/[^a-z]+/).filter((p) => p.length > 4).slice(0, 12), ...palabrasClave([b.nombre, b.propuesta], b.tematica)])].slice(0, 30);
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
