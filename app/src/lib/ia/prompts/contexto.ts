import type { Brief, Semilla, Tokens } from "@/lib/contratos";
import type { Estrategia } from "./estrategia";
import type { InvestigacionVitrina } from "@/lib/vitrina/tipos";

// Bloques de CONTEXTO que comparten las etapas: el brief, el paquete de investigación con sus fuentes, la estrategia, la semilla y los tokens.

export interface EspecificacionConFuente {
  nombre: string;
  valor: string;
  unidad?: string;
  /** Quién la dice: «Vendedor», «Google Shopping CO», «Open Beauty Facts»… */
  fuente: string;
}

export interface PaqueteInvestigacion extends InvestigacionVitrina {
  especificaciones?: EspecificacionConFuente[];
}

const precio = (n: number) => `$${n.toLocaleString("es-CO")}`;

export function textoBrief(b: Brief): string {
  const lineas = [
    `Producto: ${b.nombre} (categoría ${b.categoria}, nivel de conciencia ${b.nivelConciencia})`,
    `Problema: ${b.problema}`,
    `Público: ${b.publico}`,
    `Beneficios del vendedor: ${b.beneficios.join(" | ")}`,
    `Precio fijado por el vendedor: ${precio(b.precio.valor)} ${b.precio.moneda}${b.precio.anterior ? ` (antes ${precio(b.precio.anterior)})` : ""}. Es el único precio que se usa.`,
    `Objeciones: ${b.objeciones.join(" | ") || "ninguna dada"}`,
    b.incluye?.length ? `Incluye: ${b.incluye.join(" | ")}` : "",
    b.garantia ? `Garantía del vendedor: ${b.garantia.dias} días. ${b.garantia.condiciones}` : "Sin garantía dada por el vendedor.",
    "Pago: contraentrega (le pagas al mensajero al recibir). Retracto: 5 días hábiles (Ley 1480). Prueba social: no hay testimonios ni calificaciones y no se inventan.",
  ];
  return lineas.filter(Boolean).join("\n");
}

export function textoInvestigacion(p: PaqueteInvestigacion): string {
  const partes: string[] = [`Consultado el ${p.consultadoEn.slice(0, 10)}. Fuentes: ${p.fuentes.map((f) => `${f.fuente} (${f.estado})`).join(", ")}.`];
  if (p.preciosReferencia.length) {
    partes.push(`Precios de referencia en tiendas (Google Shopping CO; solo comparan, nunca se copian a la oferta):\n${p.preciosReferencia.slice(0, 6).map((x) => `- ${x.titulo}: ${precio(x.precio)}${x.tienda ? ` en ${x.tienda}` : ""}`).join("\n")}`);
  }
  if (p.especificaciones?.length) {
    partes.push(`Especificaciones con fuente:\n${p.especificaciones.map((x) => `- ${x.nombre}: ${x.valor}${x.unidad ? ` ${x.unidad}` : ""} [${x.fuente}]`).join("\n")}`);
  }
  if (p.composicionReferencia.length) {
    partes.push(`Composición de productos parecidos (solo referencia):\n${p.composicionReferencia.slice(0, 3).map((x) => `- ${x.nombre} [${x.fuente}]: ${x.ingredientes}`).join("\n")}`);
  }
  if (p.preguntas.length) partes.push(`Preguntas reales de compradores (Google, «La gente también pregunta»):\n${p.preguntas.map((x) => `- ${x}`).join("\n")}`);
  return partes.join("\n\n");
}

export function textoSemilla(s: Semilla, t: Tokens): string {
  return `Semilla de estilo: ${s.estilo} × ${s.industria}. Paleta ${s.paletaId}, tipografía ${s.tipografiaId}. Colores: acento ${t.colores.acento}, fondo ${t.colores.fondo}, texto ${t.colores.texto}. Títulos en ${t.tipografia.titulos}, cuerpo en ${t.tipografia.cuerpo}.`;
}

export function textoEstrategia(e: Estrategia): string {
  return JSON.stringify(e);
}
