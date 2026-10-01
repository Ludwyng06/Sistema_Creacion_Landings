import { join } from "node:path";
import sharp from "sharp";
import type { Asset, MedioBanco } from "@/lib/contratos";
import { ejecutar, type DepsEnrutador } from "@/lib/ia/enrutador";
import { EleccionImagen, promptElegirImagen } from "@/lib/ia/prompts/elegir-imagen";
import { generarImagen as generarFlux, type OpcionesFlux, type Relacion } from "@/lib/imagenes/flux";
import { ErrorFuente } from "@/lib/fuentes/tipos";
import { promptFinal, type SlotVitrina } from "@/lib/vitrina/imagenes";
import { guionDeSlot, promptsDeterministas, type ContextoDeterminista } from "@/lib/vitrina/imagenes-sin-ia";
import { coincidencias, rankearMedios } from "@/lib/vitrina/medios";
import type { EntradaVitrina } from "@/lib/vitrina/tipos";
import { conLimite } from "@/lib/vitrina/pipeline";
import { ajustarAlt, altDeFuente, esSlotDeIcono } from "./slots";

// Las fuentes de imagen compiten por slot (tarea 24-A): hasta 4 candidatas de los bancos y las APIs gratuitas según la temática, más 1 generada con
// OpenAI (gpt-image-2 low) fuera de espacio o si el slot es el producto; en espacio solo si la mejor de banco saca menos de 7. Un crítico multimodal
// (`elegir-imagen`, UNA llamada por slot con miniaturas de detalle bajo) puntúa y elige. Las demás quedan como alternativas para «Cambiar imagen».
// Sin cupo de visión: fuera de espacio gana la generada; en espacio, la de banco con más coincidencia. Nunca el mismo archivo en dos slots.

export const MAX_CANDIDATAS_BANCO = 4;
export const NOTA_MINIMA_BANCO_ESPACIO = 7;
export const GENERACIONES_A_LA_VEZ = 8;
const APTITUD_MINIMA = 5;
/** Nota mínima (ya ponderada) para quedarse con una candidata: por debajo se genera o se deja la siguiente. */
const NOTA_MINIMA = 6;
/** Tope de imágenes que se generan «siempre» por landing fuera de espacio (US$ 0,012 cada una); el resto compite solo con bancos y se genera si ninguno sirve. */
export const MAX_GENERADAS_SIEMPRE = 4;

export interface SlotImagen extends SlotVitrina {
  /** Sección a la que sirve el slot (para el crítico). */
  seccion: string;
  /** El slot muestra el producto: se genera siempre, también en una landing espacial. */
  esProducto: boolean;
}

export interface Alternativa {
  ruta: string;
  fuente: string;
  credito?: string;
  licencia?: string;
  titulo: string;
  nota?: number;
  motivo?: string;
}

export interface NotaSlot {
  elegida: string;
  /** `vision`: eligió el crítico; `generada`/`palabras-clave`: respaldo sin cupo de visión; `unica`: no había con quién competir. */
  criterio: "vision" | "generada" | "palabras-clave" | "unica" | "flux";
  nota?: number;
  motivo?: string;
  /** Las candidatas del slot, con su fuente y la nota que sacó (cuántas llegaron de cada fuente: `porFuente`). */
  candidatas?: { fuente: string; titulo: string; nota?: number }[];
  porFuente?: Record<string, number>;
}

export interface ResultadoCompetencia {
  assets: Asset[];
  alternativas: Record<string, Alternativa[]>;
  notas: Record<string, NotaSlot>;
  reales: number;
  generadas: number;
  marcadores: number;
  avisos: string[];
  /** Candidatas de banco y APIs que llegaron en total, por fuente (antes de elegir los slots). */
  fuentes: Record<string, number>;
}

export interface DepsCompetencia {
  enrutador?: DepsEnrutador;
  dirMedia: string;
  flux?: Partial<OpcionesFlux>;
  /** Candidatas de bancos y APIs (pueden llegar tarde: las fuentes corren a la vez que el resto). */
  candidatos: MedioBanco[] | Promise<MedioBanco[]>;
  entrada: EntradaVitrina;
  espacial: boolean;
  contexto: ContextoDeterminista;
  /** Conteo de escenas ya pedidas en la landing (se comparte entre llamadas para no repetir). */
  escenasUsadas?: Map<string, number>;
  briefTxt: string;
  fichaTxt: string;
  acento: string;
  /** Prompts ya escritos (por IA o deterministas); los slots sin prompt usan la plantilla. */
  prompts?: Map<string, { prompt: string; alt: string }>;
  /** Se inyectan en los tests. */
  generarOpenAI?: (prompt: string, relacion: Relacion) => Promise<{ ruta: string; modelo: string }>;
  generarFlux?: (prompt: string, relacion: Relacion) => Promise<{ ruta: string }>;
  elegir?: (p: { slot: SlotImagen; miniaturas: { indice: number; origen: string; titulo: string; jpegBase64: string }[]; yaElegidas?: { slot: string; escena: string }[] }) => Promise<EleccionImagen>;
  miniatura?: (ruta: string) => Promise<string>;
  log?: (l: string) => void;
}

const sinAcentos = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const recortar = (t: string, max: number) => (t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`);
const primeraLinea = (e: unknown) => (e instanceof Error ? e.message : String(e)).split("\n")[0];

const SECCION_DE_ROL: Record<string, string> = { heroe: "héroe", galeria: "galería", problema: "problema y solución", incluye: "qué incluye", otro: "sección" };

interface Candidata {
  origen: "banco" | "generada";
  ruta: string;
  medio?: MedioBanco;
  generada?: { prompt: string; alt: string; modelo: string };
  titulo: string;
}

/** Puntaje de una candidata con los pesos de la rúbrica: la aptitud y la relevancia pesan doble. */
export function puntajeCandidata(c: EleccionImagen["candidatas"][number]): number {
  return (c.relevancia * 2 + c.calidad + c.paleta + c.aptitud * 2) / 6;
}

async function miniaturaDeArchivo(dirMedia: string, ruta: string): Promise<string> {
  const buf = await sharp(join(dirMedia, ruta.replace(/^\/media\//, "")))
    .resize(512, 512, { fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 70 })
    .toBuffer();
  return buf.toString("base64");
}

const STOP = new Set(["de", "del", "la", "el", "los", "las", "un", "una", "con", "sobre", "en", "y", "a", "al", "por", "para", "bajo", "entre"]);
const fichaDe = (t: string) => new Set(sinAcentos(t).split(/[^a-z0-9]+/).filter((p) => p.length > 2 && !STOP.has(p)));

/** Parecido (0 a 1) entre dos etiquetas de escena: palabras compartidas sobre las de la más corta. */
export function parecidoDeEscenas(a: string, b: string): number {
  const x = fichaDe(a);
  const y = fichaDe(b);
  if (!x.size || !y.size) return 0;
  let comunes = 0;
  for (const p of x) if (y.has(p)) comunes++;
  return comunes / Math.min(x.size, y.size);
}

/** Cuánto se resta a una candidata cuya escena repite la de una imagen ya elegida en otro slot. */
export const PENALIZACION_REPETIDA = 2;
const UMBRAL_REPETIDA = 0.6;
/** Slots que el crítico de imágenes evalúa a la vez: el héroe va solo y los demás en tandas, para que cada tanda conozca las ya elegidas. */
const TANDA = 4;

/** Resuelve todos los slots con la competencia entre fuentes. Nunca lanza: lo que falla queda como marcador con su aviso. */
export async function resolverConCompetencia(slotsTodos: SlotImagen[], d: DepsCompetencia): Promise<ResultadoCompetencia> {
  const log = d.log ?? (() => undefined);
  const avisos: string[] = [];
  const notas: Record<string, NotaSlot> = {};
  const alternativas: Record<string, Alternativa[]> = {};
  const usados = new Set<string>(); // rutas ya puestas en algún slot
  const usadosBanco = new Set<string>();
  const deBanco = new Map<string, number>();
  // Los slots de ícono o SVG no reciben foto: se resuelven con los íconos del sistema.
  const slots = slotsTodos.filter((s) => !esSlotDeIcono(s.slot));
  // OpenAI solo se usa si quien llama lo inyecta (http.ts y la reparación lo hacen): los tests nunca gastan cuota real.
  const hayOpenAI = d.generarOpenAI !== undefined;
  const generarOA = d.generarOpenAI ?? (async () => Promise.reject(new ErrorFuente("ia-openai", "deshabilitada", "Sin generador de OpenAI.")));
  const generarFx = d.generarFlux ?? ((prompt: string, relacion: Relacion) => generarFlux(prompt, relacion, { dirMedia: d.dirMedia, ...d.flux }));
  const miniatura = d.miniatura ?? ((ruta: string) => miniaturaDeArchivo(d.dirMedia, ruta));
  let fluxCaido = false;
  let openaiCaido = !hayOpenAI;

  const porRol = new Map<string, number>();
  const escenasUsadas = d.escenasUsadas ?? new Map<string, number>();
  const guiones = new Map<string, { prompt: string; alt: string }>();
  for (const s of slots) {
    const i = porRol.get(s.rol) ?? 0;
    porRol.set(s.rol, i + 1);
    guiones.set(s.slot, d.prompts?.get(s.slot) ?? guionDeSlot(s, d.contexto, i, escenasUsadas));
  }

  const generarDe = async (s: SlotImagen): Promise<Candidata | null> => {
    if (openaiCaido) return null;
    const g = guiones.get(s.slot)!;
    const prompt = promptFinal(g.prompt);
    try {
      const r = await generarOA(prompt, s.relacion);
      return { origen: "generada", ruta: r.ruta, generada: { prompt, alt: g.alt, modelo: r.modelo }, titulo: `Generada con IA: ${recortar(g.alt, 80)}` };
    } catch (e) {
      if (e instanceof ErrorFuente && (e.tipo === "cupo" || e.tipo === "deshabilitada" || e.tipo === "auth")) openaiCaido = true;
      avisos.push(`OpenAI no generó «${s.slot}»: ${primeraLinea(e)}`);
      return null;
    }
  };

  // Fase A: las generaciones que siempre se piden (fuera de espacio o slot del producto), hasta 4 a la vez, mientras llegan las candidatas de banco.
  const generadas = new Map<string, Candidata | null>();
  const sinCandidatas = (async () => {
    const siempre = slots.filter((s) => !d.espacial || s.esProducto).slice(0, MAX_GENERADAS_SIEMPRE);
    await conLimite(
      GENERACIONES_A_LA_VEZ,
      siempre.map((s) => async () => {
        generadas.set(s.slot, await generarDe(s));
      }),
    );
  })();

  const candidatos = await Promise.resolve(d.candidatos).catch(() => [] as MedioBanco[]);
  await sinCandidatas;
  const fuentesPool: Record<string, number> = {};
  for (const m of candidatos) fuentesPool[m.fuente] = (fuentesPool[m.fuente] ?? 0) + 1;

  interface Plan {
    s: SlotImagen;
    cands: Candidata[];
    eleccion: EleccionImagen | null;
    sinVision: boolean;
    /** Generada en paralelo apenas el crítico vio que ningún banco llegaba a 7 (espacio). */
    tarde?: Candidata | null;
  }
  const elegidasEscena: { slot: string; escena: string }[] = [];

  // Ranking de banco y crítico de un slot (una llamada), sabiendo qué se eligió ya en los otros.
  const planear = async (s: SlotImagen): Promise<Plan> => {
    const ranking = rankearMedios(s.rol, candidatos, { entrada: d.entrada, acento: d.acento, usados: usadosBanco }, deBanco).slice(0, MAX_CANDIDATAS_BANCO);
    const cands: Candidata[] = ranking.map((r) => ({ origen: "banco", ruta: r.medio.ruta, medio: r.medio, titulo: r.medio.titulo }));
    const gen = generadas.get(s.slot);
    if (gen) cands.push(gen);
    if (cands.length <= 1) return { s, cands, eleccion: null, sinVision: false };
    try {
      const miniaturas = await Promise.all(cands.map(async (c, indice) => ({ indice, origen: c.origen === "generada" ? "generada con IA" : (c.medio?.fuente ?? "banco"), titulo: c.titulo, jpegBase64: await miniatura(c.ruta) })));
      const eleccion = d.elegir ? await d.elegir({ slot: s, miniaturas, yaElegidas: [...elegidasEscena] }) : await elegirConIA(s, miniaturas, d, [...elegidasEscena]);
      let tarde: Candidata | null | undefined;
      if (d.espacial && !s.esProducto && !gen) {
        const bancoMax = Math.max(0, ...eleccion.candidatas.filter((c) => c.aptitud >= APTITUD_MINIMA && cands[c.indice]?.origen === "banco").map(puntajeCandidata));
        if (bancoMax < NOTA_MINIMA_BANCO_ESPACIO) tarde = await generarDe(s);
      }
      return { s, cands, eleccion, sinVision: false, tarde };
    } catch (e) {
      avisos.push(`Sin cupo de visión para «${s.slot}» (${primeraLinea(e)}): se elige sin crítico de imágenes.`);
      return { s, cands, eleccion: null, sinVision: true };
    }
  };

  const assets: Asset[] = [];
  // Elección de un slot, sin repetir archivo ni composición y con el respaldo de cada caso.
  const resolver = async (p: Plan) => {
    const { s } = p;
    let elegida: Candidata | null = null;
    let nota: NotaSlot | null = null;
    let altCritico: string | undefined;
    let escenaElegida: string | undefined;
    const libres = p.cands.filter((c) => !usados.has(c.ruta));
    const ev = new Map((p.eleccion?.candidatas ?? []).map((c) => [c.indice, c]));
    const resumen: NonNullable<NotaSlot["candidatas"]> = p.cands.map((c, i) => ({
      fuente: c.origen === "generada" ? "ia-openai" : (c.medio?.fuente ?? "banco"),
      titulo: recortar(c.titulo, 80),
      ...(ev.get(i) ? { nota: Math.round(puntajeCandidata(ev.get(i)!) * 10) / 10 } : {}),
    }));
    try {
      if (p.eleccion) {
        const puntuadas = p.cands
          .map((c, i) => ({ c, i, ev: ev.get(i) }))
          .filter((x) => x.ev && !usados.has(x.c.ruta) && x.ev.aptitud >= APTITUD_MINIMA)
          .map((x) => {
            const base = puntajeCandidata(x.ev!);
            const esc = x.ev!.escena ?? x.c.titulo;
            const repetida = elegidasEscena.some((y) => parecidoDeEscenas(esc, y.escena) >= UMBRAL_REPETIDA);
            return { ...x, nota: repetida ? base - PENALIZACION_REPETIDA : base, repetida };
          });
        const del = puntuadas.find((x) => x.i === p.eleccion!.elegida);
        const mejorPuntuada = [...puntuadas].sort((a, b) => b.nota - a.nota)[0];
        // Si el crítico eligió una repetida y hay otra mejor tras la penalización, gana la otra.
        const mejor = del && !del.repetida ? del : (mejorPuntuada ?? del);
        const mejorBanco = [...puntuadas].filter((x) => x.c.origen === "banco").sort((a, b) => b.nota - a.nota)[0];
        // En espacio la generada solo entra si la mejor de banco saca menos de 7 (o si es el slot del producto); la de banco con 7 o más gana siempre.
        const pedirGenerada = d.espacial && !s.esProducto && !generadas.get(s.slot) && (!mejorBanco || mejorBanco.nota < NOTA_MINIMA_BANCO_ESPACIO);
        if (pedirGenerada) {
          const g = p.tarde !== undefined ? p.tarde : await generarDe(s);
          if (g && !usados.has(g.ruta)) {
            elegida = g;
            nota = { elegida: g.ruta, criterio: "generada", motivo: `La mejor de banco sacó ${mejorBanco ? mejorBanco.nota.toFixed(1) : "—"} (< ${NOTA_MINIMA_BANCO_ESPACIO}): se generó.` };
            p.cands.push(g);
          }
        }
        if (!elegida) {
          const gana = d.espacial && !s.esProducto && mejorBanco && mejorBanco.nota >= NOTA_MINIMA_BANCO_ESPACIO ? mejorBanco : mejor;
          if (gana && gana.nota >= NOTA_MINIMA) {
            elegida = gana.c;
            altCritico = gana.ev?.alt;
            escenaElegida = gana.ev?.escena;
            const esElDelCritico = del === gana;
            nota = {
              elegida: gana.c.ruta,
              criterio: "vision",
              nota: Math.round(gana.nota * 10) / 10,
              motivo: esElDelCritico ? p.eleccion.motivo : gana === mejorBanco && d.espacial ? `En espacio gana la de banco con nota ${gana.nota.toFixed(1)} (≥ ${NOTA_MINIMA_BANCO_ESPACIO}).` : gana.repetida ? "Única apta que repite composición." : "La elegida ya estaba en otro slot, repetía composición o no era apta: se tomó la siguiente mejor.",
            };
          }
        }
      } else if (libres.length === 1 && !p.sinVision) {
        elegida = libres[0];
        nota = { elegida: libres[0].ruta, criterio: "unica" };
      } else if (libres.length > 0) {
        // Sin cupo de visión: fuera de espacio gana la generada; en espacio, la de banco con más coincidencia de palabras clave.
        const gen = libres.find((c) => c.origen === "generada");
        const banco = libres
          .filter((c) => c.origen === "banco")
          .map((c) => ({ c, hits: coincidencias(c.medio!, d.entrada.claves) }))
          .sort((a, b) => b.hits - a.hits);
        if (!d.espacial && gen) {
          elegida = gen;
          nota = { elegida: gen.ruta, criterio: "generada", motivo: "Sin crítico de imágenes: gana la generada." };
        } else if (banco.length && (banco[0].hits >= 1 || !gen)) {
          elegida = banco[0].c;
          nota = { elegida: banco[0].c.ruta, criterio: "palabras-clave", motivo: `Sin crítico de imágenes: coincide con ${banco[0].hits} palabra(s) clave (validada: false).` };
          avisos.push(`«${s.slot}»: ${elegida.medio!.fuente} aceptada sin validar con visión (validada: false).`);
        } else if (gen) {
          elegida = gen;
          nota = { elegida: gen.ruta, criterio: "generada", motivo: "Sin crítico de imágenes y sin banco que coincida: gana la generada." };
        }
      }
      // Nada que elegir: generar de último recurso (espacio sin banco apto) y, si OpenAI no puede, FLUX.
      if (!elegida) {
        const g = await generarDe(s);
        if (g && !usados.has(g.ruta)) {
          elegida = g;
          nota = { elegida: g.ruta, criterio: "generada", motivo: "Ninguna candidata de banco sirvió: se generó." };
        }
      }
      if (!elegida && !fluxCaido) {
        try {
          const g = guiones.get(s.slot)!;
          const prompt = promptFinal(g.prompt);
          const r = await generarFx(prompt, s.relacion);
          if (!usados.has(r.ruta)) {
            elegida = { origen: "generada", ruta: r.ruta, generada: { prompt, alt: g.alt, modelo: "FLUX.1-schnell" }, titulo: "Generada con FLUX" };
            nota = { elegida: r.ruta, criterio: "flux" };
          }
        } catch (e) {
          if (e instanceof ErrorFuente && (e.tipo === "cupo" || e.tipo === "deshabilitada" || e.tipo === "auth")) fluxCaido = true;
          avisos.push(`FLUX no generó «${s.slot}»: ${primeraLinea(e)}`);
        }
      }
    } catch (e) {
      // Falla por slot, no en bloque.
      avisos.push(`El slot «${s.slot}» falló y queda con su marcador: ${primeraLinea(e)}`);
    }

    const g = guiones.get(s.slot)!;
    if (elegida) {
      usados.add(elegida.ruta);
      if (elegida.medio) {
        usadosBanco.add(elegida.medio.id);
        deBanco.set(elegida.medio.bancoId, (deBanco.get(elegida.medio.bancoId) ?? 0) + 1);
      }
      const porFuente: Record<string, number> = {};
      for (const r of resumen) porFuente[r.fuente] = (porFuente[r.fuente] ?? 0) + 1;
      notas[s.slot] = { ...nota!, candidatas: resumen, porFuente };
      elegidasEscena.push({ slot: s.slot, escena: escenaElegida ?? (elegida.origen === "generada" ? g.alt : elegida.titulo) });
      // Texto alternativo específico, de 8 a 16 palabras: el del crítico (lo que de verdad se ve) y, si no, el de la escena o el de la fuente.
      const altBueno = ajustarAlt(altCritico ?? "");
      assets.push(
        elegida.origen === "generada"
          ? {
              slot: s.slot,
              tipo: "imagen",
              relacion: s.relacion,
              promptGrok: elegida.generada!.prompt,
              ruta: elegida.ruta,
              alt: altBueno ?? ajustarAlt(elegida.generada!.alt) ?? elegida.generada!.alt,
              fuente: nota?.criterio === "flux" ? "ia-flux" : "ia-openai",
              credito: nota?.criterio === "flux" ? "Imagen generada con IA (FLUX.1-schnell)" : `Imagen generada con IA (${elegida.generada!.modelo})`,
              licencia: "generada",
              generada: true,
            }
          : {
              slot: s.slot,
              tipo: "imagen",
              relacion: elegida.medio!.orientacion === "vertical" ? "4:5" : elegida.medio!.orientacion === "cuadrada" ? "1:1" : "16:9",
              promptGrok: s.esperado,
              ruta: elegida.ruta,
              alt: altBueno ?? altDeFuente(elegida.medio!.titulo, elegida.medio!.descripcion),
              fuente: elegida.medio!.fuente,
              credito: elegida.medio!.credito,
              licencia: elegida.medio!.licencia,
              ...(elegida.medio!.urlOrigen ? { urlOrigen: elegida.medio!.urlOrigen } : {}),
              bancoId: elegida.medio!.bancoId,
            },
      );
      // Las demás candidatas quedan como alternativas para «Cambiar imagen» (el editor las ofrece).
      alternativas[s.slot] = p.cands
        .map((c, i) => ({ c, e: ev.get(i) }))
        .filter((x) => x.c.ruta !== elegida!.ruta)
        .map((x) => ({
          ruta: x.c.ruta,
          fuente: x.c.origen === "generada" ? "ia-openai" : (x.c.medio?.fuente ?? "banco"),
          credito: x.c.medio?.credito,
          licencia: x.c.origen === "generada" ? "generada" : x.c.medio?.licencia,
          titulo: x.c.titulo,
          ...(x.e ? { nota: Math.round(puntajeCandidata(x.e) * 10) / 10, motivo: x.e.motivo } : {}),
        }));
      log(`  ${s.slot}: ${nota?.criterio} → ${elegida.origen}`);
    } else {
      assets.push({ slot: s.slot, tipo: "imagen", relacion: s.relacion, promptGrok: promptFinal(g.prompt), alt: g.alt });
      alternativas[s.slot] = p.cands.filter((c) => !usados.has(c.ruta)).map((c) => ({ ruta: c.ruta, fuente: c.medio?.fuente ?? "ia-openai", titulo: c.titulo }));
    }
  };

  // El héroe primero y solo; luego tandas de 3 slots a la vez: cada tanda conoce las imágenes ya elegidas y la elección sigue el orden de los slots.
  const orden = [...slots];
  const tandas: SlotImagen[][] = [];
  if (orden.length) tandas.push(orden.splice(0, 1));
  while (orden.length) tandas.push(orden.splice(0, TANDA));
  for (const tanda of tandas) {
    const planes = await Promise.all(tanda.map((s) => planear(s)));
    for (const p of planes) await resolver(p);
  }

  const conRuta = assets.filter((a) => a.ruta);
  return { assets, alternativas, notas, reales: conRuta.filter((a) => !a.generada).length, generadas: conRuta.filter((a) => a.generada).length, marcadores: assets.length - conRuta.length, avisos, fuentes: fuentesPool };
}

async function elegirConIA(s: SlotImagen, miniaturas: { indice: number; origen: string; titulo: string; jpegBase64: string }[], d: DepsCompetencia, yaElegidas: { slot: string; escena: string }[] = []): Promise<EleccionImagen> {
  const p = promptElegirImagen({ slot: s.slot, seccion: s.seccion || SECCION_DE_ROL[s.rol] || "sección", que: s.que, contextoBrief: d.briefTxt, fichaVisual: d.fichaTxt, candidatas: miniaturas.map((m) => ({ indice: m.indice, origen: m.origen, titulo: m.titulo })), yaElegidas });
  const r = await ejecutar(
    {
      tarea: "elegir-imagen",
      sistema: p.sistema,
      usuario: p.usuario,
      esquema: EleccionImagen,
      imagenes: miniaturas.map((m) => ({ mimeType: "image/jpeg", base64: m.jpegBase64 })),
      maxTokens: 1500,
      temperatura: 0,
      rapido: true,
      sinCache: true,
      plazoMs: 60_000,
    },
    d.enrutador,
  );
  return r.datos;
}

export { promptsDeterministas, sinAcentos };
