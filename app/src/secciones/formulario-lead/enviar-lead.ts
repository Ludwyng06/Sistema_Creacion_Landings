import type { CampoLead } from "./schema";

export type DatosLead = Partial<Record<CampoLead, string>>;

export type ResultadoLead =
  | { ok: true }
  | {
      ok: false;
      error: string;
      /** Mensajes de validación del servidor (uno por problema). */
      errores?: string[];
      estado?: number;
    };

export interface OpcionesEnvio {
  /** Id de la landing guardada. Sin él (vista previa del editor) no se envía nada. */
  landingId?: string;
  /** Honeypot: las personas lo dejan vacío; un bot lo llena y el servidor lo rechaza. */
  sitio?: string;
}

/**
 * Único punto de salida del formulario: `POST /api/leads`.
 * Sin `landingId` (vista previa) solo confirma en local, para que el editor no cree leads de prueba.
 */
export async function enviarLead(datos: DatosLead, { landingId, sitio = "" }: OpcionesEnvio = {}): Promise<ResultadoLead> {
  if (!landingId) return { ok: true };
  let respuesta: Response;
  try {
    respuesta = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ landingId, datos, sitio }),
    });
  } catch {
    return { ok: false, error: "No pudimos enviar tus datos. Revisa tu conexión e inténtalo otra vez." };
  }
  if (respuesta.ok) return { ok: true };
  let cuerpo: { error?: string; errores?: string[] } = {};
  try {
    cuerpo = (await respuesta.json()) as typeof cuerpo;
  } catch {
    // Sin JSON: se usa el mensaje genérico.
  }
  return {
    ok: false,
    estado: respuesta.status,
    error: cuerpo.error ?? "No pudimos enviar tus datos. Inténtalo de nuevo en un momento.",
    errores: cuerpo.errores,
  };
}
