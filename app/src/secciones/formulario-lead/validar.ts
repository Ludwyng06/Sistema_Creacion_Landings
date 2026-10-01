import type { CampoLead } from "./schema";
import type { DatosLead } from "./enviar-lead";

export const ETIQUETAS_CAMPO: Record<CampoLead, string> = {
  nombre: "Nombre",
  correo: "Correo electrónico",
  telefono: "Teléfono",
  ciudad: "Ciudad",
  mensaje: "Mensaje",
};

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validarCampo(campo: CampoLead, valor: string, obligatorio: boolean): string | null {
  if (!valor) return obligatorio ? `Escribe tu ${ETIQUETAS_CAMPO[campo].toLowerCase()}.` : null;
  if (campo === "correo" && !CORREO.test(valor)) return "Revisa el correo: parece incompleto.";
  if (campo === "telefono" && valor.replace(/\D/g, "").length < 7) {
    return "El teléfono debe tener al menos 7 dígitos.";
  }
  return null;
}

/** Devuelve un mensaje por campo con problema; vacío si todo está bien. */
export function validarLead(
  campos: CampoLead[],
  obligatorios: CampoLead[],
  datos: DatosLead,
): Partial<Record<CampoLead, string>> {
  const errores: Partial<Record<CampoLead, string>> = {};
  for (const campo of campos) {
    const mensaje = validarCampo(campo, (datos[campo] ?? "").trim(), obligatorios.includes(campo));
    if (mensaje) errores[campo] = mensaje;
  }
  return errores;
}

const PALABRAS_CAMPO: Record<CampoLead, RegExp> = {
  nombre: /nombre/i,
  correo: /correo/i,
  telefono: /tel[eé]fono/i,
  ciudad: /ciudad/i,
  mensaje: /mensaje/i,
};

/**
 * Reparte los mensajes de validación del servidor entre los campos a los que se refieren.
 * Lo que no menciona ningún campo queda en `generales`.
 */
export function errorPorCampo(
  errores: string[],
  campos: CampoLead[],
): { porCampo: Partial<Record<CampoLead, string>>; generales: string[] } {
  const porCampo: Partial<Record<CampoLead, string>> = {};
  const generales: string[] = [];
  for (const mensaje of errores) {
    const campo = campos.find((c) => PALABRAS_CAMPO[c].test(mensaje) && !(c in porCampo));
    if (campo) porCampo[campo] = mensaje;
    else generales.push(mensaje);
  }
  return { porCampo, generales };
}
