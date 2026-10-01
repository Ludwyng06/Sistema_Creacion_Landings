import Papa from "papaparse";
import type { LandingDoc } from "@/lib/contratos";
import type { LeadGuardado } from "@/lib/landings";

// Validación de leads contra el formulario del documento, límite de envíos y CSV.

const CAMPOS_BASICOS = ["nombre", "correo", "telefono"];
const ETIQUETAS: Record<string, string> = { nombre: "nombre", correo: "correo", telefono: "teléfono", ciudad: "ciudad", mensaje: "mensaje" };
const MAX_LARGO = 500;
const MAX_LARGO_MENSAJE = 2000;

export interface FormularioLead {
  campos: string[];
  obligatorios: string[];
}

/** Campos del `formulario-lead` del documento; si `obligatorios` falta, lo son nombre, correo y teléfono. */
export function formularioDe(doc: LandingDoc): FormularioLead | null {
  const s = doc.secciones.find((x) => x.tipo === "formulario-lead");
  if (!s) return null;
  const campos = Array.isArray(s.ajustes.campos) ? (s.ajustes.campos as unknown[]).filter((c): c is string => typeof c === "string") : CAMPOS_BASICOS;
  const obligatorios = Array.isArray(s.ajustes.obligatorios)
    ? (s.ajustes.obligatorios as unknown[]).filter((c): c is string => typeof c === "string")
    : campos.filter((c) => CAMPOS_BASICOS.includes(c));
  return { campos, obligatorios };
}

/** Devuelve los datos limpios (solo los campos del formulario) o la lista de errores legibles. */
export function validarLead(
  form: FormularioLead,
  datos: Record<string, string>,
): { ok: true; datos: Record<string, string> } | { ok: false; errores: string[] } {
  const errores: string[] = [];
  const limpios: Record<string, string> = {};
  for (const campo of form.campos) {
    const nombre = ETIQUETAS[campo] ?? campo;
    const valor = (datos[campo] ?? "").trim();
    if (!valor) {
      if (form.obligatorios.includes(campo)) errores.push(`El campo «${nombre}» es obligatorio.`);
      continue;
    }
    if (valor.length > (campo === "mensaje" ? MAX_LARGO_MENSAJE : MAX_LARGO)) {
      errores.push(`El campo «${nombre}» es demasiado largo.`);
      continue;
    }
    if (campo === "correo" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(valor)) {
      errores.push("El correo no tiene un formato válido.");
      continue;
    }
    if (campo === "telefono") {
      const digitos = valor.replace(/[\s()+-]/g, "");
      if (!/^\d{7,15}$/.test(digitos)) {
        errores.push("El teléfono debe tener de 7 a 15 dígitos.");
        continue;
      }
    }
    limpios[campo] = valor;
  }
  return errores.length > 0 ? { ok: false, errores } : { ok: true, datos: limpios };
}

// ---------- Límite de envíos (en memoria) ----------

export const MAX_ENVIOS_POR_MINUTO = 10;
const VENTANA_MS = 60_000;
const envios = new Map<string, number[]>();

/** Registra un envío; devuelve `false` si la landing ya recibió 10 en el último minuto. */
export function registrarEnvio(landingId: string, ahora = Date.now()): boolean {
  const recientes = (envios.get(landingId) ?? []).filter((t) => ahora - t < VENTANA_MS);
  if (recientes.length >= MAX_ENVIOS_POR_MINUTO) {
    envios.set(landingId, recientes);
    return false;
  }
  recientes.push(ahora);
  envios.set(landingId, recientes);
  return true;
}

export function reiniciarLimites(): void {
  envios.clear();
}

// ---------- CSV ----------

/** Evita que Excel interprete una celda como fórmula (=, @, o +/- que no sean un número o teléfono). */
function neutralizar(valor: string): string {
  if (/^[=@]/.test(valor) || (/^[+-]/.test(valor) && !/^[+-]?[\d\s()-]+$/.test(valor))) return `'${valor}`;
  return valor;
}

/** CSV UTF-8 con BOM (para que Excel en Windows abra bien las tildes): columna `fecha` y luego los campos del formulario. */
export function construirCsv(campos: string[], leads: LeadGuardado[]): string {
  const extra = [...new Set(leads.flatMap((l) => Object.keys(l.datos)))].filter((k) => !campos.includes(k));
  const columnas = ["fecha", ...campos, ...extra];
  const filas = leads.map((l) => [l.creadoEn, ...columnas.slice(1).map((c) => neutralizar(l.datos[c] ?? ""))]);
  return `﻿${Papa.unparse({ fields: columnas, data: filas }, { newline: "\r\n" })}`;
}
