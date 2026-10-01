export { ErrorIA } from "@/lib/contratos/ia";
export type {
  ImagenIA,
  ModoIA,
  ProveedorIA,
  ProveedorId,
  ResultadoIA,
  TareaIA,
  TipoErrorIA,
} from "@/lib/contratos/ia";

import type { ImagenIA, ProveedorIA, ResultadoIA, TareaIA, TipoErrorIA } from "@/lib/contratos/ia";
import type { ZodType } from "zod";

/** Opciones que el enrutador pasa a los adaptadores además de las del contrato (el contrato es de solo lectura). */
export interface OpcionesLlamada {
  /** Tope de esta llamada; recorta el `IA_TIMEOUT_MS` general. */
  timeoutMs?: number;
  /** Tarea liviana (el crítico): el adaptador elige su camino más rápido (Gemini usa el modelo flash-lite). */
  rapido?: boolean;
  /** Imagen que acompaña al mensaje (tarea `identificar-producto`). */
  imagen?: ImagenIA;
}

/** `ProveedorIA` con lo que los adaptadores reales exponen de más. Los proveedores simulados de los tests siguen valiendo. */
export type ProveedorAmpliado = Omit<ProveedorIA, "generarJSON"> & {
  modelo?: string;
  /** Tokens por minuto del plan gratuito: si existe, el proveedor recibe la entrada compacta. */
  limiteTokensMinuto?: number;
  /** Entiende imágenes en el mensaje (Gemini). Las tareas con imagen solo se envían a estos proveedores. */
  soportaImagen?: boolean;
  generarJSON<T>(
    p: { sistema: string; usuario: string; esquema: ZodType<T>; maxTokens?: number; temperatura?: number } & OpcionesLlamada,
  ): Promise<ResultadoIA<T>>;
};

export interface IntentoIA {
  proveedor: string;
  tipo: TipoErrorIA;
  mensaje: string;
}

export interface PromptManual {
  sistema: string;
  usuario: string;
}

const MOTIVO_POR_TIPO: Record<TipoErrorIA, string> = {
  limite: "cuota o saturación",
  json: "respuesta fuera del esquema",
  timeout: "tiempo agotado",
  auth: "clave rechazada",
  red: "fallo del servicio o de red",
};

/** Una sola línea con el motivo de cada proveedor (cuota, esquema, tiempo…) y el detalle que dio, sin saltos ni claves. */
export function resumirIntentos(intentos: IntentoIA[]): string {
  const ultimo = new Map<string, IntentoIA>();
  for (const i of intentos) ultimo.set(i.proveedor, i);
  return [...ultimo.values()]
    .map((i) => {
      const detalle = i.mensaje.replace(/\s+/g, " ").replace(new RegExp(`^${i.proveedor}: `), "").trim();
      return `${i.proveedor}: ${MOTIVO_POR_TIPO[i.tipo]} — ${detalle.length > 140 ? `${detalle.slice(0, 137)}...` : detalle}`;
    })
    .join("; ");
}

/** Se lanza cuando ningún proveedor de la cascada pudo responder. */
export class ErrorCascadaAgotada extends Error {
  readonly intentos: IntentoIA[];
  readonly promptManual: PromptManual;

  constructor(intentos: IntentoIA[], promptManual: PromptManual) {
    super(
      intentos.length === 0
        ? "No hay proveedores de IA configurados. Usa el modo manual."
        : `Todos los proveedores fallaron (${resumirIntentos(intentos)}). Usa el modo manual.`,
    );
    this.name = "ErrorCascadaAgotada";
    this.intentos = intentos;
    this.promptManual = promptManual;
  }
}

export type RegistradorUso = (u: {
  tarea: TareaIA;
  proveedor: string;
  modelo: string;
  ms: number;
  ok: boolean;
  error?: string;
}) => Promise<void>;
