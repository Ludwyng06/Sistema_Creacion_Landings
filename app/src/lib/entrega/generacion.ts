// Generación a medias: la IA se quedó sin cuota antes de que el crítico revisara, o dejó secciones en [COMPLETAR].
import type { LandingDoc } from "@/lib/contratos";

// La landing siempre queda guardada; esto solo decide qué se le cuenta a la persona.

export interface SenalGeneracion {
  /** El crítico no corrió o no terminó. */
  criticoPendiente: boolean;
  /** Secciones que quedaron en [COMPLETAR] por falta de cuota. */
  seccionesPendientes: number;
  /** Marcadores de imagen sin foto (slots sin archivo): se llenan con «Buscar fotos». */
  fotosPendientes?: number;
}

/** Cuántos slots de imagen o video de la landing no tienen archivo todavía (una landing sin `assets` cuenta como 1). */
export function marcadoresSinFoto(doc: Pick<LandingDoc, "assets">): number {
  if (doc.assets.length === 0) return 1;
  return doc.assets.filter((a) => !a.ruta).length;
}

export const SIN_SENAL: SenalGeneracion = { criticoPendiente: false, seccionesPendientes: 0 };

export const hayAvisoGeneracion = (s: SenalGeneracion): boolean => s.criticoPendiente || s.seccionesPendientes > 0 || (s.fotosPendientes ?? 0) > 0;

/** Lee la señal del último evento `listo` de `/api/generar` (`criticoPendiente` y `seccionesPorCompletar`, de la 20-A). */
export function senalDeListo(evento: unknown): SenalGeneracion {
  const e = (evento && typeof evento === "object" ? evento : {}) as Record<string, unknown>;
  return { criticoPendiente: e.criticoPendiente === true, seccionesPendientes: Array.isArray(e.seccionesPorCompletar) ? e.seccionesPorCompletar.length : 0, fotosPendientes: Number(e.fotosPendientes) > 0 ? Math.floor(Number(e.fotosPendientes)) : 0 };
}

/** Las dos frases del aviso, en tono amable. */
export function textoAviso(s: SenalGeneracion): { titulo: string; detalle: string } {
  const n = s.seccionesPendientes;
  if (!s.criticoPendiente && n === 0) {
    return { titulo: "Tu landing está guardada, pero le faltan las fotos", detalle: "Todavía hay marcadores en lugar de imágenes. Puedes buscarlas ahora en los bancos o subir las tuyas en el editor." };
  }
  const secciones = `${n} ${n === 1 ? "sección quedó" : "secciones quedaron"} por completar`;
  if (s.criticoPendiente && n > 0) {
    return {
      titulo: "Tu landing está guardada, pero quedó a medias",
      detalle: `La IA se quedó sin cuota por ahora: ${secciones} y el crítico todavía no la revisó. Puedes reintentar el crítico en unos minutos o completar a mano.`,
    };
  }
  if (s.criticoPendiente) {
    return {
      titulo: "Tu landing está guardada, falta la revisión del crítico",
      detalle: "La IA se quedó sin cuota antes de revisarla. Puedes verla ya y reintentar el crítico en unos minutos.",
    };
  }
  return {
    titulo: "Tu landing está guardada, con secciones por completar",
    detalle: `La IA se quedó sin cuota por ahora y ${secciones}. Las puedes escribir tú en el editor o volver a generarlas más tarde.`,
  };
}
