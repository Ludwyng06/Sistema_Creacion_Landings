import type { PromptEstructurado, Semilla, TecnicaId, Tokens } from "@/lib/contratos";
import { BORRADOR_VACIO, briefValido, type BorradorBrief } from "./borrador";
import type { CampoSugerible, MetaSugerida, PrecioReferencia } from "./investigar";

export type Paso = 1 | 2 | 3 | 4;
export const PASOS: { numero: Paso; nombre: string }[] = [
  { numero: 1, nombre: "Brief" },
  { numero: 2, nombre: "Técnicas" },
  { numero: 3, nombre: "Prompt" },
  { numero: 4, nombre: "Construir" },
];

/** Respuesta de `POST /api/prompt`. */
export interface RespuestaPrompt {
  prompt: PromptEstructurado;
  texto: string;
  semilla: Semilla;
  tokens: Tokens;
}

/** Lo que la investigación propuso para el brief y aún no se revisó. */
export interface RevisionBorrador {
  meta: Partial<Record<CampoSugerible, MetaSugerida>>;
  /** Campos «Sugerido» que la persona todavía no aceptó, editó o quitó. */
  pendientes: CampoSugerible[];
  /** Solo informativo: nunca llena el precio. */
  precioReferencia: PrecioReferencia | null;
}

export const REVISION_VACIA: RevisionBorrador = { meta: {}, pendientes: [], precioReferencia: null };

export interface EstadoAsistente {
  paso: Paso;
  brief: BorradorBrief;
  tecnicas: TecnicaId[];
  numeroSemilla?: number;
  /** Prompt generado para el brief, las técnicas y la semilla actuales. */
  prompt: RespuestaPrompt | null;
  /** Versión mejorada que la persona aceptó con «Usar mejorado». */
  promptMejorado: PromptEstructurado | null;
  revision: RevisionBorrador;
}

export const ESTADO_INICIAL: EstadoAsistente = {
  paso: 1,
  brief: BORRADOR_VACIO,
  tecnicas: [],
  prompt: null,
  promptMejorado: null,
  revision: REVISION_VACIA,
};

export type Accion =
  | { tipo: "hidratar"; estado: EstadoAsistente }
  | { tipo: "avanzar" }
  | { tipo: "volver" }
  | { tipo: "ir"; paso: Paso }
  | { tipo: "editar-brief"; cambios: Partial<BorradorBrief> }
  | { tipo: "reemplazar-brief"; brief: BorradorBrief }
  | { tipo: "cargar-ejemplo"; brief: BorradorBrief; tecnicas: TecnicaId[]; numeroSemilla: number }
  | { tipo: "aplicar-borrador"; cambios: Partial<BorradorBrief>; meta: RevisionBorrador["meta"]; precioReferencia: PrecioReferencia | null }
  | { tipo: "aceptar-sugerido"; campo: CampoSugerible }
  | { tipo: "aceptar-todo-sugerido" }
  | { tipo: "quitar-sugerido"; campo: CampoSugerible; cambios: Partial<BorradorBrief> }
  | { tipo: "tecnicas"; tecnicas: TecnicaId[] }
  | { tipo: "prompt"; prompt: RespuestaPrompt }
  | { tipo: "otra-semilla"; numero: number }
  | { tipo: "usar-mejorado"; prompt: PromptEstructurado }
  | { tipo: "descartar-mejorado" }
  | { tipo: "reiniciar" };

/** ¿Se puede estar en el paso `paso` con este estado? Cada paso exige que los anteriores estén completos. */
export function puedeEstarEn(estado: EstadoAsistente, paso: Paso, ahora?: number): boolean {
  if (paso >= 2 && estado.revision.pendientes.length > 0) return false;
  if (paso >= 2 && !briefValido(estado.brief, ahora)) return false;
  if (paso >= 4 && !estado.prompt) return false;
  return true;
}

/** Motivo legible por el que no se avanza desde el paso actual; `null` si se puede avanzar. */
export function motivoBloqueo(estado: EstadoAsistente, ahora?: number): string | null {
  if (estado.paso === 1 && estado.revision.pendientes.length > 0) {
    return "Revisa lo sugerido: acepta, edita o quita cada campo marcado para seguir.";
  }
  if (estado.paso === 1 && !briefValido(estado.brief, ahora)) {
    return "Completa los campos obligatorios y corrige lo marcado para seguir.";
  }
  if (estado.paso === 3 && !estado.prompt) return "Espera a que el prompt esté listo para construir.";
  return null;
}

export function reducir(estado: EstadoAsistente, accion: Accion): EstadoAsistente {
  switch (accion.tipo) {
    case "hidratar":
      return accion.estado;
    case "avanzar":
      if (estado.paso >= 4 || motivoBloqueo(estado) !== null) return estado;
      return { ...estado, paso: (estado.paso + 1) as Paso };
    case "volver":
      return estado.paso > 1 ? { ...estado, paso: (estado.paso - 1) as Paso } : estado;
    case "ir":
      return accion.paso <= estado.paso || puedeEstarEn(estado, accion.paso)
        ? { ...estado, paso: accion.paso }
        : estado;
    case "editar-brief":
      return invalidarPrompt({ ...estado, brief: { ...estado.brief, ...accion.cambios } });
    case "reemplazar-brief":
      return invalidarPrompt({ ...estado, brief: accion.brief });
    case "cargar-ejemplo":
      return invalidarPrompt({ ...estado, brief: accion.brief, tecnicas: accion.tecnicas, numeroSemilla: accion.numeroSemilla, revision: REVISION_VACIA });
    case "aplicar-borrador": {
      const campos = Object.keys(accion.meta) as CampoSugerible[];
      return invalidarPrompt({
        ...estado,
        brief: { ...estado.brief, ...accion.cambios },
        revision: {
          meta: { ...estado.revision.meta, ...accion.meta },
          pendientes: [...new Set([...estado.revision.pendientes, ...campos])],
          precioReferencia: accion.precioReferencia ?? estado.revision.precioReferencia,
        },
      });
    }
    case "aceptar-sugerido":
      return { ...estado, revision: { ...estado.revision, pendientes: estado.revision.pendientes.filter((c) => c !== accion.campo) } };
    case "aceptar-todo-sugerido":
      return { ...estado, revision: { ...estado.revision, pendientes: [] } };
    case "quitar-sugerido": {
      const meta = { ...estado.revision.meta };
      delete meta[accion.campo];
      return invalidarPrompt({
        ...estado,
        brief: { ...estado.brief, ...accion.cambios },
        revision: { ...estado.revision, meta, pendientes: estado.revision.pendientes.filter((c) => c !== accion.campo) },
      });
    }
    case "tecnicas":
      return invalidarPrompt({ ...estado, tecnicas: accion.tecnicas });
    case "prompt":
      return { ...estado, prompt: accion.prompt };
    case "otra-semilla":
      return invalidarPrompt({ ...estado, numeroSemilla: accion.numero });
    case "usar-mejorado":
      return { ...estado, promptMejorado: accion.prompt };
    case "descartar-mejorado":
      return { ...estado, promptMejorado: null };
    case "reiniciar":
      return ESTADO_INICIAL;
  }
}

/** Si cambia lo que alimenta al prompt, el que estaba generado ya no vale. */
function invalidarPrompt(estado: EstadoAsistente): EstadoAsistente {
  return { ...estado, prompt: null, promptMejorado: null };
}

/** Prompt que se copia y se envía a construir: el mejorado si se aceptó, si no el generado. */
export function promptEfectivo(estado: EstadoAsistente): PromptEstructurado | null {
  return estado.promptMejorado ?? estado.prompt?.prompt ?? null;
}

// ── Persistencia en sessionStorage (siempre con try/catch: puede estar bloqueado) ──

export const CLAVE_SESION = "creador-landings:asistente:v1";

export function guardarSesion(estado: EstadoAsistente): void {
  try {
    globalThis.sessionStorage?.setItem(CLAVE_SESION, JSON.stringify(estado));
  } catch {
    // Sin almacenamiento: el asistente sigue funcionando, solo no recuerda al recargar.
  }
}

export function leerSesion(): EstadoAsistente | null {
  try {
    const crudo = globalThis.sessionStorage?.getItem(CLAVE_SESION);
    if (!crudo) return null;
    const dato = JSON.parse(crudo) as Partial<EstadoAsistente>;
    if (!dato || typeof dato !== "object" || !dato.brief) return null;
    return {
      ...ESTADO_INICIAL,
      ...dato,
      brief: { ...BORRADOR_VACIO, ...dato.brief },
      revision: { ...REVISION_VACIA, ...dato.revision },
      paso: [1, 2, 3, 4].includes(dato.paso as number) ? (dato.paso as Paso) : 1,
    };
  } catch {
    return null;
  }
}

export function borrarSesion(): void {
  try {
    globalThis.sessionStorage?.removeItem(CLAVE_SESION);
  } catch {
    // Nada que borrar.
  }
}
