import type { Seccion } from "@/lib/contratos";

// Ajustes de presentación que el editor guarda en `seccion.ajustes.presentacion` (grupos Diseño, Espaciado,
// Visibilidad y Avanzado del inspector). Viven junto a los ajustes de la sección, así que no cambian ningún contrato ni
// el prompt de la IA; el render los aplica en el contenedor de la sección. Solo usan tokens.

export const FONDOS = ["ninguno", "superficie", "acento"] as const;
export const ALINEACIONES = ["auto", "izquierda", "centro"] as const;
export const ESPACIADOS = ["compacto", "normal", "amplio"] as const;
export const DISPOSITIVOS_VISIBILIDAD = ["movil", "tablet", "escritorio"] as const;

export type Fondo = (typeof FONDOS)[number];
export type Alineacion = (typeof ALINEACIONES)[number];
export type EspaciadoSeccion = (typeof ESPACIADOS)[number];
export type DispositivoVisibilidad = (typeof DISPOSITIVOS_VISIBILIDAD)[number];

/** Pasos de tamaño de letra: heredado (el de la landing) o de XS a XL. */
export const TAMANOS = ["XS", "S", "M", "L", "XL"] as const;
export type Tamano = (typeof TAMANOS)[number];
export type TamanoSeccion = Tamano | "heredado";
export const PESOS_TITULAR = ["heredado", "normal", "medio", "semi", "negrita"] as const;
export type PesoTitular = (typeof PESOS_TITULAR)[number];

/** Multiplicadores de cada paso. El cuerpo nunca baja de 16 px (lo garantiza `--text-cuerpo` con `max(1rem, …)`). */
export const MULT_TEXTO: Record<Tamano, number> = { XS: 0.9, S: 0.95, M: 1, L: 1.12, XL: 1.25 };
export const MULT_TITULOS: Record<Tamano, number> = { XS: 0.8, S: 0.9, M: 1, L: 1.15, XL: 1.3 };
const VALOR_PESO: Record<Exclude<PesoTitular, "heredado">, number> = { normal: 400, medio: 500, semi: 600, negrita: 700 };

/** Tope de pasos que una persona puede subir o bajar un bloque de texto con − y +. */
export const PASO_MAX_BLOQUE = 3;

export interface Presentacion {
  fondo: Fondo;
  alineacion: Alineacion;
  espaciado: EspaciadoSeccion;
  /** Dispositivos en los que la sección NO se muestra. */
  ocultarEn: DispositivoVisibilidad[];
  /** Ancla para enlaces internos (`#ancla`); solo minúsculas, números, guion y guion bajo. */
  ancla: string;
  /** `object-position` de las imágenes por slot («50% 20%»). */
  focos: Record<string, string>;
  /** Tamaño de letra de esta sección (heredado = el de la landing). */
  tamTitular: TamanoSeccion;
  tamSubtitulo: TamanoSeccion;
  tamTexto: TamanoSeccion;
  pesoTitular: PesoTitular;
  /** Pasos (−3 a +3) de bloques de texto concretos, por ruta del campo (`ajustes.titulo`, `bloques.<id>.texto`). */
  tamanos: Record<string, number>;
  /**
   * Tamaño de letra de TODA la landing. Adaptador hasta que el contrato tenga `tokens.tipografia.escalaTitulos` y
   * `escalaTexto` (peticiones.md): vive en la presentación del héroe, que siempre existe y va primero.
   */
  global?: { titulos: Tamano; texto: Tamano };
}

export const PRESENTACION_POR_DEFECTO: Presentacion = { fondo: "ninguno", alineacion: "auto", espaciado: "normal", ocultarEn: [], ancla: "", focos: {}, tamTitular: "heredado", tamSubtitulo: "heredado", tamTexto: "heredado", pesoTitular: "heredado", tamanos: {} };

const ANCLA = /^[a-z][a-z0-9_-]{0,39}$/;
const FOCO = /^\d{1,3}% \d{1,3}%$/;

function elegir<T extends string>(valor: unknown, validos: readonly T[], porDefecto: T): T {
  return validos.includes(valor as T) ? (valor as T) : porDefecto;
}

/** Lee `ajustes.presentacion` con cualquier basura descartada; siempre devuelve una presentación completa y válida. */
export function leerPresentacion(ajustes: Record<string, unknown> | undefined): Presentacion {
  const crudo = ajustes?.presentacion;
  if (!crudo || typeof crudo !== "object") return PRESENTACION_POR_DEFECTO;
  const p = crudo as Record<string, unknown>;
  const focos: Record<string, string> = {};
  if (p.focos && typeof p.focos === "object") {
    for (const [slot, valor] of Object.entries(p.focos as Record<string, unknown>)) if (typeof valor === "string" && FOCO.test(valor)) focos[slot] = valor;
  }
  const tamanos: Record<string, number> = {};
  if (p.tamanos && typeof p.tamanos === "object") {
    for (const [ruta, paso] of Object.entries(p.tamanos as Record<string, unknown>)) {
      if (typeof paso === "number" && Number.isInteger(paso) && paso !== 0 && Math.abs(paso) <= PASO_MAX_BLOQUE && /^[A-Za-z0-9_.-]{1,80}$/.test(ruta)) tamanos[ruta] = paso;
    }
  }
  const g = p.global as { titulos?: unknown; texto?: unknown } | undefined;
  const global = g && TAMANOS.includes(g.titulos as Tamano) && TAMANOS.includes(g.texto as Tamano) ? { titulos: g.titulos as Tamano, texto: g.texto as Tamano } : undefined;
  return {
    tamTitular: elegir(p.tamTitular, ["heredado", ...TAMANOS] as const, "heredado"),
    tamSubtitulo: elegir(p.tamSubtitulo, ["heredado", ...TAMANOS] as const, "heredado"),
    tamTexto: elegir(p.tamTexto, ["heredado", ...TAMANOS] as const, "heredado"),
    pesoTitular: elegir(p.pesoTitular, PESOS_TITULAR, "heredado"),
    tamanos,
    ...(global ? { global } : {}),
    fondo: elegir(p.fondo, FONDOS, "ninguno"),
    alineacion: elegir(p.alineacion, ALINEACIONES, "auto"),
    espaciado: elegir(p.espaciado, ESPACIADOS, "normal"),
    ocultarEn: Array.isArray(p.ocultarEn) ? DISPOSITIVOS_VISIBILIDAD.filter((d) => (p.ocultarEn as unknown[]).includes(d)) : [],
    ancla: typeof p.ancla === "string" && ANCLA.test(p.ancla) ? p.ancla : "",
    focos,
  };
}

/** Ancla válida a partir de lo que escribe la persona (minúsculas y guiones); vacío si no queda nada usable. */
export function normalizarAncla(texto: string): string {
  const limpia = texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^[^a-z]+/, "")
    .slice(0, 40);
  return ANCLA.test(limpia) ? limpia : "";
}

/** ¿Es la presentación por defecto? Entonces no hace falta guardar nada. */
export function esPresentacionVacia(p: Presentacion): boolean {
  return (
    p.fondo === "ninguno" &&
    p.alineacion === "auto" &&
    p.espaciado === "normal" &&
    p.ocultarEn.length === 0 &&
    p.ancla === "" &&
    Object.keys(p.focos).length === 0 &&
    p.tamTitular === "heredado" &&
    p.tamSubtitulo === "heredado" &&
    p.tamTexto === "heredado" &&
    p.pesoTitular === "heredado" &&
    Object.keys(p.tamanos).length === 0 &&
    !p.global
  );
}

/** Clases del contenedor de la sección. Escritas completas para que Tailwind las encuentre. */
export function clasesDePresentacion(p: Presentacion): string {
  const clases: string[] = [];
  if (p.fondo === "superficie") clases.push("bg-superficie");
  if (p.fondo === "acento") clases.push("bg-acento", "text-acento-texto");
  if (p.alineacion === "izquierda") clases.push("text-left");
  if (p.alineacion === "centro") clases.push("text-center");
  if (p.espaciado === "compacto") clases.push("[--espacio:2.5rem]");
  if (p.espaciado === "amplio") clases.push("[--espacio:8rem]");
  if (p.ocultarEn.includes("movil")) clases.push("max-md:hidden");
  if (p.ocultarEn.includes("tablet")) clases.push("md:max-lg:hidden");
  if (p.ocultarEn.includes("escritorio")) clases.push("lg:hidden");
  return clases.join(" ");
}

/** Guarda la presentación en los ajustes de la sección; si queda igual al valor por defecto, la quita. */
export function conPresentacion(seccion: Seccion, cambios: Partial<Presentacion>): Seccion {
  const nueva = { ...leerPresentacion(seccion.ajustes), ...cambios };
  const ajustes = { ...seccion.ajustes };
  if (esPresentacionVacia(nueva)) delete ajustes.presentacion;
  else ajustes.presentacion = nueva;
  return { ...seccion, ajustes };
}

/** Tipos que ya traen su propio fondo o van fijos: el ritmo de fondos no los toca. */
const SIN_RITMO: readonly string[] = ["heroe", "cinta-anuncio", "cta-fija", "creditos", "html-libre", "formulario-lead", "historia", "escena-uso", "sellos-confianza", "video", "cuenta-regresiva"];

/** Fondo suave alterno (mezcla de `superficie` y `fondo`, solo tokens) que se le da a una sección de cuerpo sí y otra no. */
export const CLASE_FONDO_SUAVE = "bg-[color-mix(in_oklab,var(--c-superficie)_60%,var(--c-fondo))]";

/**
 * Ritmo de fondos: entre las secciones de cuerpo visibles que no eligieron fondo ni traen el suyo, una de cada dos
 * lleva el fondo suave. Devuelve los ids que lo llevan.
 */
export function idsConFondoSuave(secciones: Seccion[]): Set<string> {
  const ids = new Set<string>();
  let alterna = false;
  for (const s of secciones) {
    if (!s.visible || SIN_RITMO.includes(s.tipo) || leerPresentacion(s.ajustes).fondo !== "ninguno") {
      // Una sección con fondo propio corta la alternancia: la siguiente vuelve a empezar en fondo liso.
      if (s.visible && !SIN_RITMO.includes(s.tipo)) alterna = false;
      continue;
    }
    alterna = !alterna;
    if (alterna === false) ids.add(s.id);
  }
  return ids;
}

/** Fondo con el que termina o empieza una sección, para la transición de color entre secciones. */
export function fondoDeBorde(s: Seccion): "acento" | "otro" {
  return leerPresentacion(s.ajustes).fondo === "acento" ? "acento" : "otro";
}

/** Variables CSS de tamaño de una sección: pisan las de la landing solo dentro de ella. */
export function variablesDeTamano(p: Presentacion): Record<string, string> {
  const v: Record<string, string> = {};
  if (p.tamTitular !== "heredado") v["--escala-t"] = String(MULT_TITULOS[p.tamTitular]);
  if (p.tamSubtitulo !== "heredado") v["--escala-s"] = String(MULT_TEXTO[p.tamSubtitulo]);
  if (p.tamTexto !== "heredado") {
    v["--escala"] = String(MULT_TEXTO[p.tamTexto]);
    // Si el subtítulo no eligió su propio paso, sigue al texto de la sección.
    if (p.tamSubtitulo === "heredado") v["--escala-s"] = String(MULT_TEXTO[p.tamTexto]);
  }
  if (p.pesoTitular !== "heredado") v["--peso-titulo"] = String(VALOR_PESO[p.pesoTitular]);
  return v;
}

/** Tamaño global de la landing (en la presentación del héroe) como variables para el contenedor raíz. */
export function variablesGlobales(secciones: Seccion[]): Record<string, string> {
  const g = leerPresentacion(secciones.find((s) => s.tipo === "heroe")?.ajustes).global;
  if (!g) return {};
  return { "--escala": String(MULT_TEXTO[g.texto]), "--escala-t": String(MULT_TITULOS[g.titulos]), "--escala-s": String(MULT_TEXTO[g.texto]) };
}

/** Tamaño de un bloque de texto: `clamp()` alrededor del tamaño base con el paso elegido; el cuerpo no baja de 16 px. */
export function fontSizeDeBloque(basePx: number, paso: number): string {
  const y = basePx * 1.12 ** paso;
  const minimo = basePx >= 16 ? Math.max(16, y * 0.85) : y * 0.8;
  return `clamp(${minimo.toFixed(1)}px, ${y.toFixed(1)}px, ${(y * 1.15).toFixed(1)}px)`;
}
