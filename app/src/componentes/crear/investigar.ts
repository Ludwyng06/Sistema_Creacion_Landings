// Investigación del producto (09-B): tipos de la respuesta de `POST /api/investigar` (09-A) y reglas de fidelidad.
// Adaptador temporal: si el orquestador agrega `Sugerencia` a contratos, se reemplaza por ese tipo.

export type FuenteSugerencia = { url: string; sitio: string };
export type Sugerencia = { texto: string; fuentes: FuenteSugerencia[]; tieneCifra: boolean };
export type GrupoSugerencia = "beneficios" | "objeciones" | "preguntas";
export type CuotaSerpApi = { usadasMes: number; limiteMes: number };

/** Respuesta de `POST /api/investigar`. Espejo de `src/lib/investigacion/tipos.ts` (A); solo lo que la interfaz lee. */
export type RespuestaInvestigar = {
  sugerencias: Record<GrupoSugerencia, Sugerencia[]>;
  consultas: string[];
  /** Búsquedas de SerpAPI que gastó esta petición (0 si salió de la caché). */
  usadas: number;
  /** Uso del mes contra el plan; `null` si no se pudo leer. */
  cuota: CuotaSerpApi | null;
  borrador: BorradorInvestigado;
  /** `null` si no se mandó foto o la IA no pudo mirarla. */
  identificacion: Identificacion | null;
  precioReferencia: PrecioReferencia | null;
  /** Cosas que la persona debe saber (la foto no se reconoció, una búsqueda falló…). */
  avisos: string[];
};

/** Campo propuesto por la investigación: `{ valor, fuentes[], confianza, origen }` (confianza de 0 a 1). */
export type CampoPropuesto<T> = { valor: T; fuentes: FuenteSugerencia[]; confianza: number; origen?: "foto" | "busqueda" | "foto+busqueda"; motivo?: string };
export type BorradorInvestigado = {
  categoria?: CampoPropuesto<string>;
  problema?: CampoPropuesto<string>;
  publico?: CampoPropuesto<string>;
  beneficios?: CampoPropuesto<string[]>;
  objeciones?: CampoPropuesto<string[]>;
  incluye?: CampoPropuesto<string[]>;
  nivelConciencia?: CampoPropuesto<string>;
  coloresMarca?: CampoPropuesto<string[]>;
  fotos?: CampoPropuesto<string[]>;
};
export type Identificacion = { reconocido: boolean; tipoProducto?: string; confianza?: number };
export type PrecioReferencia = { min: number; max: number; moneda?: "COP" | "USD" | "MXN" | "EUR"; fuentes: FuenteSugerencia[] };

/** Campos del brief que la investigación puede proponer. Precio, prueba social, oferta y garantía nunca están aquí. */
export const CAMPOS_SUGERIBLES = ["categoria", "problema", "publico", "beneficios", "objeciones", "incluye", "nivelConciencia"] as const;
export type CampoSugerible = (typeof CAMPOS_SUGERIBLES)[number];
export type MetaSugerida = { fuentes: FuenteSugerencia[]; confianza: number; motivo?: string };

export const MARCA_COMPLETAR = "[COMPLETAR]";

/** Búsquedas del mes según `cuota` de la API; `null` si no se pudo leer. */
export function usoDelMes(cuota: CuotaSerpApi | null | undefined): { usadas: number; limite: number } | null {
  if (!cuota || !Number.isFinite(cuota.usadasMes) || !Number.isFinite(cuota.limiteMes)) return null;
  return { usadas: cuota.usadasMes, limite: cuota.limiteMes };
}

const CIFRA = /(?:[$€]\s?)?\d+(?:[.,]\d+)*(?:\s?(?:%|estrellas?|opiniones|reseñas|COP|USD|MXN|EUR))?/gi;

export function tieneNumero(texto: string): boolean {
  return /\d/.test(texto);
}

/** Regla de fidelidad: una cifra que viene de internet nunca entra sola; el número queda como `[COMPLETAR]`. */
export function neutralizarCifras(texto: string, tieneCifra: boolean): string {
  let hubo = false;
  const salida = texto.replace(CIFRA, () => {
    hubo = true;
    return MARCA_COMPLETAR;
  });
  if (!hubo && tieneCifra) return `${texto.trim()} ${MARCA_COMPLETAR}`;
  return salida;
}

/** Texto que entra al brief al aceptar una sugerencia. */
export function textoParaBrief(texto: string, tieneCifra: boolean): string {
  return neutralizarCifras(texto.trim(), tieneCifra || tieneNumero(texto));
}

const NIVELES = ["inconsciente", "problema", "solucion", "producto", "total"];
const CATEGORIAS = ["salud-y-bienestar", "hogar", "tecnologia", "belleza", "moda-y-accesorios", "mascotas", "deporte", "cocina", "bebes", "otro"];

function limpiarTexto(t: string): string {
  const limpio = t.trim();
  return tieneNumero(limpio) ? neutralizarCifras(limpio, true) : limpio;
}

function propuesto<T>(c: CampoPropuesto<T> | undefined): c is CampoPropuesto<T> {
  return Boolean(c) && c!.valor !== undefined && c!.valor !== null;
}

type BriefParcial = { categoria: string; problema: string; publico: string; beneficios: string[]; objeciones: string[]; incluye: string[] };

/**
 * Convierte el `borrador` de la API en cambios para el brief. Solo llena campos vacíos (nunca pisa lo que la persona
 * ya escribió) e ignora todo lo que no está en `CAMPOS_SUGERIBLES`: precio, prueba social, oferta y garantía no entran.
 */
export function aplicarBorrador(
  brief: BriefParcial,
  borrador: BorradorInvestigado | undefined,
): { cambios: Record<string, unknown>; meta: Partial<Record<CampoSugerible, MetaSugerida>> } {
  const cambios: Record<string, unknown> = {};
  const meta: Partial<Record<CampoSugerible, MetaSugerida>> = {};
  if (!borrador) return { cambios, meta };
  const ficha = (c: CampoPropuesto<unknown>): MetaSugerida => ({
    fuentes: c.fuentes ?? [],
    confianza: Math.min(1, Math.max(0, Number(c.confianza) || 0)),
    motivo: c.motivo,
  });
  for (const campo of ["beneficios", "objeciones", "incluye"] as const) {
    const c = borrador[campo];
    if (!propuesto(c) || !Array.isArray(c.valor)) continue;
    const valores = c.valor.map((v) => limpiarTexto(String(v))).filter(Boolean);
    if (valores.length === 0 || brief[campo].some((x) => x.trim() !== "")) continue;
    const lista = campo === "objeciones" ? valores : valores.slice(0, 5);
    while (campo === "beneficios" && lista.length < 3) lista.push("");
    cambios[campo] = lista;
    meta[campo] = ficha(c);
  }
  for (const campo of ["problema", "publico"] as const) {
    const c = borrador[campo];
    if (!propuesto(c) || typeof c.valor !== "string" || c.valor.trim() === "" || brief[campo].trim() !== "") continue;
    cambios[campo] = limpiarTexto(c.valor);
    meta[campo] = ficha(c);
  }
  const cat = borrador.categoria;
  if (propuesto(cat) && CATEGORIAS.includes(cat.valor) && brief.categoria === "") {
    cambios.categoria = cat.valor;
    meta.categoria = ficha(cat);
  }
  const nivel = borrador.nivelConciencia;
  if (propuesto(nivel) && NIVELES.includes(nivel.valor)) {
    cambios.nivelConciencia = nivel.valor;
    meta.nivelConciencia = ficha(nivel);
  }
  return { cambios, meta };
}

/** ¿La foto dejó reconocer el producto? Sin `identificacion` (la IA no pudo mirarla) cuenta como no reconocida. */
export function fotoReconocida(r: RespuestaInvestigar): boolean {
  return r.identificacion !== null && r.identificacion !== undefined && r.identificacion.reconocido !== false;
}

export function etiquetaConfianza(confianza: number): "alta" | "media" | "baja" {
  return confianza >= 0.75 ? "alta" : confianza >= 0.5 ? "media" : "baja";
}
