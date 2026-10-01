import { nanoid } from "nanoid";
import type { Asset, EfectoId, LandingDoc, Seccion, Tokens, TipoSeccion } from "@/lib/contratos";
import { registro } from "@/secciones/registro";
import { ASSETS_POR_TIPO, EJEMPLO_POR_TIPO } from "@/secciones/ejemplos-por-tipo";
import { variantesDe } from "@/secciones/catalogo-variantes";
import { destinoEnGrupo, grupoDe, posicionParaAgregar } from "./grupos";

// Estado del editor: el documento, su historial (deshacer/rehacer) y la sección seleccionada.
// Todas las reglas de estructura del editor viven aquí para que se puedan probar sin interfaz.

export const MAX_HISTORIAL = 100;
export const MIN_SECCIONES = 5;
export const MAX_SECCIONES = 16;
/** Ediciones seguidas del mismo campo dentro de este margen (ms) cuentan como un solo paso de historial. */
export const VENTANA_FUSION_MS = 1000;

export interface EstadoEditor {
  doc: LandingDoc;
  pasado: LandingDoc[];
  futuro: LandingDoc[];
  seleccion: string | null;
  /** Quién produjo el último `doc`: solo los cambios de la persona se autoguardan. */
  origen: "usuario" | "servidor";
  claveUltima?: string;
  tUltimo?: number;
}

export type AccionEditor =
  | { tipo: "reordenar"; desde: number; hasta: number }
  | { tipo: "mover-en-grupo"; id: string; paso: 1 | -1 }
  | { tipo: "alternar-visible"; id: string }
  | { tipo: "duplicar"; id: string }
  | { tipo: "eliminar"; id: string }
  | { tipo: "agregar"; seccionTipo: TipoSeccion; variante?: string }
  | { tipo: "editar-seccion"; id: string; seccion: Seccion; clave?: string; t?: number }
  | { tipo: "editar-tokens"; tokens: Tokens; semilla?: LandingDoc["meta"]["semilla"]; clave?: string; t?: number }
  | { tipo: "editar-efectos"; id: string; efectos: EfectoId[] }
  | { tipo: "reemplazar-doc"; doc: LandingDoc }
  | { tipo: "asset-subido"; slot: string; ruta: string; asset?: Asset }
  | { tipo: "asset-de-banco"; asset: Asset }
  | { tipo: "sincronizar-marcas"; doc: LandingDoc }
  | { tipo: "seleccionar"; id: string | null }
  | { tipo: "deshacer" }
  | { tipo: "rehacer" };

export function estadoInicial(doc: LandingDoc): EstadoEditor {
  return { doc, pasado: [], futuro: [], seleccion: doc.secciones[0]?.id ?? null, origen: "servidor" };
}

/** Marca de tiempo para fusionar ediciones seguidas; vive fuera de los componentes para que el render siga puro. */
export const marcaDeTiempo = (): number => Date.now();

export const nuevoId = (prefijo = "sec"): string => `${prefijo}-${nanoid(8)}`;

// ── Reglas ─────────────────────────────────────────────────────────────────

const esHeroe = (s: Seccion) => s.tipo === "heroe";
const esFormulario = (s: Seccion) => s.tipo === "formulario-lead";

export function contarTipo(doc: LandingDoc, tipo: TipoSeccion): number {
  return doc.secciones.filter((s) => s.tipo === tipo).length;
}

/** `null` si se puede eliminar; si no, el motivo que muestra el tooltip. */
export function motivoNoEliminar(doc: LandingDoc, s: Seccion): string | null {
  if (esHeroe(s)) return "El héroe es la primera sección y no se puede eliminar.";
  if (esFormulario(s)) return "El formulario de contacto es la acción final de la landing: no se puede eliminar.";
  if (doc.secciones.length <= MIN_SECCIONES) return `Una landing necesita al menos ${MIN_SECCIONES} secciones.`;
  return null;
}

export function motivoNoDuplicar(doc: LandingDoc, s: Seccion): string | null {
  if (esHeroe(s)) return "El héroe aparece una sola vez.";
  if (esFormulario(s)) return "El formulario de contacto aparece una sola vez.";
  const max = registro[s.tipo]?.maxPorLanding ?? 1;
  if (contarTipo(doc, s.tipo) >= max) return `Esta sección admite como máximo ${max} por landing.`;
  if (doc.secciones.length >= MAX_SECCIONES) return `Una landing admite como máximo ${MAX_SECCIONES} secciones.`;
  return null;
}

export function motivoNoAgregar(doc: LandingDoc, tipo: TipoSeccion): string | null {
  const max = registro[tipo]?.maxPorLanding ?? 1;
  if (tipo === "heroe") return "La landing ya tiene héroe.";
  if (contarTipo(doc, tipo) >= max) return max === 1 ? "Ya está en la landing." : `Máximo ${max} en la landing.`;
  if (doc.secciones.length >= MAX_SECCIONES) return `Máximo ${MAX_SECCIONES} secciones.`;
  return null;
}

/** El héroe queda fijo arriba: nadie se mueve a su posición ni él se mueve. */
export function limitesDeMovimiento(doc: LandingDoc, desde: number, hasta: number): number | null {
  const heroe = doc.secciones.findIndex(esHeroe);
  if (desde < 0 || desde >= doc.secciones.length) return null;
  if (heroe === desde) return null;
  let destino = Math.max(0, Math.min(doc.secciones.length - 1, hasta));
  if (heroe === 0 && destino === 0) destino = 1;
  return destino === desde ? null : destino;
}

// ── Copias con ids nuevos ──────────────────────────────────────────────────

function clonar<T>(valor: T): T {
  return JSON.parse(JSON.stringify(valor)) as T;
}

export function conIdsNuevos(s: Seccion): Seccion {
  const copia = clonar(s);
  return {
    ...copia,
    id: nuevoId(),
    editadoPorHumano: undefined,
    bloques: copia.bloques.map((b) => ({ ...b, id: nuevoId("blq") })),
  };
}

// ── Ediciones de una sección (funciones puras que usa el panel de ajustes) ─

export function conAjuste(s: Seccion, clave: string, valor: unknown): Seccion {
  const ajustes = { ...s.ajustes };
  if (valor === undefined) delete ajustes[clave];
  else ajustes[clave] = valor;
  return { ...s, ajustes };
}

export function conAjusteDeBloque(s: Seccion, indice: number, clave: string, valor: unknown): Seccion {
  return {
    ...s,
    bloques: s.bloques.map((b, i) => {
      if (i !== indice) return b;
      const ajustes = { ...b.ajustes };
      if (valor === undefined) delete ajustes[clave];
      else ajustes[clave] = valor;
      return { ...b, ajustes };
    }),
  };
}

export function conBloqueNuevo(s: Seccion, tipo: string, ajustes: Record<string, unknown>, max: number): Seccion {
  if (s.bloques.length >= max) return s;
  return { ...s, bloques: [...s.bloques, { id: nuevoId("blq"), tipo, ajustes }] };
}

export function sinBloque(s: Seccion, indice: number, min: number): Seccion {
  if (s.bloques.length <= min) return s;
  return { ...s, bloques: s.bloques.filter((_, i) => i !== indice) };
}

export function conBloqueMovido(s: Seccion, desde: number, hasta: number): Seccion {
  if (hasta < 0 || hasta >= s.bloques.length || desde === hasta) return s;
  const bloques = [...s.bloques];
  const [x] = bloques.splice(desde, 1);
  bloques.splice(hasta, 0, x);
  return { ...s, bloques };
}

// ── Efectos ────────────────────────────────────────────────────────────────

export function contarNivel3(doc: LandingDoc, nivelDe: (id: EfectoId) => number): number {
  return doc.secciones.reduce((n, s) => n + (s.efectos ?? []).filter((e) => nivelDe(e) === 3).length, 0);
}

// ── Reducer ────────────────────────────────────────────────────────────────

function confirmar(estado: EstadoEditor, doc: LandingDoc, extra: Partial<EstadoEditor> = {}): EstadoEditor {
  return {
    ...estado,
    doc,
    pasado: [...estado.pasado, estado.doc].slice(-MAX_HISTORIAL),
    futuro: [],
    claveUltima: undefined,
    tUltimo: undefined,
    origen: "usuario",
    ...extra,
  };
}

/** Como `confirmar`, pero fusiona ediciones seguidas del mismo campo en un solo paso de historial. */
function editar(estado: EstadoEditor, doc: LandingDoc, clave: string | undefined, t: number | undefined): EstadoEditor {
  const fusionar =
    clave !== undefined &&
    clave === estado.claveUltima &&
    t !== undefined &&
    estado.tUltimo !== undefined &&
    t - estado.tUltimo <= VENTANA_FUSION_MS;
  if (fusionar) return { ...estado, doc, futuro: [], tUltimo: t, origen: "usuario" };
  return confirmar(estado, doc, { claveUltima: clave, tUltimo: t });
}

export function reducirEditor(estado: EstadoEditor, accion: AccionEditor): EstadoEditor {
  const { doc } = estado;
  switch (accion.tipo) {
    case "seleccionar":
      return { ...estado, seleccion: accion.id };

    // El servidor calcula `editadoPorHumano` al guardar: se copian las marcas sin tocar el historial.
    case "sincronizar-marcas": {
      const marcas = new Map(accion.doc.secciones.map((x) => [x.id, x.editadoPorHumano]));
      const secciones = doc.secciones.map((x) => (marcas.has(x.id) ? { ...x, editadoPorHumano: marcas.get(x.id) } : x));
      return { ...estado, doc: { ...doc, secciones }, origen: "servidor" };
    }

    case "reordenar": {
      const destino = limitesDeMovimiento(doc, accion.desde, accion.hasta);
      if (destino === null) return estado;
      // Solo se reordena dentro del mismo grupo (Encabezado, Plantilla, Pie o Fijos).
      if (grupoDe(doc.secciones[accion.desde].tipo) !== grupoDe(doc.secciones[destino].tipo)) return estado;
      const secciones = [...doc.secciones];
      const [x] = secciones.splice(accion.desde, 1);
      secciones.splice(destino, 0, x);
      return confirmar(estado, { ...doc, secciones });
    }

    case "mover-en-grupo": {
      const hasta = destinoEnGrupo(doc, accion.id, accion.paso);
      const desde = doc.secciones.findIndex((x) => x.id === accion.id);
      if (hasta === null || desde < 0) return estado;
      const secciones = [...doc.secciones];
      const [x] = secciones.splice(desde, 1);
      secciones.splice(hasta, 0, x);
      return confirmar(estado, { ...doc, secciones });
    }

    case "alternar-visible":
      return confirmar(estado, {
        ...doc,
        secciones: doc.secciones.map((s) => (s.id === accion.id ? { ...s, visible: !s.visible } : s)),
      });

    case "duplicar": {
      const i = doc.secciones.findIndex((s) => s.id === accion.id);
      if (i < 0 || motivoNoDuplicar(doc, doc.secciones[i])) return estado;
      const copia = conIdsNuevos(doc.secciones[i]);
      const secciones = [...doc.secciones];
      secciones.splice(i + 1, 0, copia);
      return confirmar(estado, { ...doc, secciones }, { seleccion: copia.id });
    }

    case "eliminar": {
      const i = doc.secciones.findIndex((s) => s.id === accion.id);
      if (i < 0 || motivoNoEliminar(doc, doc.secciones[i])) return estado;
      const secciones = doc.secciones.filter((s) => s.id !== accion.id);
      const seleccion = estado.seleccion === accion.id ? (secciones[Math.min(i, secciones.length - 1)]?.id ?? null) : estado.seleccion;
      return confirmar(estado, { ...doc, secciones }, { seleccion });
    }

    case "agregar": {
      if (motivoNoAgregar(doc, accion.seccionTipo)) return estado;
      const elegida = accion.variante ? variantesDe(accion.seccionTipo).find((v) => v.clave === accion.variante) : undefined;
      const nueva = conIdsNuevos(elegida?.seccion ?? EJEMPLO_POR_TIPO[accion.seccionTipo]);
      // Cada grupo tiene su lugar: la plantilla va antes del formulario (la acción final); el pie y los fijos, al final.
      const secciones = [...doc.secciones];
      secciones.splice(posicionParaAgregar(doc, accion.seccionTipo), 0, nueva);
      const usados = JSON.stringify([nueva.ajustes, nueva.bloques]);
      const faltantes = (elegida?.assets ?? ASSETS_POR_TIPO[accion.seccionTipo] ?? []).filter((a) => usados.includes(`"${a.slot}"`) && !doc.assets.some((x) => x.slot === a.slot));
      return confirmar(estado, { ...doc, secciones, assets: [...doc.assets, ...faltantes] }, { seleccion: nueva.id });
    }

    case "editar-seccion":
      return editar(
        estado,
        { ...doc, secciones: doc.secciones.map((s) => (s.id === accion.id ? accion.seccion : s)) },
        accion.clave ? `${accion.id}:${accion.clave}` : undefined,
        accion.t,
      );

    case "editar-tokens":
      return editar(
        estado,
        { ...doc, tokens: accion.tokens, meta: accion.semilla ? { ...doc.meta, semilla: accion.semilla } : doc.meta },
        accion.clave ? `tokens:${accion.clave}` : undefined,
        accion.t,
      );

    case "editar-efectos":
      return confirmar(estado, {
        ...doc,
        secciones: doc.secciones.map((s) => (s.id === accion.id ? { ...s, efectos: accion.efectos } : s)),
      });

    case "reemplazar-doc": {
      const seleccion = accion.doc.secciones.some((s) => s.id === estado.seleccion) ? estado.seleccion : (accion.doc.secciones[0]?.id ?? null);
      return confirmar(estado, accion.doc, { seleccion });
    }

    case "asset-subido": {
      const existe = doc.assets.some((a) => a.slot === accion.slot);
      const assets = existe
        ? doc.assets.map((a) => (a.slot === accion.slot ? { ...a, ruta: accion.ruta } : a))
        : accion.asset
          ? [...doc.assets, { ...accion.asset, ruta: accion.ruta }]
          : doc.assets;
      return confirmar(estado, { ...doc, assets });
    }

    // Una imagen elegida en los bancos: se agrega o reemplaza el asset del slot con su crédito y licencia.
    case "asset-de-banco": {
      const existe = doc.assets.some((a) => a.slot === accion.asset.slot);
      const assets = existe ? doc.assets.map((a) => (a.slot === accion.asset.slot ? { ...a, ...accion.asset } : a)) : [...doc.assets, accion.asset];
      return confirmar(estado, { ...doc, assets });
    }

    case "deshacer": {
      const anterior = estado.pasado[estado.pasado.length - 1];
      if (!anterior) return estado;
      return {
        ...estado,
        doc: anterior,
        pasado: estado.pasado.slice(0, -1),
        futuro: [doc, ...estado.futuro].slice(0, MAX_HISTORIAL),
        claveUltima: undefined,
        tUltimo: undefined,
        origen: "usuario",
        seleccion: anterior.secciones.some((s) => s.id === estado.seleccion) ? estado.seleccion : (anterior.secciones[0]?.id ?? null),
      };
    }

    case "rehacer": {
      const siguiente = estado.futuro[0];
      if (!siguiente) return estado;
      return {
        ...estado,
        doc: siguiente,
        pasado: [...estado.pasado, doc].slice(-MAX_HISTORIAL),
        futuro: estado.futuro.slice(1),
        claveUltima: undefined,
        tUltimo: undefined,
        origen: "usuario",
        seleccion: siguiente.secciones.some((s) => s.id === estado.seleccion) ? estado.seleccion : (siguiente.secciones[0]?.id ?? null),
      };
    }
  }
}
