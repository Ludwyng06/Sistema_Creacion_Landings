import type { Asset, Brief, MedioBanco } from "@/lib/contratos";
import { ejecutar, type DepsEnrutador } from "@/lib/ia/enrutador";
import { promptImagenes, PromptsImagen, RESTRICCIONES_DE_IMAGEN, type SlotAGenerar } from "@/lib/ia/prompts/imagen";
import { generarImagen, type OpcionesFlux, type Relacion } from "@/lib/imagenes/flux";
import { validarImagen } from "@/lib/imagenes/validar";
import { ErrorFuente } from "@/lib/fuentes/tipos";
import { join } from "node:path";
import { coincidencias, rankearMedios, type RolSlot } from "./medios";
import { guionDeSlot } from "./imagenes-sin-ia";
import type { EntradaVitrina } from "./tipos";

// Imágenes que corresponden al producto. Orden de fuentes por slot: banco o API real relevante, validado con visión
// (`validar-imagen`); si ninguna sirve, se amplía la búsqueda y, antes de rendirse, se genera con FLUX. Lo generado se marca `generada`.

export interface SlotVitrina {
  slot: string;
  rol: RolSlot;
  /** `banco`: ambiente real (NASA, Wikimedia…); `generar`: el producto o una escena suya, que ningún banco tiene. */
  origen: "banco" | "generar";
  relacion: Relacion;
  /** Qué debe mostrar y qué objeción mata. */
  que: string;
  /** Lo que se le pregunta a la visión. */
  esperado: string;
}

/** Los slots de imagen de una landing de la vitrina, según su temática. */
export function slotsDeVitrina(e: EntradaVitrina): SlotVitrina[] {
  const nombre = e.brief.nombre;
  const espacial = e.tematica === "espacio";
  const producto = (slot: string, rol: RolSlot, relacion: Relacion, que: string): SlotVitrina => ({ slot, rol, origen: "generar", relacion, que, esperado: `${nombre} o una escena realista donde aparece, sin texto, logos ni personas` });
  const ambiente = (slot: string, rol: RolSlot, relacion: Relacion, que: string, esperado: string): SlotVitrina => ({ slot, rol, origen: "banco", relacion, que, esperado });
  if (espacial) {
    return [
      ambiente("heroe-fondo", "heroe", "16:9", "el cielo real como fondo oscuro del héroe, sin texto ni logos", "una imagen astronómica o del espacio, oscura, sin texto, logos, personas ni hardware de laboratorio, apta como fondo de una landing"),
      producto("heroe-producto", "heroe", "4:5", `${nombre} solo, protagonista del encuadre, en una habitación oscura donde su efecto se ve (mata «¿es como en la foto?»)`),
      producto("problema", "problema", "16:9", "la escena cotidiana del problema: el cuarto o el espacio sin el producto, con luz plana y fría"),
      ambiente("galeria-1", "galeria", "16:9", "el cielo que inspira al producto", "una imagen astronómica o del espacio, sin texto, logos, personas ni hardware, apta para una galería"),
      ambiente("galeria-2", "galeria", "16:9", "otro cielo real que inspira al producto", "una imagen astronómica o del espacio, sin texto, logos, personas ni hardware, apta para una galería"),
      producto("galeria-3", "galeria", "1:1", `detalle de ${nombre}: material, botones y acabado (prueba de calidad)`),
      producto("galeria-4", "galeria", "4:5", `${nombre} en uso en un cuarto real, con su efecto visible (uso real y escala)`),
      producto("incluye-empaque", "incluye", "1:1", `todo lo que trae la caja de ${nombre}, ordenado sobre una mesa, sin accesorios que no se venden`),
    ];
  }
  return [
    producto("heroe-producto", "heroe", "1:1", `${nombre} solo, protagonista del encuadre sobre un fondo limpio (mata «¿es como en la foto?»)`),
    producto("problema", "problema", "16:9", "la escena cotidiana donde aparece el problema, sin personas y sin el producto"),
    producto("galeria-1", "galeria", "4:5", `${nombre} en uso en un ambiente real, sin personas`),
    producto("galeria-2", "galeria", "1:1", `detalle de ${nombre}: material, forma y acabado (prueba de calidad)`),
    producto("galeria-3", "galeria", "16:9", `${nombre} junto a un objeto cotidiano para dar la escala real`),
    producto("galeria-4", "galeria", "4:5", `${nombre} y su empaque, listo para entregar`),
    producto("incluye-empaque", "incluye", "1:1", `todo lo que trae la caja de ${nombre}, ordenado sobre una mesa, sin accesorios que no se venden`),
  ];
}

export interface ResultadoImagenes {
  assets: Asset[];
  reales: number;
  generadas: number;
  marcadores: number;
  avisos: string[];
}

export interface DepsImagenes {
  enrutador?: DepsEnrutador;
  flux: OpcionesFlux;
  dirMedia: string;
  candidatos: MedioBanco[];
  acento: string;
  log?: (l: string) => void;
  /** Cuántos candidatos del banco se ven con visión antes de generar. */
  maxValidaciones?: number;
  /** Se inyectan en los tests. */
  validar?: (ruta: string, esperado: string) => Promise<{ apta: boolean; motivo: string }>;
  /** Espera antes de reintentar la visión (los tests la ponen en 0). */
  esperaReintentoMs?: number;
  generar?: (prompt: string, relacion: Relacion) => Promise<{ ruta: string }>;
}

const MAX_VALIDACIONES = 6;

/** Pide a la IA la ficha común y un prompt por slot que se genera. */
export async function escribirPromptsDeImagen(e: EntradaVitrina, brief: Brief, tokensTxt: string, estrategiaTxt: string, briefTxt: string, slots: SlotVitrina[], deps?: DepsEnrutador): Promise<PromptsImagen> {
  // También los slots de banco llevan prompt: si ninguna imagen del banco sirve, se genera con él.
  const generar: SlotAGenerar[] = slots.map((s) => ({ slot: s.slot, que: s.que, relacion: s.relacion }));
  const p = promptImagenes({ contextoBrief: briefTxt, contextoEstrategia: estrategiaTxt, contextoSemilla: tokensTxt, producto: `${brief.nombre}. ${brief.beneficios.join(". ")}. Incluye: ${(brief.incluye ?? []).join(", ") || "lo que dice el vendedor"}.`, slots: generar });
  const r = await ejecutar({ tarea: "prompts-imagen", sistema: p.sistema, usuario: p.usuario, esquema: PromptsImagen, maxTokens: 3500, temperatura: 0.5 }, deps);
  const pedidos = new Set(generar.map((g) => g.slot));
  return { ficha: r.datos.ficha, slots: r.datos.slots.filter((s) => pedidos.has(s.slot)) };
}

const relacionAsset = (r: Relacion): Asset["relacion"] => r;
const recortar = (t: string, max: number) => (t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`);

/** Prompt final de un slot: el de la IA más el cierre fijo de restricciones (sin texto, logos ni personas). */
export const promptFinal = (prompt: string) => (/no text/i.test(prompt) ? prompt : `${prompt.trim()} ${RESTRICCIONES_DE_IMAGEN}`);

/** Resuelve todas las imágenes de la landing. Las que ya están en `previos` (otro intento) no se vuelven a buscar ni a generar. */
export async function resolverImagenes(slots: SlotVitrina[], prompts: PromptsImagen, e: EntradaVitrina, deps: DepsImagenes, previos: Map<string, Asset> = new Map()): Promise<ResultadoImagenes> {
  const log = deps.log ?? (() => undefined);
  const avisos: string[] = [];
  const assets: Asset[] = [];
  const usados = new Set<string>();
  const deBanco = new Map<string, number>();
  const validar = deps.validar ?? (async (ruta: string, esperado: string) => validarImagen(join(deps.dirMedia, ruta.replace(/^\/media\//, "")), esperado, deps.enrutador));
  const generar = deps.generar ?? ((prompt: string, relacion: Relacion) => generarImagen(prompt, relacion, deps.flux));
  const porSlot = new Map(prompts.slots.map((s) => [s.slot, s]));
  let fluxCaido = false;

  let visionCaida = false;
  const contexto = { nombre: e.brief.nombre, descripcion: e.brief.problema, tematica: e.tematica, colores: undefined as { fondo: string; acento: string } | undefined };
  contexto.colores = { fondo: "#F4EFE6", acento: deps.acento };
  const porRol = new Map<string, number>();

  for (const s of slots) {
    const previo = previos.get(s.slot);
    if (previo) {
      assets.push(previo);
      continue;
    }
    const i = porRol.get(s.rol) ?? 0;
    porRol.set(s.rol, i + 1);
    // Sin prompt de la IA (cuota caída o slot omitido) el prompt sale de la plantilla: nunca se queda sin prompts.
    const guion = porSlot.get(s.slot) ?? guionDeSlot(s, contexto, i);
    let asset: Asset | null = null;
    try {

    if (s.origen === "banco") {
      const ranking = rankearMedios(s.rol, deps.candidatos, { entrada: e, acento: deps.acento, usados }, deBanco).slice(0, deps.maxValidaciones ?? MAX_VALIDACIONES);
      const comoAsset = (c: (typeof ranking)[number]): Asset => {
        usados.add(c.medio.id);
        deBanco.set(c.medio.bancoId, (deBanco.get(c.medio.bancoId) ?? 0) + 1);
        return {
          slot: s.slot,
          tipo: "imagen",
          relacion: relacionAsset(c.medio.orientacion === "vertical" ? "4:5" : c.medio.orientacion === "cuadrada" ? "1:1" : "16:9"),
          promptGrok: s.esperado,
          ruta: c.medio.ruta,
          alt: recortar(`Foto real de ambiente, no es el producto: ${c.medio.titulo}. ${c.medio.descripcion}`.trim(), 200),
          fuente: c.medio.fuente,
          credito: c.medio.credito,
          licencia: c.medio.licencia,
          ...(c.medio.urlOrigen ? { urlOrigen: c.medio.urlOrigen } : {}),
          bancoId: c.medio.bancoId,
        };
      };
      let vistas = 0;
      for (const c of ranking) {
        vistas++;
        if (!visionCaida) {
          try {
            const v = await validar(c.medio.ruta, s.esperado).catch(async () => {
              await new Promise((r) => setTimeout(r, deps.esperaReintentoMs ?? 2500)); // un solo reintento: el proveedor con visión suele responder 503 en picos
              return validar(c.medio.ruta, s.esperado);
            });
            if (!v.apta) {
              log(`  ${s.slot}: ${c.medio.idFuente} no apta (${recortar(v.motivo, 80)})`);
              continue;
            }
            asset = comoAsset(c);
            break;
          } catch (err) {
            visionCaida = true;
            avisos.push(`Sin cupo de visión (${err instanceof Error ? err.message.split("\n")[0] : String(err)}): los candidatos se aceptan por palabras clave, validada: false.`);
          }
        }
        // Sin visión: se acepta el candidato por coincidencia de palabras clave en título y etiquetas (la licencia ya la filtró la fuente).
        const hits = coincidencias(c.medio, e.claves);
        if (hits >= 1 && c.medio.usoComercial !== false) {
          asset = comoAsset(c);
          avisos.push(`«${s.slot}»: ${c.medio.fuente} aceptada sin validar con visión (validada: false), coincide con ${hits} palabra(s) clave.`);
          break;
        }
      }
      if (!asset) log(`  ${s.slot}: ${vistas} candidato(s) del banco descartados; se genera`);
    }

    if (!asset && !fluxCaido) {
      const prompt = promptFinal(guion.prompt);
      try {
        const g = await generar(prompt, s.relacion);
        asset = {
          slot: s.slot,
          tipo: "imagen",
          relacion: relacionAsset(s.relacion),
          promptGrok: prompt,
          ruta: g.ruta,
          alt: guion.alt,
          fuente: "ia-flux",
          credito: "Imagen generada con IA (FLUX.1-schnell)",
          licencia: "generada",
          generada: true,
        };
        log(`  ${s.slot}: generada con FLUX`);
      } catch (err) {
        if (err instanceof ErrorFuente && (err.tipo === "cupo" || err.tipo === "deshabilitada" || err.tipo === "auth")) fluxCaido = true;
        avisos.push(`No se pudo generar ${s.slot}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    } catch (err) {
      // Falla por slot, no en bloque: los demás siguen.
      avisos.push(`El slot «${s.slot}» falló y queda con su marcador: ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`);
    }

    // Sin imagen real ni generada queda el marcador con su prompt (nunca en el héroe: `ajustarHeroe` cambia de variante).
    assets.push(asset ?? { slot: s.slot, tipo: "imagen", relacion: relacionAsset(s.relacion), promptGrok: promptFinal(guion.prompt), alt: guion.alt });
  }
  const conRuta = assets.filter((a) => a.ruta);
  return { assets, reales: conRuta.filter((a) => !a.generada).length, generadas: conRuta.filter((a) => a.generada).length, marcadores: assets.length - conRuta.length, avisos };
}

