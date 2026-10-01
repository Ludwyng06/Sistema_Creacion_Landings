import { z } from "zod";
import type { MetaCampo, MetaSeccion } from "@/secciones/meta";
import { meta as m0, schema as s0 } from "@/secciones/heroe/schema";
import { meta as m1, schema as s1 } from "@/secciones/cinta-anuncio/schema";
import { meta as m2, schema as s2 } from "@/secciones/problema-solucion/schema";
import { meta as m3, schema as s3 } from "@/secciones/beneficios/schema";
import { meta as m4, schema as s4 } from "@/secciones/como-funciona/schema";
import { meta as m5, schema as s5 } from "@/secciones/antes-despues/schema";
import { meta as m6, schema as s6 } from "@/secciones/comparativa/schema";
import { meta as m7, schema as s7 } from "@/secciones/galeria/schema";
import { meta as m8, schema as s8 } from "@/secciones/video/schema";
import { meta as m9, schema as s9 } from "@/secciones/testimonios/schema";
import { meta as m10, schema as s10 } from "@/secciones/cifras/schema";
import { meta as m11, schema as s11 } from "@/secciones/oferta/schema";
import { meta as m12, schema as s12 } from "@/secciones/incluye/schema";
import { meta as m13, schema as s13 } from "@/secciones/cuenta-regresiva/schema";
import { meta as m14, schema as s14 } from "@/secciones/faq/schema";
import { meta as m15, schema as s15 } from "@/secciones/garantia/schema";
import { meta as m16, schema as s16 } from "@/secciones/formulario-lead/schema";

// Guía de `ajustes` y `bloques` por tipo de sección, sacada de los esquemas de las secciones (`meta` + Zod), no copiada a mano.
// Sin ella la IA inventa valores («disposicion» libre, textos por encima del máximo) y el validador de esquema queda en rojo.

const SECCIONES: Record<string, { schema: z.ZodType; meta: MetaSeccion }> = {
  heroe: { schema: s0, meta: m0 as MetaSeccion },
  "cinta-anuncio": { schema: s1, meta: m1 as MetaSeccion },
  "problema-solucion": { schema: s2, meta: m2 as MetaSeccion },
  beneficios: { schema: s3, meta: m3 as MetaSeccion },
  "como-funciona": { schema: s4, meta: m4 as MetaSeccion },
  "antes-despues": { schema: s5, meta: m5 as MetaSeccion },
  comparativa: { schema: s6, meta: m6 as MetaSeccion },
  galeria: { schema: s7, meta: m7 as MetaSeccion },
  video: { schema: s8, meta: m8 as MetaSeccion },
  testimonios: { schema: s9, meta: m9 as MetaSeccion },
  cifras: { schema: s10, meta: m10 as MetaSeccion },
  oferta: { schema: s11, meta: m11 as MetaSeccion },
  incluye: { schema: s12, meta: m12 as MetaSeccion },
  "cuenta-regresiva": { schema: s13, meta: m13 as MetaSeccion },
  faq: { schema: s14, meta: m14 as MetaSeccion },
  garantia: { schema: s15, meta: m15 as MetaSeccion },
  "formulario-lead": { schema: s16, meta: m16 as MetaSeccion },
};

type Nodo = Record<string, unknown>;
const esNodo = (v: unknown): v is Nodo => typeof v === "object" && v !== null && !Array.isArray(v);

function propiedades(nodo: unknown): Nodo {
  return esNodo(nodo) && esNodo(nodo.properties) ? nodo.properties : {};
}

/** «a|b|c», «texto (máx. 80)», «lista de textos», «número», «sí/no»… para un campo. */
function describirCampo(campo: MetaCampo | undefined, json: unknown): string {
  const j = esNodo(json) ? json : {};
  if (campo?.opciones?.length) {
    const valores = campo.opciones.filter((o) => !campo.opcionesSoloEditor?.includes(o.valor)).map((o) => `"${o.valor}"`).join("|");
    return campo.multiple ? `lista con valores de ${valores}` : valores;
  }
  if (Array.isArray(j.enum)) return j.enum.map((v) => JSON.stringify(v)).join("|");
  const max = typeof j.maxLength === "number" ? `, máx. ${j.maxLength} caracteres` : "";
  if (campo?.control === "booleano" || j.type === "boolean") return "true o false";
  if (campo?.control === "numero" || j.type === "number" || j.type === "integer") {
    const { minimum: min, maximum: max } = j;
    return typeof min === "number" && typeof max === "number" ? `número de ${min} a ${max}` : typeof min === "number" ? `número desde ${min}` : "número";
  }
  if (campo?.control === "slot") return "nombre de un slot de `assets`";
  if (campo?.lista || j.type === "array") return `lista de textos${max}`;
  // Con valor por defecto el modelo lo omite con facilidad: se le da como ejemplo (p. ej. icono → «check»).
  const ejemplo = typeof campo?.porDefecto === "string" && campo.porDefecto ? `, p. ej. «${campo.porDefecto}»` : "";
  return `texto${max}${ejemplo}`;
}

function describirAjustes(campos: Record<string, MetaCampo>, json: unknown, requeridos: string[]): string {
  return Object.entries(campos)
    .filter(([, c]) => !c.soloEditor)
    .map(([k, c]) => `${k}${requeridos.includes(k) || !c.opcional ? "" : "?"}: ${describirCampo(c, propiedades(json)[k])}`)
    .join("; ");
}

/** Esquema JSON del bloque de tipo `tipo` dentro de `bloques` (un tipo o una unión de tipos). */
function jsonDeBloque(bloques: unknown, tipo: string): unknown {
  const items = esNodo(bloques) ? bloques.items : undefined;
  const opciones = esNodo(items) && Array.isArray(items.anyOf) ? items.anyOf : [items];
  return opciones.find((o) => {
    const t = propiedades(o).tipo;
    return esNodo(t) && (t.const === tipo || (Array.isArray(t.enum) && t.enum.includes(tipo)));
  });
}

/** Una línea por tipo de sección con sus ajustes y bloques válidos. */
export function guiaAjustesPorSeccion(tipos: readonly string[]): string {
  const lineas: string[] = [];
  for (const tipo of tipos) {
    const def = SECCIONES[tipo];
    if (!def || def.meta.soloHumano) continue;
    const json = z.toJSONSchema(def.schema, { io: "input", unrepresentable: "any" });
    const ajustesJson = propiedades(json).ajustes;
    const requeridos = esNodo(ajustesJson) && Array.isArray(ajustesJson.required) ? (ajustesJson.required as string[]) : [];
    const ajustes = describirAjustes(def.meta.ajustes, ajustesJson, requeridos);
    const bloquesJson = propiedades(json).bloques;
    const bloques = Object.entries(def.meta.bloques).map(([bt, b]) => {
      const interno = propiedades(propiedades(jsonDeBloque(bloquesJson, bt)).ajustes);
      const reqB = (() => {
        const aj = propiedades(jsonDeBloque(bloquesJson, bt)).ajustes;
        return esNodo(aj) && Array.isArray(aj.required) ? (aj.required as string[]) : [];
      })();
      const campos = Object.entries(b.campos)
        .map(([k, c]) => `${k}${reqB.includes(k) || !c.opcional ? "" : "?"}: ${describirCampo(c, interno[k])}`)
        .join("; ");
      const cantidad = b.min === b.max ? `${b.min}` : `${b.min} a ${b.max}`;
      return `bloques \`${bt}\` (${cantidad}) { ${campos} }`;
    });
    lineas.push(`- \`${tipo}\`: ajustes { ${ajustes} }${bloques.length ? `; ${bloques.join("; ")}` : "; sin bloques"}`);
  }
  return lineas.join("\n");
}

/** Campos obligatorios sin contenido propio que los modelos omiten con frecuencia; se completan con el valor por defecto de la sección. */
const CAMPOS_DE_ADORNO = ["icono"];

/**
 * Completa el `icono` que falta en secciones y bloques (p. ej. `beneficio.icono`) con el `porDefecto` de su esquema.
 * No toca textos, cifras ni precios: esos vienen del brief y, si faltan, el validador de esquema los marca.
 */
export function completarIconosFaltantes<D extends { secciones: { tipo: string; ajustes: Record<string, unknown>; bloques: { tipo: string; ajustes: Record<string, unknown> }[] }[] }>(doc: D): D {
  const falta = (ajustes: Record<string, unknown>, campo: string) => ajustes[campo] === undefined || ajustes[campo] === "";
  const relleno = (ajustes: Record<string, unknown>, campos: Record<string, MetaCampo> | undefined) => {
    let salida = ajustes;
    for (const k of CAMPOS_DE_ADORNO) {
      const defecto = campos?.[k]?.porDefecto;
      if (typeof defecto === "string" && falta(salida, k)) salida = { ...salida, [k]: defecto };
    }
    return salida;
  };
  return {
    ...doc,
    secciones: doc.secciones.map((s) => {
      const def = SECCIONES[s.tipo];
      if (!def) return s;
      return {
        ...s,
        ajustes: relleno(s.ajustes, def.meta.ajustes),
        bloques: s.bloques.map((b) => ({ ...b, ajustes: relleno(b.ajustes, def.meta.bloques[b.tipo]?.campos) })),
      };
    }),
  };
}
