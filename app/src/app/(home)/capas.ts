import type { ModuloTecnica, TecnicaId } from "@/lib/contratos";
import { modulos } from "@/lib/tecnicas";

export type Capa = "rol" | "tarea" | "contexto" | "formato";
export const CAPAS: readonly Capa[] = ["rol", "tarea", "contexto", "formato"];

// Los 4 bloques del prompt con los mismos tokens de color del paso 3 de /crear (clases de la app, sin hex).
export const ESTILO_CAPA: Record<Capa, { caja: string; titulo: string; ficha: string; punto: string }> = {
  rol: { caja: "border-rol bg-rol-suave", titulo: "text-rol", ficha: "border-rol", punto: "bg-rol" },
  tarea: { caja: "border-tarea bg-tarea-suave", titulo: "text-tarea", ficha: "border-tarea", punto: "bg-tarea" },
  contexto: { caja: "border-contexto bg-contexto-suave", titulo: "text-contexto", ficha: "border-contexto", punto: "bg-contexto" },
  formato: { caja: "border-formato bg-formato-suave", titulo: "text-formato", ficha: "border-formato", punto: "bg-formato" },
};

// En el prompt real cada técnica suma a las cuatro capas, así que "dónde encaja" es una decisión narrativa:
// dos fichas por capa, según el papel principal de la técnica. Los textos y los aportes salen de `modulos`.
const CAPA_DE_ENCAJE: Record<TecnicaId, Capa> = {
  semilla: "rol",
  ambicioso: "rol",
  sustractivo: "tarea",
  humana: "tarea",
  imagenes: "contexto",
  video: "contexto",
  critico: "formato",
  negativas: "formato",
};

export const capaDeEncaje = (id: TecnicaId): Capa => CAPA_DE_ENCAJE[id];

/** Capas a las que la técnica aporta de verdad (según `aporta` del módulo). */
export function capasQueAporta(m: ModuloTecnica): Capa[] {
  return CAPAS.filter((c) => (c === "rol" ? Boolean(m.aporta.rol) : (m.aporta[c]?.length ?? 0) > 0));
}

export interface FichaTecnica {
  id: TecnicaId;
  numero: number;
  nombre: string;
  resumen: string;
  capa: Capa;
  aporta: Capa[];
}

/** Las 8 fichas, tomadas del registro de técnicas (nada de textos copiados). */
export function fichasDeTecnicas(): FichaTecnica[] {
  return modulos.map((m) => ({
    id: m.id,
    numero: m.numero,
    nombre: m.nombre,
    resumen: m.descripcionCorta,
    capa: capaDeEncaje(m.id),
    aporta: capasQueAporta(m),
  }));
}
