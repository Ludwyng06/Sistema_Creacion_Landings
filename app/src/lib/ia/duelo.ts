import { JuezDuelo as JuezEsquema, type EventoConstruccion, type EventoDuelo, type Lado, type LadoDuelo, type PeticionConstruir } from "@/lib/contratos";
import { construir, type DepsConstruir } from "./construir";
import { TABLA_TAREAS_POR_DEFECTO, ejecutar, type DepsEnrutador } from "./enrutador";
import { proveedoresDisponibles } from "./registro";
import { RUBRICA_CRITICO } from "@/lib/tecnicas/modulos/critico";
import type { ProveedorId } from "./tipos";

// Modo duelo (docs/07 §6): dos proveedores generan la landing en paralelo, un tercero juzga con la rúbrica.
// Los tipos de eventos viven en el contrato (`@/lib/contratos`).

type ResultadoConstruccion = Extract<EventoConstruccion, { tipo: "resultado" }>;
export type { EventoDuelo, Lado, LadoDuelo };
export type Juez = import("@/lib/contratos").JuezDuelo;

export type PeticionDuelo = PeticionConstruir & { proveedores?: [ProveedorId, ProveedorId] };

export class ErrorDuelo extends Error {}

/** Elige competidores y proveedor preferido del juez. Lanza `ErrorDuelo` si no alcanzan los proveedores. */
export function elegirCompetidores(
  disponibles: ProveedorId[],
  preferidoJuez: ProveedorId,
  pedidos?: [ProveedorId, ProveedorId],
): [ProveedorId, ProveedorId] {
  if (pedidos) {
    if (pedidos[0] === pedidos[1]) throw new ErrorDuelo("Elige dos proveedores distintos para el duelo.");
    for (const id of pedidos) {
      if (!disponibles.includes(id)) throw new ErrorDuelo(`El proveedor «${id}» no está disponible (falta su clave).`);
    }
    return pedidos;
  }
  if (disponibles.length < 2) throw new ErrorDuelo("El duelo necesita al menos 2 proveedores con clave en .env.local.");
  const sinJuez = disponibles.filter((id) => id !== preferidoJuez);
  const lista = sinJuez.length >= 2 ? sinJuez : disponibles;
  return [lista[0], lista[1]];
}

const mensajeDe = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function construirDuelo(
  peticion: PeticionDuelo,
  emitir: (e: EventoDuelo) => void,
  deps: { enrutador?: DepsEnrutador } = {},
): Promise<void> {
  const enrutador: DepsEnrutador = { modo: "simultaneo", ...deps.enrutador };
  const env = enrutador.env ?? process.env;
  const disponibles = (enrutador.proveedores ?? proveedoresDisponibles(env)).filter((p) => p.disponible()).map((p) => p.id);
  const tabla = { ...TABLA_TAREAS_POR_DEFECTO, ...enrutador.tablaTareas };

  let ids: [ProveedorId, ProveedorId];
  try {
    ids = elegirCompetidores(disponibles, tabla["juez-duelo"], peticion.proveedores);
  } catch (e) {
    emitir({ tipo: "error", mensaje: mensajeDe(e), lado: "juez" });
    return;
  }
  const lados: Record<Lado, ProveedorId> = { a: ids[0], b: ids[1] };
  const avisos: string[] = [];
  const { proveedores: _omitir, ...base } = peticion;
  void _omitir;

  const correrLado = async (lado: Lado): Promise<LadoDuelo | null> => {
    let resultado: ResultadoConstruccion | undefined;
    let fallo: string | undefined;
    const deLado: DepsConstruir = { enrutador, forzarLanding: lados[lado] };
    await construir(
      base,
      (e) => {
        if (e.tipo === "resultado") resultado = e;
        else if (e.tipo === "error") fallo = e.mensaje;
        else if (e.tipo === "manual") fallo = `${lados[lado]} no pudo generar la landing (${e.intentos.map((i) => `${i.proveedor}: ${i.tipo}`).join(", ") || "sin intentos"}).`;
        emitir({ ...e, lado });
      },
      deLado,
    ).catch((e) => {
      fallo = mensajeDe(e);
    });
    if (!resultado) {
      avisos.push(`El lado ${lado.toUpperCase()} (${lados[lado]}) falló: ${fallo ?? "sin resultado"}`);
      return null;
    }
    const { tipo: _t, ...resto } = resultado;
    void _t;
    return { ...resto, proveedorLanding: resultado.proveedores.landing ?? lados[lado] };
  };

  const [ra, rb] = await Promise.allSettled([correrLado("a"), correrLado("b")]);
  const a = ra.status === "fulfilled" ? ra.value : null;
  const b = rb.status === "fulfilled" ? rb.value : null;

  if (!a && !b) {
    emitir({ tipo: "error", mensaje: `Fallaron los dos lados del duelo. ${avisos.join(" ")}`, lado: "a" });
    return;
  }
  const proveedores = { a: lados.a, b: lados.b };
  if (!a || !b) {
    const ganador: Lado = a ? "a" : "b";
    avisos.push(`Gana el lado ${ganador.toUpperCase()} por defecto.`);
    emitir({ tipo: "duelo", a, b, juez: null, ganador, proveedores, avisos });
    return;
  }

  // Juez: un proveedor distinto a los dos competidores cuando exista.
  let juez: Juez | null = null;
  let proveedorJuez: string | undefined;
  emitir({ tipo: "tarea", tarea: "juez-duelo", estado: "en-curso", lado: "juez" });
  const inicio = performance.now();
  try {
    const r = await ejecutar(
      {
        tarea: "juez-duelo",
        sistema:
          `Eres auditor senior de UX y CRO y juzgas un duelo entre dos landings del mismo brief con evidencia. Usa esta rúbrica (puntaje de 0 a 10, ponderado):\n${RUBRICA_CRITICO}\n\n` +
          'Entrega un objeto JSON { a: Critica, b: Critica, ganador: "a" | "b" | "empate", razon } donde Critica es { puntaje, porCriterio[ { criterio, puntaje, evidencia } ], problemas[], correcciones[] }.',
        usuario:
          `Brief:\n${JSON.stringify(peticion.brief, null, 2)}\n\nLanding A:\n${JSON.stringify({ ...a.doc, critica: undefined }, null, 2)}\n\n` +
          `Landing B:\n${JSON.stringify({ ...b.doc, critica: undefined }, null, 2)}\n\nPuntúa cada una con la rúbrica citando el campo exacto del JSON y elige la ganadora.`,
        esquema: JuezEsquema,
        evitar: [lados.a, lados.b],
      },
      enrutador,
    );
    juez = r.datos;
    proveedorJuez = r.proveedor;
    emitir({ tipo: "tarea", tarea: "juez-duelo", estado: "ok", proveedor: r.proveedor, ms: Math.round(performance.now() - inicio), lado: "juez" });
  } catch (e) {
    avisos.push(`El juez no pudo evaluar el duelo (${mensajeDe(e)}); se usaron los puntajes del crítico de cada lado.`);
    emitir({ tipo: "tarea", tarea: "juez-duelo", estado: "error", mensaje: mensajeDe(e), lado: "juez" });
  }

  // El ganador sigue los puntajes: el del juez, o el del crítico de cada lado si el juez falla.
  const pa = juez?.a.puntaje ?? a.doc.critica?.puntaje ?? 0;
  const pb = juez?.b.puntaje ?? b.doc.critica?.puntaje ?? 0;
  const porPuntaje: Lado | "empate" = pa > pb ? "a" : pb > pa ? "b" : "empate";
  let ganador: Lado | "empate" = juez?.ganador ?? porPuntaje;
  if (juez && juez.ganador !== porPuntaje) {
    avisos.push(`El juez nombró «${juez.ganador}» pero los puntajes (A ${pa}, B ${pb}) dan «${porPuntaje}»; se usó el de mayor puntaje.`);
    ganador = porPuntaje;
  }
  emitir({ tipo: "duelo", a, b, juez, ganador, proveedores: { ...proveedores, juez: proveedorJuez }, avisos });
}
