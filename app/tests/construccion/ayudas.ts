import type { ZodType } from "zod";
import type { Critica, EventoConstruccion, LandingDoc, PeticionConstruir, TareaIA } from "@/lib/contratos";
import { construir } from "@/lib/ia/construir";
import type { DepsEnrutador } from "@/lib/ia/enrutador";
import { validar } from "@/lib/ia/json";
import { tecnicaImagenes } from "@/lib/tecnicas/modulos/imagenes";
import { ErrorIA, type ProveedorId, type ProveedorIA, type RegistradorUso } from "@/lib/ia/tipos";
import { landingEjemplo } from "../fixtures/landing-ejemplo";
import { briefCorrector } from "../tecnicas/briefs";

export { briefCorrector };

export const docBase = (): LandingDoc => structuredClone(landingEjemplo);

/** Deduce la tarea desde el mensaje de sistema (cada tarea del pipeline tiene un rol propio). */
export function tareaDe(sistema: string): TareaIA {
  if (sistema.includes("juzgas un duelo")) return "juez-duelo";
  if (sistema.startsWith("Eres auditor senior")) return "critico";
  if (sistema.startsWith("Eres editor de estilo y corriges")) return "corregir-lista-negra";
  if (sistema.includes("Reescribes textos largos")) return "humanizar";
  if (sistema.startsWith(tecnicaImagenes.aporta.rol!)) return "prompts-grok";
  return "landing";
}

export interface Llamada {
  proveedor: string;
  tarea: TareaIA;
  usuario: string;
  inicio: number;
  fin: number;
}

export type Manejador = (llamada: { tarea: TareaIA; usuario: string; n: number; proveedor: string }) => unknown | Promise<unknown>;

/** Proveedores simulados que comparten un registro de llamadas y un manejador por tarea. */
export function crearProveedores(
  ids: ProveedorId[],
  manejador: Manejador,
  retardoMs = 0,
): { proveedores: ProveedorIA[]; llamadas: Llamada[] } {
  const llamadas: Llamada[] = [];
  const contador: Partial<Record<TareaIA, number>> = {};
  const proveedores = ids.map<ProveedorIA>((id) => ({
    id,
    disponible: () => true,
    async generarJSON<T>(p: { sistema: string; usuario: string; esquema: ZodType<T> }) {
      const tarea = tareaDe(p.sistema);
      const n = (contador[tarea] = (contador[tarea] ?? 0) + 1);
      const inicio = performance.now();
      if (retardoMs) await new Promise((r) => setTimeout(r, retardoMs));
      try {
        const valor = await manejador({ tarea, usuario: p.usuario, n, proveedor: id });
        return { datos: validar(p.esquema, valor), proveedor: id, modelo: `${id}-sim`, ms: 1 };
      } finally {
        llamadas.push({ proveedor: id, tarea, usuario: p.usuario, inicio, fin: performance.now() });
      }
    },
  }));
  return { proveedores, llamadas };
}

export const critica = (puntaje: number): Critica => ({
  puntaje,
  porCriterio: [{ criterio: "Claridad en 3 s", puntaje, evidencia: "secciones[0].ajustes.titular" }],
  problemas: ["El titular es largo"],
  correcciones: ["secciones[0].ajustes.titular: acortar a 8 palabras"],
});

export const docConTitular = (titular: string): LandingDoc => {
  const d = docBase();
  d.secciones[0].ajustes.titular = titular;
  return d;
};

export const peticion = (extra: Partial<PeticionConstruir> = {}): PeticionConstruir => ({
  brief: briefCorrector,
  tecnicas: [],
  numeroSemilla: 42,
  ...extra,
});

export interface Corrida {
  eventos: EventoConstruccion[];
  resultado?: Extract<EventoConstruccion, { tipo: "resultado" }>;
  manual?: Extract<EventoConstruccion, { tipo: "manual" }>;
  error?: Extract<EventoConstruccion, { tipo: "error" }>;
  llamadas: Llamada[];
}

export async function correr(
  ids: ProveedorId[],
  manejador: Manejador,
  opciones: { retardoMs?: number; enrutador?: Partial<DepsEnrutador>; peticion?: Partial<PeticionConstruir> } = {},
): Promise<Corrida> {
  const { proveedores, llamadas } = crearProveedores(ids, manejador, opciones.retardoMs);
  const eventos: EventoConstruccion[] = [];
  const registrarUso: RegistradorUso = async () => {};
  await construir(peticion(opciones.peticion), (e) => eventos.push(e), {
    enrutador: { proveedores, registrarUso, modo: "simultaneo", tablaTareas: {}, espera: async () => {}, ...opciones.enrutador },
  });
  return {
    eventos,
    llamadas,
    resultado: eventos.find((e) => e.tipo === "resultado"),
    manual: eventos.find((e) => e.tipo === "manual"),
    error: eventos.find((e) => e.tipo === "error"),
  };
}

/** Manejador base: landing del ejemplo, prompts-grok mínimo y crítico con 9. */
export function manejadorBase(sobrescribir: Partial<Record<TareaIA, Manejador>> = {}): Manejador {
  return (l) => {
    const propio = sobrescribir[l.tarea];
    if (propio) return propio(l);
    switch (l.tarea) {
      case "landing":
        return docBase();
      case "prompts-grok":
        return { assets: [] };
      case "critico":
        return critica(9);
      default:
        throw new ErrorIA("red", `Sin manejador para ${l.tarea}`);
    }
  };
}
