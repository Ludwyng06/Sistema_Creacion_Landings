import { Brief, type CategoriaBrief, type Moneda, type NivelConciencia } from "@/lib/contratos";
import { PALETAS } from "@/lib/tecnicas/semillas";

// El formulario trabaja con un borrador de textos; `aBrief` lo convierte en el `Brief` de Zod
// y `erroresDelBrief` traduce cada problema a un mensaje en español bajo su campo.

export type TestimonioBorrador = { nombre: string; ciudad: string; texto: string; estrellas: string };

export interface BorradorBrief {
  nombre: string;
  categoria: CategoriaBrief | "";
  problema: string;
  publico: string;
  beneficios: string[];
  precio: string;
  precioAnterior: string;
  moneda: Moneda;
  objeciones: string[];
  nivelConciencia: NivelConciencia;
  calificacion: string;
  numOpiniones: string;
  testimonios: TestimonioBorrador[];
  ofertaActiva: boolean;
  ofertaDescripcion: string;
  ofertaFecha: string;
  incluye: string[];
  garantiaDias: string;
  garantiaCondiciones: string;
  coloresMarca: string[];
  intensidad: 1 | 2 | 3;
}

export const MIN_BENEFICIOS = 3;
export const MAX_BENEFICIOS = 5;
export const MAX_COLORES = 3;

export const BORRADOR_VACIO: BorradorBrief = {
  nombre: "",
  categoria: "",
  problema: "",
  publico: "",
  beneficios: ["", "", ""],
  precio: "",
  precioAnterior: "",
  moneda: "COP",
  objeciones: [],
  nivelConciencia: "problema",
  calificacion: "",
  numOpiniones: "",
  testimonios: [],
  ofertaActiva: false,
  ofertaDescripcion: "",
  ofertaFecha: "",
  incluye: [],
  garantiaDias: "",
  garantiaCondiciones: "",
  coloresMarca: [],
  intensidad: 3,
};

/** Color inicial de una muestra nueva: sale de la primera paleta de la app, no de un valor fijo. */
export const COLOR_INICIAL: string = PALETAS[0].colores.acento;

function numero(texto: string): number | undefined {
  const limpio = texto.trim().replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  if (limpio === "") return undefined;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : Number.NaN;
}

function llena(texto: string): string | undefined {
  const t = texto.trim();
  return t === "" ? undefined : t;
}

function fechaIso(local: string): string | undefined {
  if (!local) return undefined;
  const fecha = new Date(local);
  return Number.isNaN(fecha.getTime()) ? "fecha-invalida" : fecha.toISOString();
}

/** Objeto candidato para `Brief.safeParse`: lo vacío se omite, lo numérico se convierte. */
export function candidatoBrief(b: BorradorBrief): Record<string, unknown> {
  const testimonios = b.testimonios
    .filter((t) => t.nombre.trim() || t.texto.trim() || t.ciudad.trim())
    .map((t) => ({
      nombre: t.nombre.trim(),
      ciudad: llena(t.ciudad),
      texto: t.texto.trim(),
      estrellas: numero(t.estrellas),
    }));
  const pruebaSocial =
    numero(b.calificacion) !== undefined || numero(b.numOpiniones) !== undefined || testimonios.length > 0
      ? { calificacion: numero(b.calificacion), numOpiniones: numero(b.numOpiniones), testimonios: testimonios.length ? testimonios : undefined }
      : undefined;
  const incluye = b.incluye.map((i) => i.trim()).filter(Boolean);
  const hayGarantia = b.garantiaDias.trim() !== "" || b.garantiaCondiciones.trim() !== "";
  return {
    nombre: b.nombre.trim(),
    categoria: b.categoria || undefined,
    problema: b.problema.trim(),
    publico: b.publico.trim(),
    beneficios: b.beneficios.map((x) => x.trim()),
    precio: { valor: numero(b.precio), anterior: numero(b.precioAnterior), moneda: b.moneda },
    objeciones: b.objeciones.map((o) => o.trim()),
    nivelConciencia: b.nivelConciencia,
    pruebaSocial,
    oferta: b.ofertaActiva
      ? { descripcion: b.ofertaDescripcion.trim(), fechaFin: fechaIso(b.ofertaFecha) }
      : undefined,
    incluye: incluye.length ? incluye : undefined,
    garantia: hayGarantia ? { dias: numero(b.garantiaDias), condiciones: b.garantiaCondiciones.trim() } : undefined,
    coloresMarca: b.coloresMarca.length ? b.coloresMarca : undefined,
    intensidad: b.intensidad,
  };
}

export type ErroresBrief = Record<string, string>;

const ETIQUETAS: Record<string, string> = {
  nombre: "el nombre del producto",
  categoria: "una categoría",
  problema: "el problema que resuelve",
  publico: "el público objetivo",
};

function mensajeDe(ruta: string, codigo: string): string {
  const [raiz, segundo, tercero] = ruta.split(".");
  if (raiz in ETIQUETAS) return raiz === "categoria" ? "Elige una categoría." : `Escribe ${ETIQUETAS[raiz]}.`;
  if (raiz === "beneficios") {
    if (segundo === undefined) return `Agrega entre ${MIN_BENEFICIOS} y ${MAX_BENEFICIOS} beneficios.`;
    return "Este beneficio está vacío: escríbelo o quítalo.";
  }
  if (raiz === "precio") {
    if (segundo === "anterior") return "El precio anterior debe ser un número, o déjalo vacío.";
    return codigo === "invalid_type" ? "Escribe el precio como número, por ejemplo 129000." : "El precio no puede ser negativo.";
  }
  if (raiz === "objeciones") return "Esta objeción está vacía: escríbela o quítala.";
  if (raiz === "pruebaSocial") {
    if (segundo === "calificacion") return "La calificación va de 0 a 5.";
    if (segundo === "numOpiniones") return "El número de opiniones debe ser un entero.";
    if (tercero !== undefined) return "Completa el nombre y el texto del testimonio, o quítalo.";
  }
  if (raiz === "oferta") {
    return segundo === "fechaFin" ? "Elige la fecha de fin de la oferta." : "Describe la oferta.";
  }
  if (raiz === "incluye") return "Este elemento está vacío.";
  if (raiz === "garantia") {
    return segundo === "dias" ? "Escribe los días de garantía como número entero." : "Escribe las condiciones de la garantía.";
  }
  if (raiz === "coloresMarca") return "Color no válido.";
  return "Revisa este campo.";
}

/** Errores por campo, con la ruta de Zod como clave (`beneficios.2`, `precio.valor`, `oferta.fechaFin`). */
export function erroresDelBrief(b: BorradorBrief, ahora: number = Date.now()): ErroresBrief {
  const errores: ErroresBrief = {};
  const r = Brief.safeParse(candidatoBrief(b));
  if (!r.success) {
    for (const issue of r.error.issues) {
      const ruta = issue.path.join(".");
      if (!(ruta in errores)) errores[ruta] = mensajeDe(ruta, issue.code);
    }
  }
  if (b.ofertaActiva && b.ofertaFecha && !errores["oferta.fechaFin"]) {
    if (new Date(b.ofertaFecha).getTime() <= ahora) errores["oferta.fechaFin"] = "La fecha de fin debe ser futura.";
  }
  if (b.precioAnterior.trim() && !errores["precio.anterior"] && !errores["precio.valor"]) {
    const v = numero(b.precio);
    const a = numero(b.precioAnterior);
    if (v !== undefined && a !== undefined && a <= v) {
      errores["precio.anterior"] = "El precio anterior debe ser mayor que el actual, o déjalo vacío.";
    }
  }
  return errores;
}

export function briefValido(b: BorradorBrief, ahora?: number): boolean {
  return Object.keys(erroresDelBrief(b, ahora)).length === 0;
}

/** `Brief` ya validado; lanza si el borrador no es válido. */
export function aBrief(b: BorradorBrief): Brief {
  return Brief.parse(candidatoBrief(b));
}

/** Borrador a partir de un `Brief` (lo usa «Rellenar ejemplo»). */
export function deBrief(b: Brief): BorradorBrief {
  return {
    nombre: b.nombre,
    categoria: b.categoria,
    problema: b.problema,
    publico: b.publico,
    beneficios: [...b.beneficios],
    precio: String(b.precio.valor),
    precioAnterior: b.precio.anterior === undefined ? "" : String(b.precio.anterior),
    moneda: b.precio.moneda,
    objeciones: [...b.objeciones],
    nivelConciencia: b.nivelConciencia,
    calificacion: b.pruebaSocial?.calificacion === undefined ? "" : String(b.pruebaSocial.calificacion),
    numOpiniones: b.pruebaSocial?.numOpiniones === undefined ? "" : String(b.pruebaSocial.numOpiniones),
    testimonios: (b.pruebaSocial?.testimonios ?? []).map((t) => ({
      nombre: t.nombre,
      ciudad: t.ciudad ?? "",
      texto: t.texto,
      estrellas: t.estrellas === undefined ? "" : String(t.estrellas),
    })),
    ofertaActiva: Boolean(b.oferta),
    ofertaDescripcion: b.oferta?.descripcion ?? "",
    ofertaFecha: b.oferta ? b.oferta.fechaFin.slice(0, 16) : "",
    incluye: [...(b.incluye ?? [])],
    garantiaDias: b.garantia ? String(b.garantia.dias) : "",
    garantiaCondiciones: b.garantia?.condiciones ?? "",
    coloresMarca: [...(b.coloresMarca ?? [])],
    intensidad: b.intensidad,
  };
}

export { numero as numeroDeTexto };
