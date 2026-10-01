import type { EfectoId, LandingDoc, Seccion, Tokens } from "@/lib/contratos";
import { CATALOGO_CLIENTE as CATALOGO_EFECTOS, MAX_NIVEL_3_CLIENTE as MAX_EFECTOS_NIVEL_3 } from "./catalogo-cliente";

/** Efectos construidos: nivel 1 y 2 (día 2) y los 6 de nivel 3 (día 6, `src/efectos/nivel3/`). */
export const EFECTOS_IMPLEMENTADOS: readonly EfectoId[] = [
  "revelar-suave",
  "grano",
  "precio-cae",
  "titular-cinetico",
  "mascara-circular",
  "mascara-persiana",
  "marquee-reactivo",
  "boton-magnetico",
  "cursor-vivo",
  "video-scroll",
  "producto-explotado",
  "pin-coreografia",
  "horizontal",
  "shader-ondas",
  "antes-despues-scroll",
];

function esGlobal(id: EfectoId): boolean {
  return (CATALOGO_EFECTOS[id]?.secciones as readonly string[] | undefined)?.includes("global") ?? false;
}

function pasaCatalogo(id: EfectoId, seccion: Seccion, tokens: Tokens): boolean {
  const definicion = CATALOGO_EFECTOS[id];
  if (!definicion) return false; // fuera del catálogo
  if (!EFECTOS_IMPLEMENTADOS.includes(id)) return false;
  if (definicion.nivel > tokens.intensidad) return false;
  const secciones = definicion.secciones as readonly string[];
  if (!secciones.includes("global") && !secciones.includes(seccion.tipo)) return false;
  if (
    seccion.tipo === "heroe" &&
    definicion.variantesHeroe &&
    !(definicion.variantesHeroe as readonly string[]).includes(seccion.variante ?? "")
  ) {
    return false;
  }
  return true;
}

/**
 * Efectos de una sección que se aplican: están en el catálogo, la sección está permitida
 * y su nivel no supera `tokens.intensidad`. Los demás se ignoran en silencio.
 * Los efectos globales no se incluyen aquí: los activa `efectosGlobales`.
 */
export function efectosAplicables(seccion: Seccion, tokens: Tokens): EfectoId[] {
  return (seccion.efectos ?? []).filter((id) => !esGlobal(id) && pasaCatalogo(id, seccion, tokens));
}

/** Efectos `global` (grano, cursor-vivo): una vez por landing si alguna sección los declara. */
export function efectosGlobales(doc: Pick<LandingDoc, "secciones" | "tokens">): EfectoId[] {
  const activos = new Set<EfectoId>();
  for (const seccion of doc.secciones) {
    if (!seccion.visible) continue;
    for (const id of seccion.efectos ?? []) {
      if (esGlobal(id) && pasaCatalogo(id, seccion, doc.tokens)) activos.add(id);
    }
  }
  return [...activos];
}

export interface EfectosDelDoc {
  /** Efectos que se aplican en cada sección visible, con el tope de nivel 3 ya respetado. */
  porSeccion: Map<string, EfectoId[]>;
  /** Efectos de nivel 3 que sobraron: no se renderizan. */
  recortados: EfectoId[];
}

/**
 * Efectos de cada sección con el tope de la landing: como máximo `MAX_EFECTOS_NIVEL_3` de nivel 3. Si el documento
 * trae más, se conservan los primeros (en el orden de las secciones y de sus efectos) y el resto se descarta.
 */
export function efectosDelDoc(doc: Pick<LandingDoc, "secciones" | "tokens">): EfectosDelDoc {
  const porSeccion = new Map<string, EfectoId[]>();
  const recortados: EfectoId[] = [];
  let fuertes = 0;
  for (const seccion of doc.secciones) {
    if (!seccion.visible) continue;
    const dejados = efectosAplicables(seccion, doc.tokens).filter((id) => {
      if (CATALOGO_EFECTOS[id].nivel !== 3) return true;
      if (fuertes < MAX_EFECTOS_NIVEL_3) {
        fuertes += 1;
        return true;
      }
      recortados.push(id);
      return false;
    });
    porSeccion.set(seccion.id, dejados);
  }
  return { porSeccion, recortados };
}
