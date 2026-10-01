import type { DatoCurioso, LandingDoc, Seccion, TipoSeccion, WidgetVivo } from "@/lib/contratos";
import type { EntradaVitrina, FilaFicha, VarianteWidget } from "./tipos";

// El plan de secciones de la vitrina (docs/bitacora/tarea-12-A.md §4). La IA escribe el contenido de las secciones «de texto»;
// el sistema arma con datos reales las que dependen de fuentes: sellos, dato en vivo, dato curioso, ficha técnica, créditos y botón fijo.

export const widgetDeVariante = (v: VarianteWidget): WidgetVivo => (v === "cuenta-regresiva-lanzamiento" ? "lanzamiento" : v);

/** Orden final de las secciones. El héroe va primero: el validador de estructura lo exige. */
export const ORDEN_VITRINA: TipoSeccion[] = [
  "heroe",
  "cinta-anuncio",
  "sellos-confianza",
  "problema-solucion",
  "dato-en-vivo",
  "beneficios",
  "como-funciona",
  "comparativa",
  "galeria",
  "dato-curioso",
  "incluye",
  "ficha-tecnica",
  "oferta",
  "garantia",
  "faq",
  "formulario-lead",
  "creditos",
  "cta-fija",
];

/** Tipos que escribe la IA en la vitrina. */
export function tiposDeLaIA(e: EntradaVitrina): TipoSeccion[] {
  const base: TipoSeccion[] = ["cinta-anuncio", "heroe", "problema-solucion", "beneficios", "galeria", "incluye", "oferta", "garantia", "faq", "formulario-lead"];
  // Los de producto suman `como-funciona` (los espaciales ya tienen el dato en vivo y el dato curioso).
  if (e.tematica === "producto") base.splice(4, 0, "como-funciona");
  return base;
}

/** Tipos que arma el sistema. */
export function tiposDelSistema(e: EntradaVitrina): TipoSeccion[] {
  const comunes: TipoSeccion[] = ["sellos-confianza", "ficha-tecnica", "creditos", "cta-fija"];
  return e.tematica === "espacio" ? [...comunes, "dato-en-vivo", "dato-curioso"] : comunes;
}

export const HEROE_ESPACIAL = "poster-a-sangre";
export const HEROE_PRODUCTO = "producto-monumental";
/** Héroe sin imagen: se usa cuando no hay una foto real del producto (el marcador de Grok nunca va en el primer viewport). */
export const HEROE_SIN_IMAGEN = "problema-primero";

/**
 * Bloque que se agrega al contexto del prompt de la tarea `landing`: el plan y los nombres de los slots.
 * La IA solo escribe el contenido; las secciones del sistema las agrega el código con datos reales.
 */
export function textoPlan(e: EntradaVitrina): string {
  const ia = tiposDeLaIA(e);
  const sistema = tiposDelSistema(e);
  const lineas = [
    "PLAN DE SECCIONES DE LA VITRINA (obligatorio; manda sobre el presupuesto de secciones):",
    `Escribe exactamente estas ${ia.length} secciones, en este orden de contenido y una sola vez cada una: ${ia.map((t) => `\`${t}\``).join(" → ")}.`,
    `Héroe: variante \`${e.tematica === "espacio" ? HEROE_ESPACIAL : HEROE_PRODUCTO}\`; el contenido va centrado, nunca partido en dos columnas.`,
    "Slots de imagen (usa estos nombres exactos y declara cada uno en `assets`): héroe → `heroe-fondo`; galería → 4 bloques `imagen` con slots `galeria-1` a `galeria-4` (disposición mosaico); problema-solucion → `imagen: \"problema\"`; incluye → `imagen: \"incluye-empaque\"`.",
    `El sistema agrega después, con datos reales, ${sistema.length} secciones más (${sistema.map((t) => `\`${t}\``).join(", ")}): no las escribas ni repitas su contenido (sellos de pago y envío, ficha técnica, créditos).`,
    e.tematica === "espacio"
      ? "La galería muestra fotos reales del cielo y del espacio como ambiente, no del producto: su título habla del cielo que inspira al producto y no dice que sean fotos del producto. Los pies de foto los pone el sistema."
      : "La galería muestra fotos reales de ambiente relacionadas con el producto: su título no dice que sean fotos del producto. Los pies de foto los pone el sistema.",
    "Fidelidad: usa solo las cifras, precios y fechas del brief; sin testimonios, calificaciones ni número de opiniones; sin logos ni marcas de terceros.",
  ];
  if (e.tematica === "espacio") lineas.push("El espacio es el ambiente y el producto es el protagonista: los titulares hablan del producto y de lo que cambia en el cuarto, no de la NASA. No sugieras respaldo ni afiliación de ninguna agencia.");
  return lineas.join("\n");
}

/** Contexto de la investigación para el prompt: solo referencia, nunca para copiar cifras. */
export function textoInvestigacion(preguntas: string[]): string {
  if (preguntas.length === 0) return "";
  return `Preguntas reales de la gente sobre este tipo de producto (úsalas para el FAQ si aplican al producto; no copies cifras ni marcas):\n${preguntas.map((p) => `- ${p}`).join("\n")}`;
}

// ---------- Secciones que arma el sistema ----------

const animacion = { entrada: "subir" as const, retraso: 0 };
const dosPuntos = (t: string, max: number) => (t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`);

export function seccionSellos(_e: EntradaVitrina): Seccion {
  return {
    id: "sellos-confianza",
    tipo: "sellos-confianza" as TipoSeccion,
    variante: "iconos-fila",
    visible: true,
    intencion: { objetivo: "Quitar el riesgo de comprar a la vista, antes de leer el resto.", emocion: "tranquilidad", objecionQueResponde: "¿Y si no llega o no me sirve?" },
    ajustes: {},
    bloques: [
      { id: "sel-1", tipo: "sello", ajustes: { icono: "billete", titulo: "Pagas al recibir", texto: "Pago contraentrega: le pagas al mensajero cuando llega." } },
      { id: "sel-2", tipo: "sello", ajustes: { icono: "envio", titulo: "Envío a domicilio", texto: "Te lo llevamos hasta la puerta de tu casa." } },
      { id: "sel-4", tipo: "sello", ajustes: { icono: "retorno", titulo: "Derecho de retracto", texto: "Tienes 5 días hábiles para retractarte (Ley 1480)." } },
    ],
    animacion,
  };
}

export function seccionDatoEnVivo(e: EntradaVitrina): Seccion | null {
  if (!e.widget) return null;
  return {
    id: "dato-en-vivo",
    tipo: "dato-en-vivo" as TipoSeccion,
    variante: e.widget.variante,
    visible: true,
    intencion: { objetivo: "Darle vida a la página con un dato real del cielo; se oculta sola si la fuente falla.", emocion: "asombro" },
    ajustes: { titulo: e.widget.titulo, contexto: e.widget.contexto },
    bloques: [],
    animacion,
  };
}

export function seccionDatoCurioso(dato: DatoCurioso | null): Seccion | null {
  if (!dato) return null;
  return {
    id: "dato-curioso",
    tipo: "dato-curioso" as TipoSeccion,
    variante: "sabias-que",
    visible: true,
    intencion: { objetivo: "Sumar asombro con un dato verificable y darle la fuente a quien quiera comprobarlo.", emocion: "asombro" },
    ajustes: { titulo: "¿Sabías que…?", frase: dato.frase, fuenteNombre: dosPuntos(dato.fuente.nombre, 60), fuenteUrl: dato.fuente.url ?? "https://images.nasa.gov" },
    bloques: [],
    animacion,
  };
}

/** Hasta 60 caracteres de la lista, sin cortar un elemento a la mitad. */
function listaCorta(items: string[], max: number): string {
  let salida = "";
  for (const i of items) {
    const siguiente = salida ? `${salida}, ${i}` : i;
    if (siguiente.length > max) break;
    salida = siguiente;
  }
  return salida || dosPuntos(items[0] ?? "", max);
}

const NOMBRE_FUENTE_WIDGET: Record<string, string> = { auroras: "NOAA Space Weather Prediction Center", "fase-lunar": "U.S. Naval Observatory", iss: "wheretheiss.at", "cuenta-regresiva-lanzamiento": "Launch Library 2 (The Space Devs)", asteroides: "NASA NeoWs" };
const pesos = (n: number) => `$${n.toLocaleString("es-CO")}`;

/**
 * Las filas de la ficha: las del vendedor (sin `[COMPLETAR]`: si el dato no existe, la fila no va), la forma de pago, la garantía y lo
 * que incluye, que salen del brief, y datos con fuente de la investigación (precios de tiendas, dato en vivo). Termina con la fuente.
 */
export function filasFicha(e: EntradaVitrina, inv?: { preciosReferencia: { precio: number }[] }): FilaFicha[] {
  const propias = e.ficha.filter((f) => !f.valor.includes("[COMPLETAR]"));
  const derivadas: FilaFicha[] = [{ nombre: "Forma de pago", valor: "Contraentrega" }];
  if (e.brief.incluye?.length) derivadas.push({ nombre: "Incluye", valor: listaCorta(e.brief.incluye, 60) });
  const fuentes = ["Vendedor"];
  const precios = (inv?.preciosReferencia ?? []).map((p) => p.precio).filter((n) => n > 0);
  if (precios.length >= 3) {
    derivadas.push({ nombre: "Precio en tiendas", valor: `${pesos(Math.min(...precios))} a ${pesos(Math.max(...precios))}` });
    fuentes.push("Google Shopping CO");
  }
  if (e.widget) {
    derivadas.push({ nombre: "Dato del cielo en vivo", valor: NOMBRE_FUENTE_WIDGET[e.widget.variante] ?? "Fuente pública" });
    fuentes.push("fuente del dato en vivo");
  }
  derivadas.push({ nombre: "Fuente de los datos", valor: fuentes.join(" y ").slice(0, 60) });
  return [...propias, ...derivadas].slice(0, 12);
}

export function seccionFicha(e: EntradaVitrina, inv?: { preciosReferencia: { precio: number }[] }): Seccion {
  return {
    id: "ficha-tecnica",
    tipo: "ficha-tecnica" as TipoSeccion,
    variante: "tabla",
    visible: true,
    intencion: { objetivo: "Dar los datos concretos que la persona busca antes de pedir.", emocion: "confianza", objecionQueResponde: "¿Qué tan grande es y cómo funciona?" },
    ajustes: { titulo: e.tituloFicha ?? "Ficha técnica" },
    bloques: filasFicha(e, inv).map((f, i) => ({
      id: `esp-${i + 1}`,
      tipo: "especificacion",
      ajustes: { nombre: f.nombre, valor: f.valor, ...(f.unidad ? { unidad: f.unidad } : {}) },
    })),
    animacion,
  };
}

export function seccionCreditos(): Seccion {
  return {
    id: "creditos",
    tipo: "creditos" as TipoSeccion,
    variante: "lista",
    visible: true,
    intencion: { objetivo: "Dar el crédito y la licencia de cada imagen, como piden sus autores." },
    ajustes: { titulo: "Créditos de las imágenes" },
    bloques: [],
  };
}

export function seccionCtaFija(e: EntradaVitrina): Seccion {
  return {
    id: "cta-fija",
    tipo: "cta-fija" as TipoSeccion,
    variante: "barra-inferior-movil",
    visible: true,
    intencion: { objetivo: "Mantener a la vista el camino al formulario mientras la persona lee." },
    ajustes: { texto: dosPuntos(e.textoCta, 40) },
    bloques: [],
  };
}

export interface ContextoSistema {
  entrada: EntradaVitrina;
  dato: DatoCurioso | null;
  /** `true` si algún asset lleva crédito: sin créditos no hay sección. */
  hayCreditos: boolean;
  /** Tipos que la IA escribió y se conservan; por defecto, los del plan fijo de la 12-A. */
  permitidas?: string[];
  /** Solo estas secciones del sistema se agregan (por defecto todas, como en la vitrina). */
  sistema?: string[];
  /** Orden final de los tipos; los que no estén van al final (por defecto, el de la vitrina). */
  orden?: string[];
  /** Precios de referencia de la investigación, para la ficha. */
  investigacion?: { preciosReferencia: { precio: number }[] };
}

/** Suma las secciones del sistema al documento de la IA y las deja en el orden de la vitrina. Es idempotente. */
export function agregarSeccionesDelSistema(doc: LandingDoc, c: ContextoSistema): LandingDoc {
  // Solo quedan las secciones del plan de la IA, una por tipo: la IA no agrega testimonios, cifras ni otras secciones sin datos.
  const permitidas = new Set<string>(c.permitidas ?? tiposDeLaIA(c.entrada));
  const vistas = new Set<string>();
  const propias = doc.secciones.filter((s) => {
    if (!permitidas.has(s.tipo) || vistas.has(s.tipo)) return false;
    vistas.add(s.tipo);
    return true;
  });
  const quiere = (t: string) => !c.sistema || c.sistema.includes(t);
  const nuevas: (Seccion | null)[] = [
    quiere("sellos-confianza") ? seccionSellos(c.entrada) : null,
    quiere("dato-en-vivo") ? seccionDatoEnVivo(c.entrada) : null,
    quiere("dato-curioso") ? seccionDatoCurioso(c.dato) : null,
    quiere("ficha-tecnica") ? seccionFicha(c.entrada, c.investigacion) : null,
    c.hayCreditos && quiere("creditos") ? seccionCreditos() : null,
    quiere("cta-fija") ? seccionCtaFija(c.entrada) : null,
  ];
  const todas = [...propias, ...(nuevas.filter(Boolean) as Seccion[])];
  const indice = (t: string) => {
    const orden: readonly string[] = c.orden ?? ORDEN_VITRINA;
    const i = orden.indexOf(t);
    return i === -1 ? orden.length : i;
  };
  const ordenadas = todas.map((s, pos) => ({ s, pos })).sort((a, b) => indice(a.s.tipo) - indice(b.s.tipo) || a.pos - b.pos).map((x) => x.s);
  return { ...doc, secciones: ordenadas };
}
