import type { EventoConstruccion, EstadoSalud, IdValidador, TareaIA } from "@/lib/contratos";

export type EventoTarea = Extract<EventoConstruccion, { tipo: "tarea" }>;
export type EventoResultado = Extract<EventoConstruccion, { tipo: "resultado" }>;
export type EventoManual = Extract<EventoConstruccion, { tipo: "manual" }>;

export interface FilaTarea {
  tarea: TareaIA;
  estado: EventoTarea["estado"];
  proveedor?: string;
  ms?: number;
  mensaje?: string;
}

export interface EstadoConstruccion {
  fase: "reposo" | "construyendo" | "resultado" | "manual" | "error";
  filas: FilaTarea[];
  resultado?: Pick<EventoResultado, "doc" | "salud" | "vueltasCritico" | "proveedores" | "avisos">;
  manual?: EventoManual;
  error?: string;
  /** Avisos del lector (líneas ignoradas) y del pegado manual. */
  avisos: string[];
}

export const CONSTRUCCION_INICIAL: EstadoConstruccion = { fase: "reposo", filas: [], avisos: [] };

export type AccionConstruccion =
  | { tipo: "iniciar" }
  | { tipo: "evento"; evento: EventoConstruccion }
  | { tipo: "aviso"; aviso: string }
  | { tipo: "fallo"; mensaje: string }
  | { tipo: "resultado-manual"; resultado: NonNullable<EstadoConstruccion["resultado"]> }
  | { tipo: "reiniciar" };

/** Actualiza la fila de la tarea (o la crea, en el orden en que llegan): las paralelas avanzan a la vez. */
function conFila(filas: FilaTarea[], e: EventoTarea): FilaTarea[] {
  const nueva: FilaTarea = { tarea: e.tarea, estado: e.estado, proveedor: e.proveedor, ms: e.ms, mensaje: e.mensaje };
  const i = filas.findIndex((f) => f.tarea === e.tarea);
  if (i < 0) return [...filas, nueva];
  return filas.map((f, j) => (j === i ? { ...f, ...nueva, proveedor: e.proveedor ?? f.proveedor } : f));
}

export function reducirConstruccion(estado: EstadoConstruccion, accion: AccionConstruccion): EstadoConstruccion {
  switch (accion.tipo) {
    case "iniciar":
      return { fase: "construyendo", filas: [], avisos: [] };
    case "aviso":
      return { ...estado, avisos: [...estado.avisos, accion.aviso] };
    case "fallo":
      return { ...estado, fase: "error", error: accion.mensaje };
    case "resultado-manual":
      return { ...estado, fase: "resultado", resultado: accion.resultado, error: undefined };
    case "reiniciar":
      return CONSTRUCCION_INICIAL;
    case "evento": {
      const e = accion.evento;
      if (e.tipo === "tarea") return { ...estado, filas: conFila(estado.filas, e) };
      if (e.tipo === "resultado") {
        const { tipo, ...resto } = e;
        void tipo;
        return { ...estado, fase: "resultado", resultado: resto };
      }
      if (e.tipo === "manual") return { ...estado, fase: "manual", manual: e };
      return { ...estado, fase: "error", error: e.mensaje };
    }
  }
}

export const NOMBRE_TAREA: Record<TareaIA, string> = {
  objeciones: "Objeciones",
  landing: "Landing",
  "prompts-grok": "Prompts para Grok",
  "corregir-lista-negra": "Corregir lista negra",
  humanizar: "Humanizar textos",
  critico: "Crítico",
  "mejorar-prompt": "Mejorar prompt",
  "juez-duelo": "Juez del duelo",
  investigar: "Investigar el producto",
  "identificar-producto": "Identificar el producto",
  "describir-medio": "Describir un medio",
  "dato-curioso": "Datos curiosos",
  estrategia: "Estrategia",
  "plan-secciones": "Plan de secciones",
  "redactar-seccion": "Redactar una sección",
  "prompts-imagen": "Prompts de imagen",
  "validar-imagen": "Validar una imagen",
  intake: "Entender la idea",
};

export const NOMBRE_ESTADO_TAREA: Record<EventoTarea["estado"], string> = {
  "en-curso": "En curso",
  ok: "Listo",
  error: "Error",
  omitida: "Omitida",
};

export const NOMBRE_VALIDADOR: Record<IdValidador, string> = {
  esquema: "Esquema",
  estructura: "Estructura",
  "anti-split": "Anti-split",
  "anti-split-render": "Anti-split (render)",
  "lista-negra": "Lista negra",
  datos: "Datos reales",
  a11y: "Accesibilidad",
  efectos: "Efectos",
};

export const NOMBRE_SALUD: Record<EstadoSalud, string> = {
  verde: "Bien",
  amarillo: "Aviso",
  rojo: "Error",
  pendiente: "Pendiente",
};
