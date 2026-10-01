import type { LandingDoc, ResultadoValidador } from "@/lib/contratos";
import type { LandingCompleta, ResumenVersion } from "@/lib/landings";
import { ErrorApi } from "../crear/api";

// Llamadas del editor a las APIs de A. Cada error trae un mensaje legible para mostrarlo tal cual.

interface Opciones {
  cuerpo?: unknown;
  formulario?: FormData;
  /** Mensaje para un 404 (por defecto, «función no disponible»). */
  noEncontrado?: string;
}

async function solicitar<T>(metodo: string, ruta: string, { cuerpo, formulario, noEncontrado }: Opciones = {}): Promise<T> {
  let respuesta: Response;
  try {
    respuesta = await fetch(ruta, {
      method: metodo,
      headers: cuerpo !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: formulario ?? (cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined),
    });
  } catch {
    throw new ErrorApi("No hay conexión con el servidor. Revisa tu red e inténtalo de nuevo.");
  }
  if (!respuesta.ok) {
    let datos: Record<string, unknown> | undefined;
    try {
      datos = (await respuesta.json()) as Record<string, unknown>;
    } catch {
      datos = undefined;
    }
    const mensaje =
      respuesta.status === 404
        ? (noEncontrado ?? "Esta función todavía no está disponible. Inténtalo más tarde.")
        : typeof datos?.error === "string"
          ? datos.error
          : `No pudimos completar la acción (código ${respuesta.status}).`;
    throw new ErrorApi(mensaje, respuesta.status, datos);
  }
  return (await respuesta.json()) as T;
}

export const cargarLanding = (id: string) =>
  solicitar<LandingCompleta>("GET", `/api/landings/${id}`, { noEncontrado: "No encontramos esta landing. Puede que se haya eliminado." });

export const guardarDoc = (id: string, doc: LandingDoc) =>
  solicitar<LandingCompleta>("PATCH", `/api/landings/${id}`, { cuerpo: { doc } });

export const renombrar = (id: string, nombre: string) =>
  solicitar<LandingCompleta>("PATCH", `/api/landings/${id}`, { cuerpo: { nombre } });

export const listarVersiones = async (id: string) =>
  (await solicitar<{ versiones: ResumenVersion[] }>("GET", `/api/landings/${id}/versiones`)).versiones;

export const guardarVersion = (id: string, nota?: string) =>
  solicitar<ResumenVersion>("POST", `/api/landings/${id}/versiones`, { cuerpo: { nota } });

export const restaurarVersion = (id: string, versionId: string) =>
  solicitar<LandingCompleta>("POST", `/api/landings/${id}/versiones/${versionId}/restaurar`);

export interface MotivoBanco {
  validador: string;
  ruta: string;
  mensaje: string;
}

export const guardarEnBanco = (id: string, saludRender?: ResultadoValidador) =>
  solicitar<LandingCompleta>("POST", `/api/landings/${id}/banco`, { cuerpo: saludRender ? { saludRender } : {} });

export const regenerarSeccion = (id: string, seccionId: string, instruccion?: string) =>
  solicitar<LandingCompleta & { proveedorRegeneracion?: string }>("POST", `/api/landings/${id}/regenerar-seccion`, {
    cuerpo: { seccionId, instruccion: instruccion?.trim() || undefined },
  });

export interface RespuestaCorregir {
  doc: LandingDoc;
  corregidas: number;
  pendientes: { ruta: string; regla: string; fragmento: string }[];
  avisos: string[];
}

export const corregirInfracciones = (landingId: string) =>
  solicitar<RespuestaCorregir>("POST", "/api/corregir", { cuerpo: { landingId } });

export const subirArchivo = (landingId: string, slot: string, archivo: File) => {
  const formulario = new FormData();
  formulario.set("landingId", landingId);
  formulario.set("slot", slot);
  formulario.set("archivo", archivo);
  return solicitar<{ ruta: string; tipo: "imagen" | "video"; slot: string }>("POST", "/api/assets", { formulario });
};

/**
 * Vuelve a correr el crítico sobre la landing guardada (`POST /api/landings/[id]/critico` de A). Con 503 todavía no hay cupo:
 * la landing sigue pendiente y se puede volver a intentar.
 */
export const reintentarCritico = (id: string) => solicitar<{ landing: LandingCompleta; puntaje: number | null; bajoUmbral: boolean }>("POST", `/api/landings/${id}/critico`, { cuerpo: {} });

/** Llena los marcadores de una landing guardada con fotos de los bancos o de FLUX (`POST /api/landings/[id]/imagenes` de A, sin cuota de texto). */
export const buscarFotos = (id: string) => solicitar<unknown>("POST", `/api/landings/${id}/imagenes`, { cuerpo: {} });

export interface EstadoCritico {
  criticoPendiente: boolean;
  puntaje: number | null;
  /** `null` en las landings que no salieron del generador (manuales, semilla): no tienen crítico que reintentar. */
  etapa: string | null;
  avisos: string[];
  seccionesPorCompletar: string[];
}

export const leerEstadoCritico = (id: string) => solicitar<EstadoCritico>("GET", `/api/landings/${id}/critico`);
