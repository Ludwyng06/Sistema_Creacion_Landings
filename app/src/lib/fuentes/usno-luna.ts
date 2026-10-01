/* eslint-disable @typescript-eslint/no-explicit-any -- normaliza JSON de una API externa cuya forma no controlamos; se valida campo a campo */
import { pedirJson } from "./http";
import type { Fuente, OpcionesFuente } from "./tipos";

// U.S. Naval Observatory (aa.usno.navy.mil): fase actual, porcentaje iluminado y próxima luna llena. Sin clave.

// Bogotá: la landing se vende en Colombia.
const COORDENADAS = "4.71,-74.07";
const ZONA = "-5";

export interface ConsultaLuna {
  /** AAAA-MM-DD */
  fecha: string;
}

export interface FaseLunar {
  fase: string;
  /** Porcentaje iluminado, 0 a 100. */
  iluminacion: number | null;
  /** AAAA-MM-DD de la próxima luna llena. */
  proximaLlena: string | null;
}

const FASES: Record<string, string> = {
  "new moon": "Luna nueva",
  "waxing crescent": "Luna creciente",
  "first quarter": "Cuarto creciente",
  "waxing gibbous": "Gibosa creciente",
  "full moon": "Luna llena",
  "waning gibbous": "Gibosa menguante",
  "last quarter": "Cuarto menguante",
  "third quarter": "Cuarto menguante",
  "waning crescent": "Luna menguante",
};

export const fraseFase = (fase: string): string => FASES[fase.trim().toLowerCase()] ?? fase;

const dosDigitos = (n: number) => String(n).padStart(2, "0");

export function normalizarLuna(dia: unknown, fases: unknown, fecha: string): FaseLunar {
  const d = (dia as { properties?: { data?: Record<string, any> } })?.properties?.data ?? {};
  const [anio, mes, diaMes] = fecha.split("-").map(Number);
  const cerca = d.closestphase as { day?: number; month?: number; year?: number; phase?: string } | undefined;
  const esHoy = cerca && cerca.year === anio && cerca.month === mes && cerca.day === diaMes;
  const nombre = String(d.curphase ?? (esHoy ? cerca?.phase : "") ?? "");
  if (!nombre) throw new Error("La respuesta del USNO no trae la fase de la Luna.");
  const iluminacion = typeof d.fracillum === "string" ? Number.parseFloat(d.fracillum) : NaN;
  const llena = ((fases as { phasedata?: { phase?: string; year?: number; month?: number; day?: number }[] })?.phasedata ?? []).find((f) => f.phase === "Full Moon");
  return {
    fase: fraseFase(nombre),
    iluminacion: Number.isFinite(iluminacion) ? iluminacion : null,
    proximaLlena: llena?.year && llena.month && llena.day ? `${llena.year}-${dosDigitos(llena.month)}-${dosDigitos(llena.day)}` : null,
  };
}

export function crearUsnoLuna(op: OpcionesFuente = {}): Fuente<ConsultaLuna, FaseLunar> {
  const fechaUsno = (f: string) => f.replace(/-0(\d)/g, "-$1");
  return {
    id: "usno-luna",
    ttl: 6 * 3600,
    // Sin la próxima luna llena (la segunda consulta falló) la respuesta está incompleta: se reintenta pronto.
    ttlDe: (r) => (r.proximaLlena === null ? 300 : 6 * 3600),
    habilitada: () => true,
    async consultar(q, señal) {
      const dia = await pedirJson({ fuente: "usno-luna", url: `https://aa.usno.navy.mil/api/rstt/oneday?${new URLSearchParams({ date: fechaUsno(q.fecha), coords: COORDENADAS, tz: ZONA })}`, señal }, op);
      // La próxima luna llena es un extra: si falla, la fase actual se entrega igual.
      const fases = await pedirJson({ fuente: "usno-luna", url: `https://aa.usno.navy.mil/api/moon/phases/date?${new URLSearchParams({ date: fechaUsno(q.fecha), nump: "8" })}`, señal }, op).catch(() => null);
      return normalizarLuna(dia, fases, q.fecha);
    },
    credito: () => "U.S. Naval Observatory",
  };
}
