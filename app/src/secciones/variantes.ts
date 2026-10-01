import type { WidgetVivo } from "@/lib/contratos";

/** Variantes de las secciones nuevas (12-B); la primera es la de por defecto. */
export const VARIANTES_NUEVAS = {
  "dato-en-vivo": ["auroras", "fase-lunar", "iss", "cuenta-regresiva-lanzamiento", "asteroides"],
  "dato-curioso": ["sabias-que", "real-vs-producto"],
  "ficha-tecnica": ["tabla", "fichas"],
  "sellos-confianza": ["iconos-fila", "franja-texto"],
  creditos: ["lista", "compacta"],
  "agenda": ["lista-horas", "por-dias"],
  "ponentes": ["tarjetas", "destacado"],
  "linea-tiempo": ["vertical", "horizontal"],
  impacto: ["cifras-con-foto", "meta"],
  "para-quien": ["lista-check", "dos-perfiles"],
  mecanismo: ["antes-despues-creencia", "zoom-detalle", "diagrama"],
  historia: ["escena", "carta"],
  resumen: ["lista-todo", "tarjeta-final"],
  "escena-uso": ["mosaico-3", "banda-a-sangre"],
  "cta-fija": ["barra-inferior-movil", "whatsapp-flotante"],
} as const;

export type TipoConVariantes = keyof typeof VARIANTES_NUEVAS;

/** Variante de la sección, o la primera de su tipo si falta o no es válida. */
export function varianteDe<T extends TipoConVariantes>(tipo: T, variante: string | undefined): (typeof VARIANTES_NUEVAS)[T][number] {
  const validas = VARIANTES_NUEVAS[tipo] as readonly string[];
  return (variante && validas.includes(variante) ? variante : validas[0]) as (typeof VARIANTES_NUEVAS)[T][number];
}

/** El widget del API para cada variante de `dato-en-vivo` (la de lanzamiento se llama distinto en el contrato). */
export function widgetDe(variante: (typeof VARIANTES_NUEVAS)["dato-en-vivo"][number]): WidgetVivo {
  return variante === "cuenta-regresiva-lanzamiento" ? "lanzamiento" : variante;
}
