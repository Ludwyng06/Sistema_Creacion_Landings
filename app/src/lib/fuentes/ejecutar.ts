import { almacenDb, claveCache, mesDe, type AlmacenFuentes } from "./cache";
import { ErrorFuente, type Fuente } from "./tipos";

/** A este porcentaje del plan mensual la fuente se desactiva (docs/v2 §13.3). */
export const UMBRAL_USO = 0.9;

export interface OpcionesEjecucion {
  almacen?: AlmacenFuentes;
  señal?: AbortSignal;
  ahora?: () => Date;
  /** Ignora la caché y consulta la fuente (sigue guardando el resultado). */
  refrescar?: boolean;
}

export interface Consultado<R> {
  datos: R;
  deCache: boolean;
}

/**
 * Consulta una fuente con caché y contador de uso.
 * Devuelve `null` si la fuente no está habilitada (falta su clave) o llegó al 90 % de su plan mensual: se omite sin error.
 * Lanza `ErrorFuente` si la fuente falla; quien llama decide si eso importa.
 */
export async function consultarConCache<Q, R>(fuente: Fuente<Q, R>, q: Q, op: OpcionesEjecucion = {}): Promise<Consultado<R> | null> {
  if (!fuente.habilitada()) return null;
  const almacen = op.almacen ?? almacenDb;
  const ahora = (op.ahora ?? (() => new Date()))();
  const clave = claveCache(fuente.id, q);

  if (!op.refrescar) {
    const guardado = await almacen.leer(clave, ahora).catch(() => null);
    if (guardado !== null) {
      try {
        return { datos: JSON.parse(guardado) as R, deCache: true };
      } catch {
        // caché dañada: se consulta de nuevo
      }
    }
  }

  if (fuente.limiteMensual !== undefined) {
    const usadas = await almacen.usoMes(fuente.grupoUso ?? fuente.id, mesDe(ahora)).catch(() => 0);
    if (usadas >= Math.floor(fuente.limiteMensual * UMBRAL_USO)) return null;
  }

  // Cuenta la consulta aunque falle: la mayoría de las APIs cobran el intento.
  await almacen.contar(fuente.grupoUso ?? fuente.id, mesDe(ahora)).catch(() => 0);
  const datos = await fuente.consultar(q, op.señal);
  if (datos === undefined) throw new ErrorFuente(fuente.id, "respuesta", `${fuente.id} no devolvió datos.`);
  await almacen.escribir(clave, fuente.id, JSON.stringify(datos), new Date(ahora.getTime() + (fuente.ttlDe?.(datos) ?? fuente.ttl) * 1000)).catch(() => undefined);
  return { datos, deCache: false };
}

/** Como `consultarConCache`, pero un fallo o una fuente apagada devuelve `null`: para widgets y bancos que siguen sin ese dato. */
export async function consultarSuave<Q, R>(fuente: Fuente<Q, R>, q: Q, op: OpcionesEjecucion = {}): Promise<Consultado<R> | null> {
  try {
    return await consultarConCache(fuente, q, op);
  } catch (e) {
    if (e instanceof ErrorFuente) return null;
    throw e;
  }
}
