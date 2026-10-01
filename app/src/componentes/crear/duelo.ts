import type { EventoDuelo, Lado } from "@/lib/ia/duelo";
import type { EstadoConstruccion, EventoManual, EventoResultado, EventoTarea, FilaTarea } from "./construccion";

// Estado del modo duelo: dos construcciones en paralelo (lado A y lado B) y, al final, el veredicto del juez.

export type EventoFinalDuelo = Extract<EventoDuelo, { tipo: "duelo" }>;

export interface LadoEstado {
  filas: FilaTarea[];
  resultado?: NonNullable<EstadoConstruccion["resultado"]>;
  manual?: EventoManual;
  error?: string;
}

export interface EstadoDuelo {
  fase: "reposo" | "corriendo" | "terminado" | "error";
  a: LadoEstado;
  b: LadoEstado;
  final?: EventoFinalDuelo;
  error?: string;
  avisos: string[];
}

const LADO_VACIO: LadoEstado = { filas: [] };
export const DUELO_INICIAL: EstadoDuelo = { fase: "reposo", a: LADO_VACIO, b: LADO_VACIO, avisos: [] };

export type AccionDuelo =
  | { tipo: "iniciar" }
  | { tipo: "evento"; evento: EventoDuelo }
  | { tipo: "aviso"; aviso: string }
  | { tipo: "fallo"; mensaje: string }
  | { tipo: "reiniciar" };

function conFila(filas: FilaTarea[], e: EventoTarea): FilaTarea[] {
  const nueva: FilaTarea = { tarea: e.tarea, estado: e.estado, proveedor: e.proveedor, ms: e.ms, mensaje: e.mensaje };
  const i = filas.findIndex((f) => f.tarea === e.tarea);
  if (i < 0) return [...filas, nueva];
  return filas.map((f, j) => (j === i ? { ...f, ...nueva, proveedor: e.proveedor ?? f.proveedor } : f));
}

function aplicarALado(lado: LadoEstado, e: Exclude<EventoDuelo, { tipo: "duelo" }>): LadoEstado {
  if (e.tipo === "tarea") return { ...lado, filas: conFila(lado.filas, e) };
  if (e.tipo === "resultado") {
    const { tipo, lado: _lado, ...resto } = e as EventoResultado & { lado: Lado };
    void tipo;
    void _lado;
    return { ...lado, resultado: resto };
  }
  if (e.tipo === "manual") return { ...lado, manual: e };
  return { ...lado, error: e.mensaje };
}

export function reducirDuelo(estado: EstadoDuelo, accion: AccionDuelo): EstadoDuelo {
  switch (accion.tipo) {
    case "iniciar":
      return { fase: "corriendo", a: LADO_VACIO, b: LADO_VACIO, avisos: [] };
    case "aviso":
      return { ...estado, avisos: [...estado.avisos, accion.aviso] };
    case "fallo":
      return { ...estado, fase: "error", error: accion.mensaje };
    case "reiniciar":
      return DUELO_INICIAL;
    case "evento": {
      const e = accion.evento;
      if (e.tipo === "duelo") {
        // El evento final trae el resultado de cada lado: se usa aunque no hubiera llegado el suyo.
        const deLado = (lado: Lado): LadoEstado => {
          const previo = estado[lado];
          const final = e[lado];
          if (previo.resultado || !final) return previo;
          const { proveedorLanding, ...resultado } = final;
          void proveedorLanding;
          return { ...previo, resultado };
        };
        return { ...estado, fase: "terminado", final: e, a: deLado("a"), b: deLado("b") };
      }
      // Un error sin lado es el de «fallaron los dos».
      if (!("lado" in e) || !e.lado) return e.tipo === "error" ? { ...estado, fase: "error", error: e.mensaje } : estado;
      // Los eventos de la tarea del juez no pertenecen a ninguna tarjeta: el resultado llega en `duelo`.
      if (e.lado === "juez") return estado;
      return { ...estado, [e.lado]: aplicarALado(estado[e.lado], e) };
    }
  }
}

/** Puntaje que el juez dio a un lado (0 si no hay). */
export function puntajeDe(final: EventoFinalDuelo, lado: Lado): number | null {
  return final.juez ? final.juez[lado].puntaje : null;
}
