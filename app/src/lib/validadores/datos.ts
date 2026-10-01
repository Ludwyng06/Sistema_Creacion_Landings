import type { Brief } from "@/lib/contratos";
import { normalizarTexto } from "@/lib/tecnicas/modulos/util";
import { resultadoDe, type Problema, type Validador } from "./comun";

// Datos reales: precios, porcentajes, calificaciones, cantidades de opiniones, fechas y testimonios
// deben salir del brief o estar marcados `[COMPLETAR]`.

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const NUM = String.raw`(\d[\d.,]*\d|\d)`;

const PATRONES_NUMERO: { tipo: string; re: RegExp }[] = [
  { tipo: "precio", re: new RegExp(String.raw`(?:\$|€|COP|USD|MXN|EUR)\s*${NUM}`, "gi") },
  { tipo: "precio", re: new RegExp(String.raw`${NUM}\s*(?:COP|USD|MXN|EUR|pesos|dólares|dolares|€)(?![\p{L}])`, "giu") },
  { tipo: "porcentaje", re: /(\d+(?:[.,]\d+)?)\s*%/g },
  { tipo: "calificación", re: /(\d(?:[.,]\d)?)\s*\/\s*5(?!\d)/g },
  { tipo: "calificación", re: /(\d(?:[.,]\d)?)\s*(?:estrellas|de\s+5)(?![\p{L}])/giu },
  { tipo: "cantidad", re: new RegExp(String.raw`${NUM}\s*(?:opiniones|reseñas|resenas|valoraciones|clientes|compradores|vendidos|ventas)(?![\p{L}])`, "giu") },
];

const CLAVE_NUMERICA = /precio|valor|calific|opinion|dias|porcentaje|descuento|ahorro/i;

/** "129.000" y "129,000" son miles; "4,8" y "4.8" son decimales. */
export function parseNumero(s: string): number {
  if (/^\d{1,3}([.,]\d{3})+$/.test(s)) return Number(s.replace(/[.,]/g, ""));
  return Number(s.replace(",", "."));
}

interface Fecha {
  anio?: string;
  mm: string;
  dd: string;
}

function fechasDe(texto: string): Fecha[] {
  const salida: Fecha[] = [];
  for (const m of texto.matchAll(/(\d{4})-(\d{2})-(\d{2})/g)) salida.push({ anio: m[1], mm: m[2], dd: m[3] });
  for (const m of texto.matchAll(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/g)) {
    const anio = m[3].length === 2 ? `20${m[3]}` : m[3];
    salida.push({ anio, mm: m[2].padStart(2, "0"), dd: m[1].padStart(2, "0") });
  }
  const re = new RegExp(String.raw`(\d{1,2})\s+de\s+(${MESES.join("|")})(?:\s+de\s+(\d{4}))?`, "gi");
  for (const m of texto.matchAll(re)) {
    const mes = MESES.indexOf(m[2].toLowerCase()) + 1;
    salida.push({ anio: m[3], mm: String(mes).padStart(2, "0"), dd: m[1].padStart(2, "0") });
  }
  return salida;
}

function* valores(valor: unknown, ruta: string): Generator<[string, string | number]> {
  if (typeof valor === "string" || typeof valor === "number") yield [ruta, valor];
  else if (Array.isArray(valor)) {
    for (let i = 0; i < valor.length; i++) yield* valores(valor[i], `${ruta}[${i}]`);
  } else if (valor && typeof valor === "object") {
    for (const [k, v] of Object.entries(valor)) yield* valores(v, `${ruta}.${k}`);
  }
}

function numerosPermitidos(brief: Brief): number[] {
  const permitidos: number[] = [];
  for (const [, v] of valores(brief, "brief")) {
    if (typeof v === "number") permitidos.push(v);
    else for (const m of v.matchAll(/\d[\d.,]*\d|\d/g)) permitidos.push(parseNumero(m[0]));
  }
  const { valor, anterior } = brief.precio;
  if (anterior && anterior > valor) {
    const pct = (1 - valor / anterior) * 100;
    permitidos.push(anterior - valor, Math.round(pct), Math.floor(pct));
  }
  return permitidos;
}

const coincide = (n: number, lista: number[]) => lista.some((p) => Math.abs(p - n) < 0.005);

function fechaPermitida(f: Fecha, permitidas: Fecha[]): boolean {
  return permitidas.some((p) => p.mm === f.mm && p.dd === f.dd && (!f.anio || !p.anio || p.anio === f.anio));
}

/** Amarillo por campo; `pendiente` si no se entrega el brief. */
export const validarDatos: Validador = (doc, brief) => {
  if (!brief) return { resultado: { id: "datos", estado: "pendiente", problemas: [] } };

  const problemas: Problema[] = [];
  const permitidos = numerosPermitidos(brief);
  const fechasBrief: Fecha[] = [];
  for (const [, v] of valores(brief, "brief")) if (typeof v === "string") fechasBrief.push(...fechasDe(v));
  if (brief.oferta) fechasBrief.push(...fechasDe(brief.oferta.fechaFin.slice(0, 10)));

  const testimoniosBrief = brief.pruebaSocial?.testimonios ?? [];
  const textosTestimonio = testimoniosBrief.map((t) => normalizarTexto(t.texto));
  const nombresTestimonio = testimoniosBrief.map((t) => normalizarTexto(t.nombre));

  const revisar = (valor: unknown, base: string) => {
    for (const [ruta, v] of valores(valor, base)) {
      const clave = ruta.replace(/\[\d+\]/g, "").split(".").pop() ?? "";
      if (typeof v === "number") {
        if (CLAVE_NUMERICA.test(clave) && !coincide(v, permitidos)) {
          problemas.push({ ruta, mensaje: `El valor ${v} no está en el brief; usa el dato real o marca [COMPLETAR].` });
        }
        continue;
      }
      if (v.includes("[COMPLETAR]")) continue;
      for (const { tipo, re } of PATRONES_NUMERO) {
        for (const m of v.matchAll(re)) {
          const n = parseNumero(m[1]);
          if (!coincide(n, permitidos)) {
            problemas.push({ ruta, mensaje: `El ${tipo} «${m[0].trim()}» no está en el brief; usa el dato real o marca [COMPLETAR].` });
          }
        }
      }
      for (const f of fechasDe(v)) {
        if (!fechaPermitida(f, fechasBrief)) {
          problemas.push({ ruta, mensaje: `La fecha «${f.dd}/${f.mm}${f.anio ? `/${f.anio}` : ""}» no está en el brief; usa la fecha real o marca [COMPLETAR].` });
        }
      }
    }
  };

  doc.secciones.forEach((s, i) => {
    revisar(s.ajustes, `secciones[${i}].ajustes`);
    s.bloques.forEach((b, j) => {
      revisar(b.ajustes, `secciones[${i}].bloques[${j}].ajustes`);
      if (s.tipo === "testimonios" && b.tipo === "testimonio") {
        const { texto, nombre } = b.ajustes;
        if (typeof texto === "string" && !texto.includes("[COMPLETAR]") && !textosTestimonio.includes(normalizarTexto(texto))) {
          problemas.push({ ruta: `secciones[${i}].bloques[${j}].ajustes.texto`, mensaje: "El testimonio no coincide con los del brief; usa uno real o marca [COMPLETAR]." });
        }
        if (typeof nombre === "string" && !nombre.includes("[COMPLETAR]") && !nombresTestimonio.includes(normalizarTexto(nombre))) {
          problemas.push({ ruta: `secciones[${i}].bloques[${j}].ajustes.nombre`, mensaje: "El nombre del testimonio no está en el brief; usa el real o marca [COMPLETAR]." });
        }
      }
    });
  });

  return { resultado: resultadoDe("datos", problemas) };
};
