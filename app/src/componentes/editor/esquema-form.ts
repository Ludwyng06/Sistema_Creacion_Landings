import type { ZodType } from "zod";
import type { MetaCampo, MetaSeccion } from "@/secciones/meta";

// Generador de formularios: lee el schema Zod de cada sección (y los metadatos del editor de su
// `schema.ts`) y decide qué control corresponde a cada ajuste. No hay formularios escritos por tipo.

export type ClaseControl =
  | "texto"
  | "textoLargo"
  | "select"
  | "multiselect"
  | "booleano"
  | "numero"
  | "lista-texto"
  | "slot"
  | "lista-slot"
  | "numero-o-marca" // número o «[COMPLETAR]»
  | "si-no-texto" // sí, no o un texto corto
  | "json";

export interface CampoForm {
  clave: string;
  etiqueta: string;
  clase: ClaseControl;
  requerido: boolean;
  ayuda?: string;
  opciones?: readonly { valor: string; etiqueta: string }[];
  min?: number;
  max?: number;
  entero?: boolean;
  porDefecto: unknown;
}

export interface BloqueForm {
  tipo: string;
  etiqueta: string;
  min: number;
  max: number;
  campos: CampoForm[];
}

export interface FormularioSeccion {
  ajustes: CampoForm[];
  bloques: BloqueForm[];
  /** Los bloques que no admite el tipo (formularios, cinta…) no muestran la lista. */
  admiteBloques: boolean;
}

type Def = { type: string; [k: string]: unknown };
const def = (z: unknown): Def => (z as { def: Def }).def;

/** Quita `optional`, `default`, `nullable` y devuelve el tipo base y si era opcional. */
function desenvolver(z: ZodType): { base: ZodType; opcional: boolean } {
  let actual = z;
  let opcional = false;
  for (;;) {
    const d = def(actual);
    if (d.type === "optional" || d.type === "default" || d.type === "nullable" || d.type === "prefault") {
      opcional = true;
      actual = d.innerType as ZodType;
      continue;
    }
    return { base: actual, opcional };
  }
}

function tiposDeUnion(z: ZodType): string[] {
  const opciones = (def(z).options as ZodType[]) ?? [];
  return opciones.map((o) => def(o).type + (def(o).type === "literal" ? ":" + String((def(o).values as unknown[])[0]) : ""));
}

const numeroDe = (z: unknown, prop: "minLength" | "maxLength" | "minValue" | "maxValue"): number | undefined => {
  const v = (z as Record<string, unknown>)[prop];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
};

/** Describe un ajuste: qué control usar según su tipo Zod, con los metadatos del editor por encima. */
export function describirCampo(clave: string, z: ZodType, meta?: MetaCampo): CampoForm {
  const { base, opcional } = desenvolver(z);
  const d = def(base);
  const requerido = !opcional && !(meta?.opcional ?? false);
  const comunes = {
    clave,
    etiqueta: meta?.etiqueta ?? clave,
    requerido,
    ayuda: meta?.ayuda,
    porDefecto: meta?.porDefecto,
  };

  if (d.type === "boolean") return { ...comunes, clase: "booleano" };
  if (d.type === "number") {
    return {
      ...comunes,
      clase: "numero",
      min: numeroDe(base, "minValue"),
      max: numeroDe(base, "maxValue"),
      entero: (d as { format?: string }).format === "safeint" || (base as { isInt?: boolean }).isInt === true,
    };
  }
  if (d.type === "enum") {
    const entradas = Object.values(d.entries as Record<string, string>);
    const opciones = meta?.opciones ?? entradas.map((v) => ({ valor: v, etiqueta: v }));
    return { ...comunes, clase: "select", opciones };
  }
  if (d.type === "string") {
    const max = numeroDe(base, "maxLength");
    if (meta?.control === "slot") return { ...comunes, clase: "slot", max };
    const largo = meta?.control === "textoLargo" || max === undefined || max > 120;
    return { ...comunes, clase: largo && meta?.control !== "texto" ? "textoLargo" : "texto", max, min: numeroDe(base, "minLength") };
  }
  if (d.type === "array") {
    const elemento = desenvolver(d.element as ZodType);
    const de = def(elemento.base);
    const min = numeroDe(base, "minLength");
    const max = numeroDe(base, "maxLength");
    if (de.type === "enum") {
      const entradas = Object.values(de.entries as Record<string, string>);
      return { ...comunes, clase: "multiselect", opciones: meta?.opciones ?? entradas.map((v) => ({ valor: v, etiqueta: v })), min, max };
    }
    if (de.type === "string") {
      return { ...comunes, clase: meta?.control === "slot" ? "lista-slot" : "lista-texto", min, max };
    }
    return { ...comunes, clase: "json" };
  }
  if (d.type === "union") {
    const tipos = tiposDeUnion(base);
    if (tipos.includes("boolean") && tipos.includes("string")) return { ...comunes, clase: "si-no-texto" };
    if (tipos.includes("number") && tipos.some((t) => t.startsWith("literal:"))) return { ...comunes, clase: "numero-o-marca" };
    return { ...comunes, clase: "json" };
  }
  if (d.type === "literal") return { ...comunes, clase: "texto" };
  return { ...comunes, clase: "json" };
}

function formasDe(schemaSeccion: ZodType): { ajustes: Record<string, ZodType>; bloque: ZodType | null } {
  const raiz = (schemaSeccion as unknown as { shape?: Record<string, ZodType> }).shape;
  const ajustes = raiz?.ajustes ? (def(raiz.ajustes).type === "object" ? (raiz.ajustes as unknown as { shape: Record<string, ZodType> }).shape : {}) : {};
  const listaBloques = raiz?.bloques ? desenvolver(raiz.bloques).base : null;
  const elemento = listaBloques && def(listaBloques).type === "array" ? (def(listaBloques).element as ZodType) : null;
  return { ajustes, bloque: elemento && def(elemento).type === "object" ? elemento : null };
}

/** Formulario completo de una sección a partir de su schema y sus metadatos. */
export function generarFormulario(schemaSeccion: ZodType, meta: MetaSeccion): FormularioSeccion {
  const { ajustes, bloque } = formasDe(schemaSeccion);
  const campos = Object.entries(ajustes).map(([clave, z]) =>
    describirCampo(clave, z, (meta.ajustes as Record<string, MetaCampo>)[clave]),
  );

  const bloques: BloqueForm[] = [];
  if (bloque) {
    const forma = (bloque as unknown as { shape: Record<string, ZodType> }).shape;
    const tipo = String((def(forma.tipo).values as unknown[])[0]);
    const metaBloque = meta.bloques[tipo];
    const ajustesBloque = (forma.ajustes as unknown as { shape: Record<string, ZodType> }).shape;
    const lista = desenvolver((schemaSeccion as unknown as { shape: Record<string, ZodType> }).shape.bloques).base;
    bloques.push({
      tipo,
      etiqueta: metaBloque?.etiqueta ?? tipo,
      min: numeroDe(lista, "minLength") ?? metaBloque?.min ?? 0,
      max: numeroDe(lista, "maxLength") ?? metaBloque?.max ?? 20,
      campos: Object.entries(ajustesBloque).map(([clave, z]) => describirCampo(clave, z, metaBloque?.campos[clave])),
    });
  }
  return { ajustes: campos, bloques, admiteBloques: bloques.length > 0 && bloques[0].max > 0 };
}

/** Valor inicial de un campo nuevo (bloque nuevo): el de los metadatos o uno neutro según el control. */
export function valorInicial(campo: CampoForm): unknown {
  if (campo.porDefecto !== undefined && campo.porDefecto !== "") return campo.porDefecto;
  switch (campo.clase) {
    case "booleano":
      return false;
    case "numero":
      return campo.min ?? 0;
    case "select":
      return campo.opciones?.[0]?.valor ?? "";
    case "multiselect":
    case "lista-texto":
    case "lista-slot":
      return [];
    case "numero-o-marca":
      return "[COMPLETAR]";
    case "si-no-texto":
      return false;
    default:
      return "";
  }
}

// ── Errores de validación en español ──────────────────────────────────────

interface IssueZod {
  code: string;
  path: PropertyKey[];
  message: string;
  minimum?: number | bigint;
  maximum?: number | bigint;
  origin?: string;
  input?: unknown;
}

function traducirIssue(i: IssueZod): string {
  switch (i.code) {
    case "invalid_type":
      return i.input === undefined ? "Este campo es obligatorio." : "El valor no tiene el formato esperado.";
    case "too_small":
      if (i.origin === "string") return Number(i.minimum) <= 1 ? "Este campo es obligatorio." : `Escribe al menos ${i.minimum} caracteres.`;
      if (i.origin === "array") return `Agrega al menos ${i.minimum}.`;
      return `Debe ser al menos ${i.minimum}.`;
    case "too_big":
      if (i.origin === "string") return `Máximo ${i.maximum} caracteres.`;
      if (i.origin === "array") return `Máximo ${i.maximum}.`;
      return `Debe ser como máximo ${i.maximum}.`;
    case "invalid_value":
    case "invalid_union":
      return "Elige o escribe un valor válido.";
    case "custom":
      return i.message;
    default:
      return "Revisa este valor.";
  }
}

/** Errores por ruta (`ajustes.titular`, `bloques.0.ajustes.texto`) con mensajes en español. */
export function erroresDeSeccion(
  schemaSeccion: ZodType,
  seccion: { ajustes: unknown; bloques: unknown },
): Record<string, string> {
  const r = schemaSeccion.safeParse({ ajustes: seccion.ajustes, bloques: seccion.bloques });
  if (r.success) return {};
  const errores: Record<string, string> = {};
  for (const issue of r.error.issues as unknown as IssueZod[]) {
    const ruta = issue.path.map(String).join(".");
    if (!(ruta in errores)) errores[ruta] = traducirIssue(issue);
  }
  return errores;
}

/** Ajustes de un bloque nuevo: los obligatorios con su valor inicial; los opcionales, sin definir. */
export function ajustesDeBloqueNuevo(bloque: BloqueForm): Record<string, unknown> {
  const ajustes: Record<string, unknown> = {};
  for (const c of bloque.campos) {
    if (c.requerido) ajustes[c.clave] = valorInicial(c);
  }
  return ajustes;
}
