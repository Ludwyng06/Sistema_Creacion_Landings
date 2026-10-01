// Contrato único de los adaptadores de fuentes externas (docs/sistema-creacion-landings-v2.md §13.3).

export type Env = Record<string, string | undefined>;

/** Lo que recibe cada adaptador además de la consulta: se inyecta en los tests (fixtures grabados, sin red). */
export interface OpcionesFuente {
  env?: Env;
  fetchFn?: typeof fetch;
  /** Espera entre el intento y su reintento; los tests la ponen en 0. */
  esperaReintentoMs?: number;
}

export interface Fuente<Q, R> {
  id: string;
  /** Segundos que la respuesta se reutiliza desde la caché. */
  ttl: number;
  /** TTL de una respuesta concreta, si es menor (una respuesta incompleta no se guarda por horas). */
  ttlDe?(resultado: R): number;
  /** Consultas por mes del plan gratuito; al 90 % la fuente se desactiva y se avisa. */
  limiteMensual?: number;
  /** Fuentes que comparten un mismo plan (dos consultas de SerpAPI) cuentan bajo este nombre. Por defecto, su `id`. */
  grupoUso?: string;
  /** `false` si falta la clave: la fuente se omite sin error. */
  habilitada(): boolean;
  /** Tope de 8 s (AbortController) y 1 reintento con espera en 429 o 5xx. */
  consultar(q: Q, señal?: AbortSignal): Promise<R>;
  /** Texto de crédito de un resultado. */
  credito(item: unknown): string;
}

export type TipoErrorFuente = "timeout" | "red" | "cupo" | "respuesta" | "auth" | "deshabilitada";

export class ErrorFuente extends Error {
  readonly tipo: TipoErrorFuente;
  readonly fuente: string;

  constructor(fuente: string, tipo: TipoErrorFuente, mensaje: string) {
    super(mensaje);
    this.name = "ErrorFuente";
    this.fuente = fuente;
    this.tipo = tipo;
  }
}
