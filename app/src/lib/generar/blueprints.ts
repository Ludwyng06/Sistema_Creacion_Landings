import type { BriefGeneral, TipoLanding, TipoSeccion } from "@/lib/contratos";

// Blueprints por tipo de landing (docs/v2 §9.1 a §9.6, más divulgación y causa) con nuestros tipos de sección, incluidos los 4 de la 16-B
// (agenda, ponentes, línea de tiempo e impacto). La IA redacta las `obligatorias` (y las `opcionales` que sirvan); el sistema agrega
// las `delSistema` con datos reales (sellos, ficha, dato en vivo, créditos, botón fijo).

export interface Blueprint {
  /** Lo que la conversión significa en este tipo: la estrategia no habla de «comprar» en un evento o una divulgación. */
  conversion: string;
  verbo: string;
  obligatorias: TipoSeccion[];
  opcionales: TipoSeccion[];
  delSistema: TipoSeccion[];
  /** Variantes de héroe que sirven a este tipo (nunca partido). */
  heroes: string[];
  /** Rango de secciones de la landing completa. */
  rango: [number, number];
}

const COMUN_SISTEMA: TipoSeccion[] = ["cta-fija", "creditos"];

export const BLUEPRINTS: Record<TipoLanding, Blueprint> = {
  producto: {
    conversion: "pedir el producto y pagar al recibir",
    verbo: "comprar",
    obligatorias: ["heroe", "problema-solucion", "beneficios", "como-funciona", "galeria", "oferta", "garantia", "faq", "formulario-lead"],
    opcionales: ["incluye", "comparativa", "escena-uso"],
    delSistema: ["sellos-confianza", "ficha-tecnica", ...COMUN_SISTEMA],
    heroes: ["producto-monumental", "titular-tipografico", "orbita-beneficios"],
    rango: [9, 16],
  },
  servicio: {
    conversion: "escribir o pedir una cotización",
    verbo: "contratar",
    obligatorias: ["heroe", "para-quien", "beneficios", "como-funciona", "galeria", "faq", "formulario-lead"],
    opcionales: ["historia", "comparativa", "escena-uso", "garantia"],
    delSistema: COMUN_SISTEMA,
    heroes: ["poster-a-sangre", "titular-tipografico", "producto-monumental"],
    rango: [8, 14],
  },
  evento: {
    conversion: "reservar un cupo y asistir",
    verbo: "asistir",
    obligatorias: ["heroe", "para-quien", "agenda", "galeria", "faq", "formulario-lead"],
    opcionales: ["ponentes", "historia", "beneficios"],
    delSistema: COMUN_SISTEMA,
    heroes: ["poster-a-sangre", "titular-tipografico", "video-inmersivo"],
    rango: [8, 11],
  },
  divulgacion: {
    conversion: "entender el tema y compartirlo",
    verbo: "aprender",
    obligatorias: ["heroe", "resumen", "linea-tiempo", "mecanismo", "galeria", "faq", "formulario-lead"],
    opcionales: ["historia", "para-quien"],
    delSistema: COMUN_SISTEMA,
    heroes: ["poster-a-sangre", "titular-tipografico", "problema-primero"],
    rango: [8, 12],
  },
  curso: {
    conversion: "inscribirse",
    verbo: "aprender",
    obligatorias: ["heroe", "para-quien", "como-funciona", "agenda", "beneficios", "faq", "formulario-lead"],
    opcionales: ["ponentes", "historia", "garantia"],
    delSistema: COMUN_SISTEMA,
    heroes: ["poster-a-sangre", "titular-tipografico", "orbita-beneficios"],
    rango: [9, 15],
  },
  app: {
    conversion: "probar la app",
    verbo: "probar",
    obligatorias: ["heroe", "beneficios", "como-funciona", "comparativa", "faq", "formulario-lead"],
    opcionales: ["para-quien", "escena-uso", "mecanismo"],
    delSistema: COMUN_SISTEMA,
    heroes: ["titular-tipografico", "orbita-beneficios", "producto-monumental"],
    rango: [8, 13],
  },
  causa: {
    conversion: "apoyar la causa",
    verbo: "apoyar",
    obligatorias: ["heroe", "historia", "impacto", "resumen", "galeria", "faq", "formulario-lead"],
    opcionales: ["para-quien", "mecanismo"],
    delSistema: COMUN_SISTEMA,
    heroes: ["poster-a-sangre", "problema-primero", "titular-tipografico"],
    rango: [8, 12],
  },
  local: {
    conversion: "visitar el local o pedir",
    verbo: "visitar",
    obligatorias: ["heroe", "beneficios", "galeria", "escena-uso", "faq", "formulario-lead"],
    opcionales: ["historia", "para-quien"],
    delSistema: COMUN_SISTEMA,
    heroes: ["poster-a-sangre", "mosaico-editorial", "titular-tipografico"],
    rango: [8, 11],
  },
};

export const MAX_SECCIONES = 16;

/** Secciones que escribe la IA: las obligatorias y las opcionales que caben en el rango y que el brief respalda. */
export function planBlueprint(tipo: TipoLanding, brief: Pick<BriefGeneral, "ponentes" | "agenda">, conWidget: boolean): { obligatorias: TipoSeccion[]; opcionales: TipoSeccion[]; delSistema: TipoSeccion[] } {
  const bp = BLUEPRINTS[tipo];
  const delSistema = [...bp.delSistema.filter((t) => t !== "sellos-confianza" && t !== "ficha-tecnica" || tipo === "producto")];
  if (conWidget) delSistema.unshift("dato-en-vivo");
  // Ponentes solo con personas reales dadas por quien encarga: nunca se inventan.
  // La garantía con días solo existe en productos: ningún otro tipo trae ese dato y un [COMPLETAR] visible resta confianza.
  const opcionales = bp.opcionales.filter((t) => (t !== "ponentes" || (brief.ponentes?.length ?? 0) > 0) && (t !== "garantia" || tipo === "producto"));
  const obligatorias = [...bp.obligatorias];
  const libres = Math.min(bp.rango[1], MAX_SECCIONES) - delSistema.length - obligatorias.length;
  return { obligatorias, opcionales: libres > 0 ? opcionales.slice(0, libres) : [], delSistema };
}
