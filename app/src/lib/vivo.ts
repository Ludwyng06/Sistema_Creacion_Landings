import { DatoEnVivo, type WidgetVivo } from "@/lib/contratos";
import { almacenDb, type AlmacenFuentes } from "@/lib/fuentes/cache";
import { consultarSuave } from "@/lib/fuentes/ejecutar";
import { crearFuentes, type Fuentes } from "@/lib/fuentes/registro";

// Datos en vivo de los widgets (docs/bitacora/tarea-12-A.md §3). Cada widget se normaliza a un `DatoEnVivo`.
// Caché del servidor: auroras 15 min, luna 6 h, ISS 30 s, lanzamiento 1 h y asteroides 12 h (el TTL vive en cada adaptador).
// Si la fuente falla o está apagada devuelve `null`: la ruta responde 204 y el widget se oculta, nunca muestra un error.

export const TTL_WIDGET_SEGUNDOS: Record<WidgetVivo, number> = {
  auroras: 15 * 60,
  "fase-lunar": 6 * 3600,
  iss: 30,
  lanzamiento: 3600,
  asteroides: 12 * 3600,
};

export interface OpcionesVivo {
  fuentes?: Fuentes;
  almacen?: AlmacenFuentes;
  ahora?: () => Date;
}

let fuentesPorDefecto: Fuentes | undefined;

/** AAAA-MM-DD en la zona horaria dada (Bogotá para la luna; UTC para NeoWs). */
export function fechaEn(fecha: Date, desfaseHoras: number): string {
  return new Date(fecha.getTime() + desfaseHoras * 3600_000).toISOString().slice(0, 10);
}

export async function obtenerDatoVivo(widget: WidgetVivo, op: OpcionesVivo = {}): Promise<DatoEnVivo | null> {
  const fuentes = op.fuentes ?? (fuentesPorDefecto ??= crearFuentes());
  const ahora = op.ahora ?? (() => new Date());
  const ctx = { almacen: op.almacen ?? almacenDb, ahora };
  const actualizadoEn = ahora().toISOString();

  let dato: unknown = null;
  switch (widget) {
    case "auroras": {
      const r = await consultarSuave(fuentes.noaaKp, {}, ctx);
      if (r) dato = { widget, kp: r.datos.kp, nivel: r.datos.nivel, actualizadoEn: r.datos.medidoEn };
      break;
    }
    case "fase-lunar": {
      const r = await consultarSuave(fuentes.usnoLuna, { fecha: fechaEn(ahora(), -5) }, ctx);
      if (r) dato = { widget, fase: r.datos.fase, iluminacion: r.datos.iluminacion, proximaLlena: r.datos.proximaLlena, actualizadoEn };
      break;
    }
    case "iss": {
      const r = await consultarSuave(fuentes.iss, {}, ctx);
      if (r) dato = { widget, latitud: r.datos.latitud, longitud: r.datos.longitud, altitudKm: r.datos.altitudKm, velocidadKmh: r.datos.velocidadKmh, actualizadoEn: r.datos.medidoEn };
      break;
    }
    case "lanzamiento": {
      const r = await consultarSuave(fuentes.lanzamientos, { max: 5 }, ctx);
      // La lista viene de la caché y puede tener horas: solo cuenta lo que aún no ocurrió.
      const proximo = r?.datos.find((l) => Date.parse(l.fecha) > ahora().getTime());
      if (proximo) dato = { widget, mision: proximo.mision, cohete: proximo.cohete, proveedor: proximo.proveedor, lugar: proximo.lugar, fechaLanzamiento: proximo.fecha, actualizadoEn };
      break;
    }
    case "asteroides": {
      const fecha = fechaEn(ahora(), 0);
      const r = await consultarSuave(fuentes.neows, { fecha }, ctx);
      if (r) {
        const cerca = r.datos.asteroides[0];
        dato = {
          widget,
          cantidad: r.datos.cantidad,
          masCercano: cerca ? { nombre: cerca.nombre, distanciaKm: Math.round(cerca.distanciaKm), diametroMaxM: Math.round(cerca.diametroMaxM) } : null,
          fecha,
          actualizadoEn,
        };
      }
      break;
    }
  }
  if (!dato) return null;
  const valido = DatoEnVivo.safeParse(dato);
  return valido.success ? valido.data : null;
}
