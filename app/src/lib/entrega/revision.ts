import type { LandingDoc } from "@/lib/contratos";
import { CONTRASTE_TEXTO, contraste } from "@/lib/tecnicas/semillas";
import { datosPorCompletar } from "./completar";

// Lista de revisión de la sección 12.2 del v2: lo que se mira antes de guardar en el banco o publicar.
// Solo bloquea lo crítico: [COMPLETAR] en el héroe o en el precio, precio sin definir y contraste por debajo de AA.

export type EstadoRevision = "ok" | "aviso" | "bloquea";

export interface ItemRevision {
  id: "completar" | "precio" | "formulario" | "alt" | "contraste" | "lighthouse";
  titulo: string;
  estado: EstadoRevision;
  detalle: string;
  /** Sección a la que lleva el enlace «Corregir», si el problema tiene una. */
  seccionId?: string;
}

export interface Revision {
  items: ItemRevision[];
  /** Hay al menos un punto que bloquea. */
  bloquea: boolean;
  bloqueos: number;
  avisos: number;
  /** Puntaje estimado de Lighthouse móvil (0–100). */
  lighthouse: number;
}

/** Puntaje orientativo de Lighthouse móvil según el peso de la landing. No reemplaza la medición real con PageSpeed. */
export function estimarLighthouse(doc: LandingDoc): { puntaje: number; imagenes: number; secciones: number } {
  const visibles = doc.secciones.filter((s) => s.visible);
  const imagenes = doc.assets.filter((a) => a.tipo === "imagen" && a.ruta).length;
  const videos = doc.assets.filter((a) => a.tipo === "video" && a.ruta).length;
  const enVivo = visibles.filter((s) => s.tipo === "dato-en-vivo").length;
  const bruto = 98 - Math.max(0, imagenes - 8) * 1.2 - Math.max(0, visibles.length - 14) - enVivo * 2 - videos * 4;
  return { puntaje: Math.round(Math.min(99, Math.max(55, bruto))), imagenes, secciones: visibles.length };
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

export function listaDeRevision(doc: LandingDoc): Revision {
  const items: ItemRevision[] = [];

  // 1. Datos por completar
  const pendientes = datosPorCompletar(doc);
  const criticosPend = pendientes.filter((d) => d.critico);
  items.push({
    id: "completar",
    titulo: "Datos por completar",
    estado: criticosPend.length > 0 ? "bloquea" : pendientes.length > 0 ? "aviso" : "ok",
    detalle:
      pendientes.length === 0
        ? "No queda ningún [COMPLETAR]."
        : criticosPend.length > 0
          ? `Faltan datos en ${[...new Set(criticosPend.map((d) => d.etiqueta))].join(" y ")}: sin ellos la landing no se puede guardar. Hay ${plural(pendientes.length, "dato pendiente", "datos pendientes")} en total.`
          : `Quedan ${plural(pendientes.length, "dato pendiente", "datos pendientes")}: puedes guardar, pero complétalos antes de publicar.`,
    seccionId: (criticosPend[0] ?? pendientes[0])?.seccionId,
  });

  // 2. Precio definido (si la landing vende algo: tiene sección de oferta)
  const ofertas = doc.secciones.filter((s) => s.visible && s.tipo === "oferta");
  if (ofertas.length === 0) {
    items.push({ id: "precio", titulo: "Precio definido", estado: "ok", detalle: "No aplica: la landing no tiene una oferta con precio." });
  } else {
    const sinPrecio = ofertas.find((s) => {
      const precio = s.ajustes.precio;
      return !(typeof precio === "number" && precio > 0);
    });
    items.push({
      id: "precio",
      titulo: "Precio definido",
      estado: sinPrecio ? "bloquea" : "ok",
      detalle: sinPrecio ? "La oferta no tiene precio. Ponlo antes de guardar: nadie compra sin saber cuánto cuesta." : "La oferta muestra su precio.",
      seccionId: sinPrecio?.id,
    });
  }

  // 3. Formulario conectado (los datos llegan a «Leads» de esta landing)
  const formulario = doc.secciones.find((s) => s.visible && s.tipo === "formulario-lead");
  const campos = Array.isArray(formulario?.ajustes.campos) ? (formulario.ajustes.campos as unknown[]) : [];
  const conectado = Boolean(formulario) && (campos.includes("correo") || campos.includes("telefono"));
  items.push({
    id: "formulario",
    titulo: "Formulario conectado",
    estado: conectado ? "ok" : "aviso",
    detalle: conectado
      ? "Los datos que dejen las personas llegan a los leads de esta landing."
      : formulario
        ? "El formulario no pide correo ni teléfono: no podrás contactar a nadie."
        : "La landing no tiene formulario: nadie podrá dejarte sus datos.",
    seccionId: formulario?.id,
  });

  // 4. Imágenes con alt
  const sinAlt = doc.assets.filter((a) => a.tipo === "imagen" && a.ruta && !a.alt.trim());
  items.push({
    id: "alt",
    titulo: "Imágenes con texto alternativo",
    estado: sinAlt.length > 0 ? "aviso" : "ok",
    detalle: sinAlt.length > 0 ? `${plural(sinAlt.length, "imagen no tiene", "imágenes no tienen")} texto alternativo (${sinAlt.map((a) => a.slot).join(", ")}).` : "Todas las imágenes describen lo que muestran.",
  });

  // 5. Contraste AA de los colores de la landing
  const c = doc.tokens.colores;
  const fallas: string[] = [];
  const pares: [string, string, string][] = [
    [c.texto, c.fondo, "texto sobre fondo"],
    [c.acentoTexto, c.acento, "texto sobre el color de acento"],
  ];
  for (const [a, b, nombre] of pares) {
    const r = contraste(a, b);
    if (r < CONTRASTE_TEXTO) fallas.push(`${nombre} (${r.toFixed(1).replace(".", ",")}:1)`);
  }
  items.push({
    id: "contraste",
    titulo: "Contraste AA",
    estado: fallas.length > 0 ? "bloquea" : "ok",
    detalle: fallas.length > 0 ? `No llega a 4,5:1: ${fallas.join(" y ")}. Cambia los colores en Tema.` : "Texto y botones se leen bien (4,5:1 o más).",
  });

  // 6. Lighthouse móvil estimado (nunca bloquea)
  const est = estimarLighthouse(doc);
  items.push({
    id: "lighthouse",
    titulo: "Lighthouse móvil (estimado)",
    estado: est.puntaje >= 90 ? "ok" : "aviso",
    detalle: `≈ ${est.puntaje} según el peso de la página (${plural(est.imagenes, "imagen", "imágenes")}, ${plural(est.secciones, "sección", "secciones")}). Es una estimación: mídelo con PageSpeed antes de publicar.`,
  });

  const bloqueos = items.filter((i) => i.estado === "bloquea").length;
  return { items, bloquea: bloqueos > 0, bloqueos, avisos: items.filter((i) => i.estado === "aviso").length, lighthouse: est.puntaje };
}
