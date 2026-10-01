import type { DepsEnrutador } from "@/lib/ia/enrutador";
import { actualizarDoc, guardarVersion, obtenerLanding, type LandingCompleta } from "@/lib/landings";
import { almacenCheckpointAjuste, type AlmacenCheckpoint, type Checkpoint } from "./checkpoint";
import { pedirCritica, UMBRAL_GENERAR } from "./pipeline";

export interface DepsReintento {
  enrutador?: DepsEnrutador;
  checkpoint?: AlmacenCheckpoint;
  ahora?: () => Date;
}

/** Contexto mínimo para el crítico cuando no hay checkpoint (landings anteriores a la 20-A): sale del brief guardado. */
function briefDeRespaldo(l: LandingCompleta): string {
  const b = l.brief;
  return [`Nombre: ${b.nombre}`, `Público: ${b.publico}`, `Propuesta: ${b.problema}`, `Beneficios: ${b.beneficios.join(" | ")}`].join("\n");
}

export interface ResultadoReintento {
  landing: LandingCompleta;
  puntaje: number;
  /** `true` si la nota quedó por debajo del umbral: el visor puede ofrecer regenerar las secciones que pidió el crítico. */
  bajoUmbral: boolean;
}

/**
 * Retoma el crítico de una landing guardada sin repetir intake, estrategia ni redacción (checkpoint de la etapa «imagenes»).
 * Lanza el error del enrutador (ErrorCascadaAgotada → 503 en la ruta) si todavía no hay cupo; el checkpoint queda pendiente.
 */
export async function reintentarCritico(id: string, d: DepsReintento = {}): Promise<ResultadoReintento> {
  const almacen = d.checkpoint ?? almacenCheckpointAjuste;
  const landing = await obtenerLanding(id);
  const previo = await almacen.leer(id).catch(() => null);
  const briefTxt = previo?.briefTxt ?? briefDeRespaldo(landing);
  const umbral = previo?.umbral ?? UMBRAL_GENERAR;
  const { critica } = await pedirCritica(landing.doc, briefTxt, d.enrutador);
  const hecho: Checkpoint = {
    etapa: "critico",
    criticoPendiente: false,
    briefTxt,
    umbral,
    avisos: (previo?.avisos ?? []).filter((a) => !/^Crítico pendiente|^El crítico no pudo/.test(a)),
    seccionesPorCompletar: previo?.seccionesPorCompletar ?? [],
    actualizadoEn: (d.ahora?.() ?? new Date()).toISOString(),
  };
  await guardarVersion(id, "Antes del crítico reintentado");
  const actualizada = await actualizarDoc(id, { ...landing.doc, critica });
  await almacen.escribir(id, hecho).catch(() => undefined);
  return { landing: actualizada, puntaje: critica.puntaje, bajoUmbral: critica.puntaje < umbral };
}
