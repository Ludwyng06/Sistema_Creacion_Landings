import type { LandingDoc, Seccion } from "@/lib/contratos";

// Protocolo entre el editor y su vista previa (iframe de /editor/[id]/vista) por `postMessage`, con la forma de la §11.5
// del v2. Los dos lados validan `event.origin` (mismo origen) y la forma del mensaje antes de usarlo.

export const MSG_LISTA = "READY";

export type DispositivoVista = "desktop" | "tablet" | "mobile";
export type AccionRapida = "subir" | "bajar" | "duplicar" | "ocultar" | "eliminar";
export const ACCIONES_RAPIDAS: readonly AccionRapida[] = ["subir", "bajar", "duplicar", "ocultar", "eliminar"];

/** Editor → vista previa. */
export type MensajeAVista =
  | { type: "LANDING_UPDATE"; landing: LandingDoc }
  | { type: "SECTION_PATCH"; id: string; patch: Partial<Seccion> }
  | { type: "SELECT"; id: string | null; scroll?: boolean }
  | { type: "DEVICE"; device: DispositivoVista }
  /** Sección con el puntero encima en la lista de secciones (el contorno de la vista previa la sigue). */
  | { type: "HIGHLIGHT"; id: string | null }
  /** Qué acciones de la barra rápida están disponibles (`false` = desactivada) para la sección seleccionada. */
  | { type: "QUICK_STATE"; id: string; permitidas: Record<AccionRapida, boolean> };

/** Vista previa → editor. */
export type MensajeDeVista =
  | { type: "READY" }
  | { type: "CLICK_SECTION"; id: string; blockId?: string }
  | { type: "HOVER_SECTION"; id: string | null }
  | { type: "INLINE_EDIT"; id: string; path: string; value: string }
  /** Tamaño de letra de un bloque de texto (−3 a +3 pasos; 0 lo devuelve al de la sección). */
  | { type: "INLINE_SIZE"; id: string; path: string; step: number }
  | { type: "SECTION_ACTION"; id: string; action: AccionRapida }
  /** «Buscar en bancos» del marcador de una imagen pendiente: el editor abre la búsqueda del inspector para ese slot. */
  | { type: "BUSCAR_BANCOS"; slot: string }
  /** Una tecla pulsada dentro de la vista previa (el iframe se queda con el foco): el editor la trata como propia. */
  | { type: "KEY"; key: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean };

const esTexto = (v: unknown): v is string => typeof v === "string";

/** Valida la forma de un mensaje que llega del editor; `null` si no lo es. */
export function leerMensajeAVista(dato: unknown): MensajeAVista | null {
  if (!dato || typeof dato !== "object") return null;
  const m = dato as Record<string, unknown>;
  switch (m.type) {
    case "LANDING_UPDATE":
      return m.landing && typeof m.landing === "object" && Array.isArray((m.landing as LandingDoc).secciones) ? (m as unknown as MensajeAVista) : null;
    case "SECTION_PATCH":
      return esTexto(m.id) && m.patch && typeof m.patch === "object" ? (m as unknown as MensajeAVista) : null;
    case "SELECT":
    case "HIGHLIGHT":
      return m.id === null || esTexto(m.id) ? (m as unknown as MensajeAVista) : null;
    case "DEVICE":
      return m.device === "desktop" || m.device === "tablet" || m.device === "mobile" ? (m as unknown as MensajeAVista) : null;
    case "QUICK_STATE":
      return esTexto(m.id) && m.permitidas && typeof m.permitidas === "object" ? (m as unknown as MensajeAVista) : null;
    default:
      return null;
  }
}

/** Valida la forma de un mensaje que llega de la vista previa; `null` si no lo es. */
export function leerMensajeDeVista(dato: unknown): MensajeDeVista | null {
  if (!dato || typeof dato !== "object") return null;
  const m = dato as Record<string, unknown>;
  switch (m.type) {
    case "READY":
      return { type: "READY" };
    case "CLICK_SECTION":
      return esTexto(m.id) ? { type: "CLICK_SECTION", id: m.id, blockId: esTexto(m.blockId) ? m.blockId : undefined } : null;
    case "HOVER_SECTION":
      return m.id === null || esTexto(m.id) ? { type: "HOVER_SECTION", id: m.id } : null;
    case "INLINE_EDIT":
      return esTexto(m.id) && esTexto(m.path) && esTexto(m.value) ? { type: "INLINE_EDIT", id: m.id, path: m.path, value: m.value } : null;
    case "INLINE_SIZE":
      return esTexto(m.id) && esTexto(m.path) && typeof m.step === "number" && Number.isInteger(m.step) && Math.abs(m.step) <= 3 ? { type: "INLINE_SIZE", id: m.id, path: m.path, step: m.step } : null;
    case "SECTION_ACTION":
      return esTexto(m.id) && ACCIONES_RAPIDAS.includes(m.action as AccionRapida) ? { type: "SECTION_ACTION", id: m.id, action: m.action as AccionRapida } : null;
    case "BUSCAR_BANCOS":
      return esTexto(m.slot) && m.slot.length <= 80 ? { type: "BUSCAR_BANCOS", slot: m.slot } : null;
    case "KEY":
      return esTexto(m.key) && m.key.length <= 20 ? { type: "KEY", key: m.key, ctrlKey: m.ctrlKey === true, metaKey: m.metaKey === true, shiftKey: m.shiftKey === true, altKey: m.altKey === true } : null;
    default:
      return null;
  }
}

export const ANCHO_DISPOSITIVO: Record<DispositivoVista, number | null> = { desktop: null, tablet: 820, mobile: 390 };
