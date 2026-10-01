import type { LandingDoc } from "@/lib/contratos";

export type EstadoGuardado = "guardado" | "pendiente" | "guardando" | "error";

export const ESPERA_AUTOGUARDADO_MS = 800;
export const ESPERA_REINTENTO_MS = 3000;
export const MAX_REINTENTOS = 5;

export interface OpcionesAutoguardador {
  guardar: (doc: LandingDoc) => Promise<void>;
  alEstado: (estado: EstadoGuardado, detalle?: string) => void;
  espera?: number;
  esperaReintento?: number;
}

export interface Autoguardador {
  /** Programa un guardado: varias llamadas seguidas dentro de la espera generan un solo guardado. */
  programar(doc: LandingDoc): void;
  /** Guarda ya lo pendiente (antes de acciones que leen del servidor) y espera a que termine. */
  vaciar(): Promise<void>;
  cancelar(): void;
}

/** Autoguardado con debounce, un solo guardado en vuelo y reintentos si el servidor falla. */
export function crearAutoguardador({
  guardar,
  alEstado,
  espera = ESPERA_AUTOGUARDADO_MS,
  esperaReintento = ESPERA_REINTENTO_MS,
}: OpcionesAutoguardador): Autoguardador {
  let pendiente: LandingDoc | null = null;
  let temporizador: ReturnType<typeof setTimeout> | null = null;
  let enVuelo: Promise<void> | null = null;
  let reintentos = 0;

  function limpiar() {
    if (temporizador) clearTimeout(temporizador);
    temporizador = null;
  }

  async function ejecutar(): Promise<void> {
    limpiar();
    if (enVuelo) return enVuelo;
    const doc = pendiente;
    if (!doc) return;
    pendiente = null;
    alEstado("guardando");
    enVuelo = (async () => {
      try {
        await guardar(doc);
        reintentos = 0;
        alEstado(pendiente ? "pendiente" : "guardado");
      } catch (e) {
        // Lo que no se pudo guardar vuelve a la cola, salvo que ya haya algo más nuevo.
        pendiente ??= doc;
        reintentos += 1;
        const detalle = e instanceof Error ? e.message : "No se pudo guardar";
        if (reintentos <= MAX_REINTENTOS) {
          alEstado("error", `${detalle}. Reintentando…`);
          temporizador = setTimeout(() => void ejecutar(), esperaReintento);
        } else {
          alEstado("error", `${detalle}. Dejamos de reintentar: edita algo para volver a intentarlo.`);
        }
      } finally {
        enVuelo = null;
      }
    })();
    await enVuelo;
    // Llegó una edición mientras se guardaba: se guarda con su propia espera.
    if (pendiente && reintentos === 0 && !temporizador) temporizador = setTimeout(() => void ejecutar(), espera);
  }

  return {
    programar(doc) {
      pendiente = doc;
      reintentos = 0;
      alEstado("pendiente");
      limpiar();
      if (!enVuelo) temporizador = setTimeout(() => void ejecutar(), espera);
    },
    async vaciar() {
      if (enVuelo) await enVuelo;
      if (pendiente) await ejecutar();
    },
    cancelar() {
      limpiar();
      pendiente = null;
    },
  };
}
