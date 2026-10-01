// Cupo diario del proveedor leído de los encabezados de cada respuesta (Cerebras: x-ratelimit-remaining-tokens-day y
// x-ratelimit-remaining-requests-day). Cuando queda poco, el adaptador salta al siguiente proveedor antes de agotarlo
// y de ver un 429 que haría perder la tarea; pasado el reinicio (o un rato) se vuelve a probar.

export interface LecturaCupoDia {
  tokensDia?: number;
  peticionesDia?: number;
  /** Segundos hasta el reinicio del cupo del día, si el proveedor lo informa. */
  reinicioS?: number;
}

const numero = (v: string | null): number | undefined => {
  if (v === null || v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

export function leerCupoDia(h: Pick<Headers, "get">): LecturaCupoDia | null {
  const tokensDia = numero(h.get("x-ratelimit-remaining-tokens-day"));
  const peticionesDia = numero(h.get("x-ratelimit-remaining-requests-day"));
  if (tokensDia === undefined && peticionesDia === undefined) return null;
  const reinicioS = numero(h.get("x-ratelimit-reset-tokens-day")) ?? numero(h.get("x-ratelimit-reset-requests-day"));
  return { tokensDia, peticionesDia, reinicioS };
}

export interface GuardiaCupoDia {
  registrar(lectura: LecturaCupoDia | null): void;
  /** `null` si se puede llamar; si no, el motivo para saltar a otro proveedor. */
  bloqueo(tokensNecesarios: number): string | null;
}

export interface OpcionesGuardia {
  /** Tokens del día que se dejan de reserva (por defecto 6.000: una sección o un crítico). */
  reservaTokens?: number;
  /** Peticiones del día que se dejan de reserva (por defecto 2). */
  reservaPeticiones?: number;
  /** Si no hay hora de reinicio, cuánto esperar antes de volver a probar (por defecto 15 min). */
  sondeoMs?: number;
  ahora?: () => number;
}

export function crearGuardiaCupoDia(op: OpcionesGuardia = {}): GuardiaCupoDia {
  const ahora = op.ahora ?? Date.now;
  const reservaTokens = op.reservaTokens ?? 6000;
  const reservaPeticiones = op.reservaPeticiones ?? 2;
  const sondeoMs = op.sondeoMs ?? 15 * 60_000;
  let ultima: (LecturaCupoDia & { hasta: number }) | null = null;
  return {
    registrar(l) {
      if (!l) return;
      ultima = { ...l, hasta: ahora() + (l.reinicioS !== undefined ? l.reinicioS * 1000 : sondeoMs) };
    },
    bloqueo(necesarios) {
      if (!ultima) return null;
      if (ahora() >= ultima.hasta) {
        ultima = null; // pasó el reinicio o el tiempo de sondeo: se vuelve a probar
        return null;
      }
      if (ultima.tokensDia !== undefined && ultima.tokensDia < Math.max(reservaTokens, necesarios))
        return `quedan ${ultima.tokensDia} tokens del día`;
      if (ultima.peticionesDia !== undefined && ultima.peticionesDia < reservaPeticiones) return `quedan ${ultima.peticionesDia} peticiones del día`;
      return null;
    },
  };
}

const COMPARTIDAS = new Map<string, GuardiaCupoDia>();

/** Una guardia por proveedor para todo el proceso: los adaptadores se crean en cada petición, el cupo del día no. */
export function guardiaCompartida(id: string): GuardiaCupoDia {
  let g = COMPARTIDAS.get(id);
  if (!g) COMPARTIDAS.set(id, (g = crearGuardiaCupoDia()));
  return g;
}
