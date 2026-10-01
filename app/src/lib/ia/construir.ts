import { z } from "zod";
import {
  Asset,
  Critica,
  LandingDoc,
  Meta,
  SeccionBase,
  TIPOS_SECCION_BASE,
  type TipoSeccion,
  refinarSeccion,
  type Brief,
  type EventoConstruccion,
  type PeticionConstruir,
  type ResultadoValidador,
  type TareaIA,
  type Tokens,
  type VarianteHeroe,
} from "@/lib/contratos";
import { combinar, tecnicasEfectivas } from "@/lib/tecnicas/combinador";
import { completarIconosFaltantes } from "@/lib/tecnicas/guia-secciones";
import { BLOQUE_CONSISTENCIA, PLANTILLA_IMAGEN, tecnicaImagenes } from "@/lib/tecnicas/modulos/imagenes";
import { generarPromptCritico } from "@/lib/tecnicas/modulos/critico";
import { tecnicaHumana } from "@/lib/tecnicas/modulos/humana";
import { tirarSemilla, tokensParaBrief } from "@/lib/tecnicas/semillas";
import { describirProblemas, validarTodo } from "@/lib/validadores";
import { compactarEntrada } from "./compactar";
import { aplicarCambios, corregirListaNegra, infraccionesCorregibles } from "./corregir";
import { ejecutar, type DepsEnrutador, type PeticionIA } from "./enrutador";
import { resumirParaCritico } from "./resumen-critico";
import { rutaProtegida, textosDelDoc } from "./rutas";
import { ErrorCascadaAgotada, type ProveedorId, type ResultadoIA } from "./tipos";

// Pipeline de construcción (docs/bitacora/tarea-03-A.md §2). Toda llamada a IA pasa por el enrutador.

export interface DepsConstruir {
  /** Proveedores simulados, modo, tabla tarea → proveedor y registro de uso del enrutador. */
  enrutador?: DepsEnrutador;
  /** Modo duelo: la tarea `landing` (y sus regeneraciones) usa solo este proveedor. */
  forzarLanding?: ProveedorId;
  /**
   * Ajuste determinista del documento que sale de la IA, antes de validarlo, corregirlo y criticarlo (también en cada regeneración).
   * La vitrina lo usa para sumar las secciones que arma el sistema con datos reales y para asignar medios del banco.
   */
  transformarDoc?: (doc: LandingDoc) => LandingDoc;
}

type Emitir = (e: EventoConstruccion) => void;

// Groq a veces omite `correcciones` cuando no hay nada que corregir: se acepta como lista vacía.
const CriticaDelModelo = Critica.extend({ correcciones: z.array(z.string()).default([]) });
const LandingSinCritica = LandingDoc.omit({ critica: true });
/** Lo que se le pide al modelo: sin `tokens`, que el sistema impone (ahorra salida y entrada, sobre todo con Groq). */
/** El modelo no escribe la procedencia de los medios (fuente, crédito, licencia…): la agregan los bancos. Ahorra entrada. */
const AssetDelModelo = Asset.omit({ fuente: true, credito: true, licencia: true, urlOrigen: true, bancoId: true, generada: true });
/** Tampoco escribe `meta.fuentes` ni `meta.tematica`: las agrega la vitrina. */
const MetaDelModelo = Meta.omit({ fuentes: true, tematica: true, tipo: true });
/** Al modelo solo se le ofrecen los tipos base: las secciones nuevas (datos en vivo, agenda…) las agrega el plan del blueprint. Mantiene corto el esquema. */
const SeccionDelModelo = SeccionBase.extend({ tipo: z.enum(TIPOS_SECCION_BASE as unknown as [TipoSeccion, ...TipoSeccion[]]) }).superRefine(refinarSeccion);
export const LandingDelModeloEstricta = LandingSinCritica.omit({ tokens: true }).extend({ assets: z.array(AssetDelModelo), meta: MetaDelModelo, secciones: z.array(SeccionDelModelo).min(5).max(16) });

/** Variante que recibe un héroe cuando el modelo (Groq lo hizo) la omite: la más segura, con producto centrado. */
export const VARIANTE_HEROE_POR_DEFECTO: VarianteHeroe = "producto-monumental";

/** Pone la variante por defecto a los héroes que llegan sin ella; una variante fuera del catálogo no se toca y sigue fallando. */
export function repararVarianteHeroe(valor: unknown): unknown {
  const doc = valor as { secciones?: unknown } | null;
  if (!doc || typeof doc !== "object" || !Array.isArray(doc.secciones)) return valor;
  const secciones = doc.secciones.map((s: unknown) => {
    const seccion = s as { tipo?: unknown; variante?: unknown } | null;
    const sinVariante = seccion?.variante === undefined || seccion.variante === null || seccion.variante === "";
    return seccion && typeof seccion === "object" && seccion.tipo === "heroe" && sinVariante ? { ...seccion, variante: VARIANTE_HEROE_POR_DEFECTO } : s;
  });
  return { ...doc, secciones };
}

const LandingDelModelo = z.preprocess(repararVarianteHeroe, LandingDelModeloEstricta) as unknown as typeof LandingDelModeloEstricta;
const PromptsGrok = z.object({ assets: z.array(AssetDelModelo) });
const TextosReescritos = z.object({ textos: z.array(z.object({ ruta: z.string(), texto: z.string() })) });

export const PUNTAJE_MINIMO = 8;
export const MAX_VUELTAS_CRITICO = 2;
/** Regeneraciones de la landing cuando el esquema o la estructura quedan en rojo. */
export const MAX_REGENERACIONES = 2;
const PALABRAS_TEXTO_LARGO = 40;
/** El crítico solo puntúa: si tarda más que esto la landing se entrega con «crítico pendiente». */
export const PLAZO_CRITICO_MS = 25_000;
/** Pasado este tiempo total, el crítico hace como máximo 1 vuelta de mejora. */
export const UMBRAL_TOTAL_UNA_VUELTA_MS = 60_000;
/** Tope de salida de la tarea `landing` con Groq: prompt compacto (~4.200 tokens) + 3.300 cabe en sus 8.000 por minuto. */
export const MAX_TOKENS_LANDING_COMPACTA = 3300;
const MAX_TOKENS_CRITICO = 2000;
/** Tope de cada intento del crítico: si el primer proveedor se cuelga, al segundo le queda tiempo. */
export const PLAZO_INTENTO_CRITICO_MS = 12_000;

const palabras = (s: string) => s.split(/\s+/).filter(Boolean).length;

// ---------- Recursos visuales sin IA ----------

function paletaEnTexto(t: Tokens): string {
  const c = t.colores;
  return `background ${c.fondo}, text ${c.texto}, accent ${c.acento}`;
}

/** Prompt de Grok con la plantilla del módulo de imágenes, sin llamar a la IA. */
export function promptGrokPlantilla(brief: Brief, tokens: Tokens, asset: Asset): string {
  if (asset.tipo === "video") {
    return `6 seconds seamless loop, slow camera push-in, ${brief.nombre} in real use, soft natural light, ${paletaEnTexto(tokens)}, calm pacing, no text, no people looking at camera, no fast cuts, subtle motion suitable as website background.`;
  }
  return (
    `[SUJETO] ${brief.nombre} in real daily use, [ESCENA] realistic environment for the ${brief.categoria} category, ` +
    `[LUZ] soft natural window light, [CÁMARA] 50mm lens, eye-level, shallow depth of field, [PALETA] ${paletaEnTexto(tokens)}, ` +
    `[TEXTURA] documentary photo, natural film grain, real imperfections, ` +
    `[COMPOSICIÓN] ${asset.relacion} with clear negative space where the text will go, no text, no logos, no watermark. ${BLOQUE_CONSISTENCIA}`
  );
}

function asegurarConsistencia(a: Asset): string {
  const prompt = a.promptGrok.trim();
  return a.tipo === "imagen" && !prompt.includes(BLOQUE_CONSISTENCIA) ? `${prompt} ${BLOQUE_CONSISTENCIA}` : prompt;
}

/** Los assets de `prompts-grok` completan o reemplazan los `promptGrok` de los slots del doc. */
export function fusionarAssets(doc: LandingDoc, grok: Asset[] | null, brief: Brief, tokens: Tokens): LandingDoc {
  const usados = new Set<number>();
  const buscar = (a: Asset): Asset | undefined => {
    if (!grok) return undefined;
    let i = grok.findIndex((g, k) => !usados.has(k) && g.slot === a.slot);
    if (i === -1) i = grok.findIndex((g, k) => !usados.has(k) && g.tipo === a.tipo && g.relacion === a.relacion);
    if (i === -1) return undefined;
    usados.add(i);
    return grok[i];
  };
  const assets = doc.assets.map((a) => {
    const g = buscar(a);
    if (g) return { ...a, promptGrok: asegurarConsistencia({ ...a, promptGrok: g.promptGrok }) };
    const incompleto = !a.promptGrok.trim() || (a.tipo === "imagen" && !a.promptGrok.includes(BLOQUE_CONSISTENCIA));
    return incompleto ? { ...a, promptGrok: promptGrokPlantilla(brief, tokens, a) } : a;
  });
  return { ...doc, assets };
}

// ---------- Utilidades ----------

const unicos = (xs: string[]) => [...new Set(xs)];

function mensajeDe(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// ---------- Pipeline ----------

export async function construir(
  peticion: PeticionConstruir,
  emitir: Emitir,
  deps: DepsConstruir = {},
): Promise<void> {
  const { brief, tecnicas } = peticion;
  const avisos: string[] = [];
  const proveedores: Partial<Record<TareaIA, string>> = {};
  const inicioTotal = performance.now();

  // Groq solo tiene 8.000 tokens por minuto: si construye la landing, ninguna otra tarea compite por ese cupo
  // (el crítico, los prompts de Grok y las correcciones van a los demás proveedores) y al revés.
  let creadorActual: string | undefined = deps.forzarLanding;
  const llamar = <T>(p: PeticionIA<T>): Promise<ResultadoIA<T>> => {
    if (p.tarea === "landing" || creadorActual !== "groq") return ejecutar(p, deps.enrutador);
    const evitar = [...(Array.isArray(p.evitar) ? p.evitar : p.evitar ? [p.evitar] : []), "groq"];
    return ejecutar({ ...p, evitar }, deps.enrutador);
  };

  const { semilla } = tirarSemilla(peticion.numeroSemilla, brief.intensidad);
  const tokens = tokensParaBrief(semilla, brief);
  const efectivas = tecnicasEfectivas(tecnicas);
  const prompt = peticion.prompt ?? combinar(brief, tecnicas, semilla);
  const sistema = `${prompt.rol}\n\n${prompt.formato}`;
  const usuario = `${prompt.tarea}\n\n${prompt.contexto}`;
  const compacta = { ...compactarEntrada({ sistema, usuario }), maxTokens: MAX_TOKENS_LANDING_COMPACTA };

  /** Emite en-curso y ok/error de una tarea con proveedor y tiempo. */
  const conEventos = async <T extends { proveedor: string }>(
    tarea: TareaIA,
    fn: () => Promise<T>,
    mensaje?: string,
    emitirEventos: Emitir = emitir,
  ): Promise<T> => {
    emitirEventos({ tipo: "tarea", tarea, estado: "en-curso", ...(mensaje && { mensaje }) });
    const inicio = performance.now();
    try {
      const r = await fn();
      proveedores[tarea] = r.proveedor;
      emitirEventos({ tipo: "tarea", tarea, estado: "ok", proveedor: r.proveedor, ms: Math.round(performance.now() - inicio), ...(mensaje && { mensaje }) });
      return r;
    } catch (e) {
      emitirEventos({ tipo: "tarea", tarea, estado: "error", ms: Math.round(performance.now() - inicio), mensaje: mensajeDe(e) });
      throw e;
    }
  };

  const generarLanding = (usuarioTexto: string, evitar?: string) =>
    llamar({ tarea: "landing", sistema, usuario: usuarioTexto, esquema: LandingDelModelo, evitar, forzar: deps.forzarLanding, sinCache: true, compacta });

  const generarGrok = () =>
    llamar({
      tarea: "prompts-grok",
      sistema:
        `${tecnicaImagenes.aporta.rol}\n\nPlantilla del prompt de imagen (en inglés):\n${PLANTILLA_IMAGEN}\n\n` +
        `Bloque de consistencia (termina cada promptGrok con este texto exacto):\n${BLOQUE_CONSISTENCIA}\n\n` +
        "Entrega un objeto JSON { assets: [ { slot, tipo, relacion, promptGrok, alt } ] } con relacion 1:1, 4:5, 16:9 o 9:16 y `alt` en español.",
      usuario:
        `Brief del producto:\n${JSON.stringify(brief, null, 2)}\n\nTokens visuales:\n${JSON.stringify(tokens, null, 2)}\n\n` +
        "Declara de 3 a 6 slots (héroe, beneficios, oferta y los que aporten valor) y escribe el prompt de cada uno, con la paleta y la luz de los tokens.",
      esquema: PromptsGrok,
    });

  /** Impone los tokens y la semilla del sistema y completa los assets. */
  const preparar = (datos: z.infer<typeof LandingDelModelo>, grok: Asset[] | null): LandingDoc => {
    const doc: LandingDoc = { ...datos, tokens, meta: { ...datos.meta, semilla, tecnicas: efectivas } };
    const completo = fusionarAssets(completarIconosFaltantes(doc), grok, brief, tokens);
    return deps.transformarDoc ? deps.transformarDoc(completo) : completo;
  };

  // ----- t1: correcciones de texto (lista negra y humanizar) -----
  const refinar = async (doc: LandingDoc, emitirEventos: Emitir): Promise<LandingDoc> => {
    const corregirT1 = async (): Promise<Map<string, string>> => {
      const enviados = infraccionesCorregibles(doc);
      if (enviados.length === 0) {
        emitirEventos({ tipo: "tarea", tarea: "corregir-lista-negra", estado: "omitida", mensaje: "Sin infracciones" });
        return new Map();
      }
      const campos = new Set(enviados.map((i) => i.ruta)).size;
      try {
        const r = await conEventos(
          "corregir-lista-negra",
          async () => {
            const r = await corregirListaNegra(doc, { llamar, avisos });
            return { proveedor: r.proveedores.join(", "), cambios: r.cambios };
          },
          `${campos} campos con infracciones`,
          emitirEventos,
        );
        return r.cambios;
      } catch {
        return new Map(); // el error ya se emitió y quedó como aviso
      }
    };

    const humanizar = async (): Promise<Map<string, string>> => {
      const cambios = new Map<string, string>();
      const largos = textosDelDoc(doc).filter(
        (t) => palabras(t.texto) > PALABRAS_TEXTO_LARGO && !t.texto.includes("[COMPLETAR]") && !rutaProtegida(doc, t.ruta),
      );
      if (largos.length === 0) {
        emitirEventos({ tipo: "tarea", tarea: "humanizar", estado: "omitida", mensaje: "Sin textos largos" });
        return cambios;
      }
      const porSeccion = new Map<string, typeof largos>();
      for (const t of largos) {
        const clave = /^secciones\[\d+\]/.exec(t.ruta)![0];
        porSeccion.set(clave, [...(porSeccion.get(clave) ?? []), t]);
      }
      const usados: string[] = [];
      try {
        await conEventos(
          "humanizar",
          async () => {
            const resultados = await Promise.allSettled(
              [...porSeccion.values()].map((textos) =>
                llamar({
                  tarea: "humanizar",
                  sistema:
                    `${tecnicaHumana.aporta.rol} Reescribes textos largos de landings con la voz humana: ${tecnicaHumana.aporta.tarea![0]}\n\n` +
                    "Entrega un objeto JSON { textos: [ { ruta, texto } ] } con una entrada por cada ruta recibida; conserva cifras, precios y datos.",
                  usuario: `Reescribe cada texto con esa voz.\n${JSON.stringify(textos, null, 2)}`,
                  esquema: TextosReescritos,
                }),
              ),
            );
            const secciones = [...porSeccion.values()];
            resultados.forEach((r, k) => {
              if (r.status === "rejected") {
                avisos.push(`No se pudo humanizar una sección: ${mensajeDe(r.reason)}`);
                return;
              }
              usados.push(r.value.proveedor);
              const permitidas = new Set(secciones[k].map((t) => t.ruta));
              for (const t of r.value.datos.textos) {
                if (permitidas.has(t.ruta) && t.texto.trim()) cambios.set(t.ruta, t.texto);
              }
            });
            if (resultados.every((r) => r.status === "rejected")) throw new Error("Ninguna sección pudo humanizarse.");
            return { proveedor: unicos(usados).join(", ") };
          },
          `${largos.length} textos en ${porSeccion.size} sección(es)`,
          emitirEventos,
        );
      } catch {
        // el error ya se emitió y quedó como aviso
      }
      return cambios;
    };

    const [lista, humano] = await Promise.all([corregirT1(), humanizar()]);
    for (const ruta of lista.keys()) humano.delete(ruta); // lo corregido no se reescribe encima
    return aplicarCambios(aplicarCambios(doc, lista), humano);
  };

  // ----- t0: landing y prompts-grok en paralelo -----
  const [rLanding, rGrok] = await Promise.allSettled([
    conEventos("landing", () => generarLanding(usuario)),
    conEventos("prompts-grok", generarGrok),
  ]);

  if (rLanding.status === "rejected") {
    const e = rLanding.reason;
    if (e instanceof ErrorCascadaAgotada) emitir({ tipo: "manual", prompt: e.promptManual, intentos: e.intentos });
    else emitir({ tipo: "error", mensaje: `No se pudo generar la landing: ${mensajeDe(e)}` });
    return;
  }

  let grok: Asset[] | null = null;
  if (rGrok.status === "fulfilled") grok = rGrok.value.datos.assets;
  else avisos.push(`prompts-grok falló (${mensajeDe(rGrok.reason)}): se usó la plantilla sin IA.`);

  let creador = rLanding.value.proveedor;
  creadorActual = creador;
  let doc = preparar(rLanding.value.datos, grok);
  let validado = validarTodo(doc, brief);

  // Esquema o estructura en rojo: hasta MAX_REGENERACIONES regeneraciones, cada una con los problemas del intento anterior.
  const rojo = (salud: ResultadoValidador[], id: "esquema" | "estructura") => salud.find((s) => s.id === id)!.estado === "rojo";
  const problemasDe = (salud: ResultadoValidador[], id: "esquema" | "estructura") =>
    describirProblemas(salud.find((s) => s.id === id)!.problemas);
  for (let intento = 1; intento <= MAX_REGENERACIONES && (rojo(validado.salud, "esquema") || rojo(validado.salud, "estructura")); intento++) {
    const esquemaRojo = rojo(validado.salud, "esquema");
    const estructuraRojo = rojo(validado.salud, "estructura");
    const avisosDeLaIA = [
      ...(esquemaRojo ? [`La versión anterior no cumplió el esquema. Corrige estos errores y entrega el JSON completo:
${problemasDe(validado.salud, "esquema")}`] : []),
      ...(estructuraRojo
        ? [`La versión anterior no cumplió la estructura de la landing (héroe primero, formulario exactamente una vez, de 5 a 16 secciones). Corrige estos problemas y entrega el JSON completo:
${problemasDe(validado.salud, "estructura")}`]
        : []),
    ];
    try {
      const r = await conEventos(
        "landing",
        () => generarLanding(`${usuario}\n\n${avisosDeLaIA.join("\n\n")}`),
        `regeneración ${intento} por ${[esquemaRojo && "esquema", estructuraRojo && "estructura"].filter(Boolean).join(" y ")}`,
      );
      const candidata = validarTodo(preparar(r.datos, grok), brief);
      if (rojo(candidata.salud, "esquema") && !esquemaRojo) {
        avisos.push("La regeneración no cumplió el esquema de sus secciones; se conservó la versión anterior.");
      } else {
        creador = r.proveedor;
        creadorActual = creador;
        validado = candidata;
      }
    } catch (e) {
      if (esquemaRojo) {
        emitir({ tipo: "error", mensaje: `La landing no cumple el esquema y no se pudo regenerar: ${mensajeDe(e)}` });
        return;
      }
      avisos.push(`No se pudo regenerar la estructura (${mensajeDe(e)}); se entrega la versión anterior.`);
      break;
    }
  }
  if (rojo(validado.salud, "esquema")) {
    emitir({
      tipo: "error",
      mensaje: `La landing generada no cumple el esquema de sus secciones:
${problemasDe(validado.salud, "esquema")}`,
    });
    return;
  }
  if (rojo(validado.salud, "estructura")) avisos.push("La estructura sigue en rojo tras regenerar; revísala en el editor.");
  doc = validado.doc;

  // ----- t1 -----
  doc = await refinar(doc, emitir);

  // ----- t2: crítico, máximo 2 vueltas, se conserva la mejor versión -----
  const criticar = (d: LandingDoc, evitar: string) => {
    // Entrada resumida, salida corta, camino rápido de cada proveedor y tope de 25 s entre todos los intentos.
    const p = generarPromptCritico({ ...d, critica: undefined }, brief, resumirParaCritico(d));
    return llamar({
      tarea: "critico",
      sistema: `${p.rol}\n\n${p.formato}`,
      usuario: `${p.tarea}\n\n${p.contexto}`,
      esquema: CriticaDelModelo,
      evitar,
      maxTokens: MAX_TOKENS_CRITICO,
      rapido: true,
      plazoMs: PLAZO_CRITICO_MS,
      plazoIntentoMs: PLAZO_INTENTO_CRITICO_MS,
    });
  };

  let mejor: { doc: LandingDoc; critica?: z.infer<typeof Critica>; creador: string } = { doc, creador };
  let vueltas = 0;
  emitir({ tipo: "tarea", tarea: "critico", estado: "en-curso" });
  const inicioCritico = performance.now();
  try {
    let actual = { doc, creador };
    const primera = await criticar(actual.doc, actual.creador);
    proveedores.critico = primera.proveedor;
    let critica = primera.datos;
    mejor = { ...actual, critica };
    // Si el total ya pasó de 60 s, una sola vuelta de mejora como máximo.
    const vueltasPermitidas = () => (performance.now() - inicioTotal > UMBRAL_TOTAL_UNA_VUELTA_MS ? 1 : MAX_VUELTAS_CRITICO);
    while (critica.puntaje < PUNTAJE_MINIMO && vueltas < vueltasPermitidas()) {
      const pedido =
        `${usuario}\n\nUn auditor evaluó la versión anterior con ${critica.puntaje.toFixed(1)} de 10. ` +
        `Construye el documento completo aplicando todas estas mejoras:\n` +
        [...critica.problemas.map((p) => `- Problema: ${p}`), ...critica.correcciones.map((c) => `- Corrección: ${c}`)].join("\n");
      let siguiente: { doc: LandingDoc; creador: string };
      try {
        const r = await conEventos("landing", () => generarLanding(pedido, undefined), `vuelta ${vueltas + 1} del crítico`);
        const candidata = validarTodo(preparar(r.datos, grok), brief);
        if (rojo(candidata.salud, "esquema")) {
          avisos.push(`La vuelta ${vueltas + 1} del crítico produjo un documento inválido (${problemasDe(candidata.salud, "esquema").split("\n").slice(0, 2).join(" ")}); se conservó la mejor versión.`);
          break;
        }
        const refinada = await refinar(candidata.doc, () => {});
        siguiente = { doc: refinada, creador: r.proveedor };
      } catch (e) {
        avisos.push(`La vuelta ${vueltas + 1} del crítico falló (${mensajeDe(e)}); se conservó la mejor versión.`);
        break;
      }
      vueltas++;
      actual = siguiente;
      try {
        const rc = await criticar(actual.doc, actual.creador);
        critica = rc.datos;
        proveedores.critico = rc.proveedor;
      } catch (e) {
        avisos.push(`El crítico falló en la vuelta ${vueltas} (${mensajeDe(e)}); se conservó la mejor versión.`);
        break;
      }
      if (critica.puntaje > (mejor.critica?.puntaje ?? -1)) mejor = { ...actual, critica };
    }
    emitir({
      tipo: "tarea",
      tarea: "critico",
      estado: "ok",
      proveedor: proveedores.critico,
      ms: Math.round(performance.now() - inicioCritico),
      mensaje: `puntaje ${mejor.critica?.puntaje.toFixed(1)} tras ${vueltas} vuelta(s)`,
    });
  } catch (e) {
    avisos.push(`Crítico pendiente: el crítico no pudo evaluar la landing (${mensajeDe(e)}). Puedes volver a pedirlo desde el editor.`);
    emitir({ tipo: "tarea", tarea: "critico", estado: "error", ms: Math.round(performance.now() - inicioCritico), mensaje: mensajeDe(e) });
  }
  proveedores.landing = mejor.creador;

  // ----- t3 -----
  const final = validarTodo({ ...mejor.doc, ...(mejor.critica && { critica: mejor.critica }) }, brief);
  emitir({ tipo: "resultado", doc: final.doc, salud: final.salud, vueltasCritico: vueltas, proveedores, avisos });
}
