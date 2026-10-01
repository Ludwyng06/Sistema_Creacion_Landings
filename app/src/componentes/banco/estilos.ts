import type { BloquePrompt } from "@/lib/contratos";

// Colores de los 4 bloques del prompt: los mismos tokens del paso 3 de /crear y de /tecnicas.
export const ESTILO_BLOQUE: Record<BloquePrompt, { nombre: string; caja: string; titulo: string; marca: string }> = {
  rol: { nombre: "Rol", caja: "border-rol bg-rol-suave", titulo: "text-rol", marca: "bg-rol text-marca-texto" },
  tarea: { nombre: "Tarea", caja: "border-tarea bg-tarea-suave", titulo: "text-tarea", marca: "bg-tarea text-marca-texto" },
  contexto: { nombre: "Contexto", caja: "border-contexto bg-contexto-suave", titulo: "text-contexto", marca: "bg-contexto text-marca-texto" },
  formato: { nombre: "Formato", caja: "border-formato bg-formato-suave", titulo: "text-formato", marca: "bg-formato text-marca-texto" },
};

/** Semáforo del puntaje del crítico: 8 o más verde, de 6 a menos de 8 ámbar y menos de 6 rojo. */
export function claseDePuntaje(puntaje: number | null): string {
  if (puntaje === null) return "border-linea text-tinta-suave";
  if (puntaje >= 8) return "border-contexto bg-contexto-suave text-contexto";
  if (puntaje >= 6) return "border-tarea bg-tarea-suave text-tarea";
  return "border-error text-error";
}
