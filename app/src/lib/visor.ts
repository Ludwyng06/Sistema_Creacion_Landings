import { fuentesDe, tematicaDe, type Tematica } from "@/lib/banco";
import type { BloquePrompt, Critica } from "@/lib/contratos";
import { datosPorCompletar, type DatoPendiente } from "@/lib/entrega/completar";
import { marcadoresSinFoto } from "@/lib/entrega/generacion";
import { listaDeRevision, type Revision } from "@/lib/entrega/revision";
import type { LandingCompleta } from "@/lib/landings";
import { registro } from "@/secciones/registro";
import { lineasDeCredito, type LineaCredito } from "@/secciones/creditos/armar";

// Lo que el visor `/ver/[id]` necesita de cada landing del banco: todo serializable, para navegar entre ellas sin recargar.

export const DISPOSITIVOS = ["movil", "tablet", "escritorio"] as const;
export type Dispositivo = (typeof DISPOSITIVOS)[number];

export const ETIQUETA_DISPOSITIVO: Record<Dispositivo, string> = { movil: "Móvil", tablet: "Tablet", escritorio: "Escritorio" };

/** Tamaño del navegador del dispositivo (lo que ve la landing). El escritorio ocupa todo el espacio libre. */
export const MEDIDA_DISPOSITIVO: Record<Dispositivo, { ancho: number; alto: number } | null> = {
  movil: { ancho: 390, alto: 844 },
  tablet: { ancho: 820, alto: 1180 },
  escritorio: null,
};

export function dispositivoDe(valor: string | null | undefined): Dispositivo {
  return DISPOSITIVOS.find((d) => d === valor) ?? "escritorio";
}

export interface ItemVisor {
  id: string;
  slug: string;
  nombre: string;
  producto: string;
  puntaje: number | null;
  tematica: Tematica;
  secciones: number;
  fuentes: string[];
  prompt: Record<BloquePrompt, string>;
  critica: Critica | null;
  creditos: LineaCredito[];
  /** `borrador` o `en-banco`: decide si el botón dice «Guardar en banco» o «Actualizar en el banco». */
  estado: "borrador" | "en-banco";
  /** Lo que corrigió el revisor (etapa 6), para «Qué mejoró el revisor». */
  mejoras: string[];
  /** Los [COMPLETAR] que quedan, con su sección. */
  completar: DatoPendiente[];
  /** Slots de imagen sin archivo (marcadores): activan «Buscar fotos». */
  sinFoto?: number;
  /** La lista de revisión previa a guardar o publicar (§12.2). */
  revision: Revision;
}

/**
 * Las correcciones del crítico a veces llegan con la ruta técnica por delante (`secciones[6].bloques: texto`). Para la persona
 * se vuelve «Galería · bloques: texto»: el nombre de la sección en lugar del índice.
 */
export function humanizarCorreccion(texto: string, doc: LandingCompleta["doc"]): string {
  const m = /^secciones\[(\d+)\]((?:\.[\w-]+|\[\d+\])*)\s*:\s*([\s\S]*)$/.exec(texto.trim());
  if (!m) return texto;
  const seccion = doc.secciones[Number(m[1])];
  const etiqueta = seccion ? (registro[seccion.tipo]?.etiqueta ?? seccion.tipo) : `Sección ${Number(m[1]) + 1}`;
  const campo = m[2].split(/[.\[\]]/).filter((x) => x && !/^\d+$/.test(x)).at(-1);
  return `${etiqueta}${campo && campo !== "ajustes" ? ` · ${campo}` : ""}: ${m[3]}`;
}

export function aItemVisor(l: LandingCompleta): ItemVisor {
  return {
    id: l.id,
    slug: l.slug,
    nombre: l.nombre,
    producto: l.doc.meta.producto,
    puntaje: l.puntaje,
    tematica: tematicaDe(l.doc),
    secciones: l.doc.secciones.filter((s) => s.visible).length,
    fuentes: fuentesDe(l.doc),
    prompt: { rol: l.promptBloques.rol, tarea: l.promptBloques.tarea, contexto: l.promptBloques.contexto, formato: l.promptBloques.formato },
    critica: l.doc.critica ?? null,
    creditos: lineasDeCredito(l.doc.assets),
    estado: l.estado,
    mejoras: (l.doc.critica?.correcciones ?? []).map((c) => humanizarCorreccion(c, l.doc)),
    completar: datosPorCompletar(l.doc),
    sinFoto: marcadoresSinFoto(l.doc),
    revision: listaDeRevision(l.doc),
  };
}

/** Escala que hace caber un dispositivo de `ancho`×`alto` en el espacio libre, sin agrandarlo nunca. */
export function escalaParaCaber(ancho: number, alto: number, libreAncho: number, libreAlto: number): number {
  if (libreAncho <= 0 || libreAlto <= 0) return 1;
  return Math.min(1, libreAncho / ancho, libreAlto / alto);
}

/** Posición siguiente o anterior, dando la vuelta al llegar al final. */
export function vecino(indice: number, total: number, paso: 1 | -1): number {
  return total <= 0 ? 0 : (indice + paso + total) % total;
}
