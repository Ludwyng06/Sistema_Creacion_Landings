// Encargo de /crear (tarea-16.md). Los tipos de contrato (`TipoLanding`, `Faltante`) y los eventos de `POST /api/generar`
// vienen de A; aquí quedan solo las opciones de la pantalla.
import { TIPOS_LANDING, type Faltante, type TipoLanding } from "@/lib/contratos";
import type { Etapa, EventoGenerar } from "@/lib/generar/pipeline";

export { TIPOS_LANDING };
export type { Etapa, EventoGenerar, Faltante, TipoLanding };

export const NOMBRE_TIPO: Record<TipoLanding, string> = {
  producto: "Producto",
  servicio: "Servicio",
  evento: "Evento",
  divulgacion: "Divulgación",
  curso: "Curso",
  app: "App",
  causa: "Causa",
  local: "Local",
};

export const ESTILOS = ["premium", "minimal", "editorial", "divertido", "espacial", "corporativo"] as const;
export type EstiloEncargo = (typeof ESTILOS)[number];
export const NOMBRE_ESTILO: Record<EstiloEncargo, string> = {
  premium: "Premium",
  minimal: "Minimal",
  editorial: "Editorial",
  divertido: "Divertido",
  espacial: "Espacial",
  corporativo: "Corporativo",
};

/** Paletas con nombre; el color de la muestra sale de los tokens de la app, nunca de un hex. */
export const PALETAS = [
  { id: "bosque", nombre: "Bosque", muestra: "bg-marca" },
  { id: "oceano", nombre: "Océano", muestra: "bg-rol" },
  { id: "atardecer", nombre: "Atardecer", muestra: "bg-tarea" },
  { id: "pradera", nombre: "Pradera", muestra: "bg-contexto" },
  { id: "violeta", nombre: "Violeta", muestra: "bg-formato" },
  { id: "noche", nombre: "Noche", muestra: "bg-tinta" },
] as const;
export type PaletaEncargo = (typeof PALETAS)[number]["id"];

export interface Encargo {
  descripcion: string;
  tipo?: TipoLanding;
  estilo?: EstiloEncargo;
  paleta?: PaletaEncargo;
  /** Fotos como data URL (máximo 3). */
  fotos?: string[];
  link?: string;
  /** Datos que la persona fija a mano (marca, precio, fecha, lugar, WhatsApp…) o que llenó como faltantes. */
  datos?: Record<string, string>;
}

/** Los ejemplos pulsables: uno por tipo de la demo del docente, con el tipo que deben detectar. */
export const EJEMPLOS_ENCARGO: { id: string; tipo: TipoLanding; etiqueta: string; texto: string }[] = [
  { id: "meteoros", tipo: "evento", etiqueta: "Noche de meteoros", texto: "Landing para una noche de observación de la lluvia de meteoros en Villa de Leyva" },
  { id: "lanzamiento", tipo: "evento", etiqueta: "Lanzamiento en vivo", texto: "Landing para ver en vivo el próximo lanzamiento de cohete con amigos" },
  { id: "iss", tipo: "divulgacion", etiqueta: "Dónde está la ISS", texto: "Landing educativa: dónde está la Estación Espacial ahora mismo" },
  { id: "asteroides", tipo: "divulgacion", etiqueta: "Asteroides de hoy", texto: "Landing de divulgación sobre los asteroides que pasan hoy cerca de la Tierra" },
  { id: "auroras", tipo: "servicio", etiqueta: "Tours de auroras", texto: "Landing para una agencia de tours de auroras" },
  { id: "lampara", tipo: "producto", etiqueta: "Lámpara de luna", texto: "Landing para vender una lámpara de luna" },
];

// ── Eventos de POST /api/generar (NDJSON) ───────────────────────────────────────────────────────────────────────────
// Una línea por evento (`EventoGenerar` de A): las etapas narran el avance, `faltantes` pide datos que el intake no puede
// inventar, `listo` trae el id de la landing guardada.

export const ETAPAS: readonly Etapa[] = ["intake", "fuentes", "estrategia", "redaccion", "critico"];

export const NOMBRE_ETAPA: Record<Etapa, string> = {
  intake: "Entendiendo tu idea",
  fuentes: "Buscando datos e imágenes",
  estrategia: "Definiendo la estrategia",
  redaccion: "Escribiendo las secciones",
  critico: "Revisando como director creativo",
};

const EVENTO_TIPOS = new Set(["etapa", "faltantes", "listo", "error"]);

/** Valida la forma de una línea del flujo; `null` si no es un evento conocido. */
export function leerEventoGenerar(dato: unknown): EventoGenerar | null {
  if (!dato || typeof dato !== "object") return null;
  const e = dato as Record<string, unknown>;
  if (typeof e.tipo !== "string" || !EVENTO_TIPOS.has(e.tipo)) return null;
  if (e.tipo === "etapa") return typeof e.mensaje === "string" && ETAPAS.includes(e.etapa as Etapa) ? (e as unknown as EventoGenerar) : null;
  if (e.tipo === "faltantes") {
    return Array.isArray(e.faltantes) && e.faltantes.every((f) => f && typeof (f as Faltante).clave === "string" && typeof (f as Faltante).pregunta === "string")
      ? ({ ...e, faltantes: (e.faltantes as Faltante[]).slice(0, 3) } as unknown as EventoGenerar)
      : null;
  }
  if (e.tipo === "listo") return typeof e.id === "string" && e.id ? (e as unknown as EventoGenerar) : null;
  return typeof e.mensaje === "string" ? (e as unknown as EventoGenerar) : null;
}

/** Mantiene solo lo que la persona eligió o escribió; «Auto» y los vacíos no viajan. */
export function limpiarEncargo(e: Encargo): Encargo {
  const datos = Object.fromEntries(Object.entries(e.datos ?? {}).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v !== ""));
  return {
    descripcion: e.descripcion.trim(),
    ...(e.tipo ? { tipo: e.tipo } : {}),
    ...(e.estilo ? { estilo: e.estilo } : {}),
    ...(e.paleta ? { paleta: e.paleta } : {}),
    ...(e.fotos?.length ? { fotos: e.fotos.slice(0, 3) } : {}),
    ...(e.link?.trim() ? { link: e.link.trim() } : {}),
    ...(Object.keys(datos).length ? { datos } : {}),
  };
}

/** Un enlace web válido (http o https). */
export function esEnlaceWeb(texto: string): boolean {
  try {
    const u = new URL(texto.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
