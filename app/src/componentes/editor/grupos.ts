import type { LandingDoc, Seccion } from "@/lib/contratos";

// Los grupos del árbol de secciones (§11.1 del v2): Encabezado, Plantilla, Pie y Fijos.
// El orden real del documento no cambia: el grupo se deduce del tipo y solo se reordena dentro del mismo grupo.

export const GRUPOS = ["encabezado", "plantilla", "pie", "fijos"] as const;
export type Grupo = (typeof GRUPOS)[number];

export const NOMBRE_GRUPO: Record<Grupo, string> = {
  encabezado: "Encabezado",
  plantilla: "Plantilla",
  pie: "Pie de página",
  fijos: "Fijos",
};

export function grupoDe(tipo: string): Grupo {
  if (tipo === "cinta-anuncio") return "encabezado";
  if (tipo === "creditos") return "pie";
  if (tipo === "cta-fija") return "fijos";
  return "plantilla";
}

/** Secciones de un grupo con su posición en el documento. */
export function seccionesDelGrupo(doc: LandingDoc, grupo: Grupo): { seccion: Seccion; indice: number }[] {
  return doc.secciones.flatMap((seccion, indice) => (grupoDe(seccion.tipo) === grupo ? [{ seccion, indice }] : []));
}

/**
 * Posición del documento a la que va una sección que se mueve `paso` lugares dentro de su grupo, o `null` si no puede:
 * está en el borde de su grupo o es el héroe (que queda fijo arriba de la plantilla).
 */
export function destinoEnGrupo(doc: LandingDoc, id: string, paso: 1 | -1): number | null {
  const origen = doc.secciones.find((s) => s.id === id);
  if (!origen || origen.tipo === "heroe") return null;
  const miembros = seccionesDelGrupo(doc, grupoDe(origen.tipo));
  const posicion = miembros.findIndex((m) => m.seccion.id === id);
  const vecino = miembros[posicion + paso];
  if (!vecino || vecino.seccion.tipo === "heroe") return null;
  return vecino.indice;
}

/** Dónde entra una sección nueva: cada grupo tiene su lugar; la plantilla va antes del formulario. */
export function posicionParaAgregar(doc: LandingDoc, tipo: string): number {
  const n = doc.secciones.length;
  const ultimo = (grupo: Grupo) => seccionesDelGrupo(doc, grupo).at(-1)?.indice ?? -1;
  switch (grupoDe(tipo)) {
    case "encabezado": {
      // Justo después del héroe si lo hay (el héroe siempre va primero); si no, al inicio.
      const heroe = doc.secciones.findIndex((s) => s.tipo === "heroe");
      return Math.max(ultimo("encabezado") + 1, heroe + 1);
    }
    case "pie": {
      const fijos = seccionesDelGrupo(doc, "fijos")[0]?.indice;
      return fijos ?? n;
    }
    case "fijos":
      return n;
    default: {
      const form = doc.secciones.findIndex((s) => s.tipo === "formulario-lead");
      return form >= 0 ? form : (seccionesDelGrupo(doc, "pie")[0]?.indice ?? seccionesDelGrupo(doc, "fijos")[0]?.indice ?? n);
    }
  }
}
