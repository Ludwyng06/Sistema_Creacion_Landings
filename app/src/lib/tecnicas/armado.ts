import {
  CATALOGO_EFECTOS,
  EFECTOS_ID,
  MAX_EFECTOS_NIVEL_3,
  TIPOS_SECCION_BASE,
  VARIANTES_HEROE,
  type Brief,
  type BloquePrompt,
  type ModuloTecnica,
  type PromptEstructurado,
  type Semilla,
  type TecnicaId,
  type Tokens,
  type TipoSeccion,
  type VarianteHeroe,
} from "@/lib/contratos";
import { guiaAjustesPorSeccion } from "./guia-secciones";
import { tokensParaBrief } from "./semillas";

// Armado común de los 4 bloques (docs/04 §0 y §9). Lo usan los módulos y el combinador.

type Aporte = PromptEstructurado["aportes"][number];

/** Perfil profesional de cada técnica, para componer un rol híbrido en una sola frase. */
export const PERFILES: Record<TecnicaId, string> = {
  ambicioso: "estratega de conversión especializado en productos físicos",
  semilla: "director de arte que aplica la semilla «{estilo} × {industria}» como sistema visual",
  sustractivo: "editor de diseño sustractivo que justifica cada elemento",
  imagenes: "director de fotografía de producto que escribe prompts para Grok Imagine",
  video: "director de movimiento web que elige efectos de un catálogo cerrado",
  negativas: "editor de estilo que mantiene el texto libre de tics de IA",
  humana: "redactor de respuesta directa con voz humana en español neutro",
  critico: "auditor senior de UX y CRO",
};

const USO_SECCION: Record<TipoSeccion, string> = {
  heroe: "primera sección; dice qué es, para quién y el beneficio principal (exige `variante`)",
  "cinta-anuncio": "franja breve con la oferta o el beneficio del momento",
  "problema-solucion": "narra la frustración concreta y el alivio antes de hablar de características",
  beneficios: "traduce cada función en un beneficio concreto (3 a 6 bloques `beneficio`)",
  "como-funciona": "explica el uso en 3 o 4 pasos",
  "antes-despues": "muestra el resultado visible con dos imágenes",
  comparativa: "compara el producto con las alternativas en 4 a 7 filas",
  galeria: "imágenes del producto en uso",
  video: "clip corto del producto en uso",
  testimonios: "opiniones reales del brief; si faltan, `[COMPLETAR]`",
  cifras: "2 a 4 cifras reales del brief",
  oferta: "precio, precio anterior real y opciones de cantidad",
  incluye: "lista de lo que trae la caja o el regalo",
  "cuenta-regresiva": "solo con una fecha de oferta real del brief",
  faq: "responde las objeciones antes de que el lector las piense (3 a 8 preguntas)",
  garantia: "promesas de confianza con los días y condiciones del brief",
  "formulario-lead": "acción final; aparece exactamente una vez, cerca del final",
  "html-libre": "solo lo agrega una persona en el editor; la IA no lo usa",
  "dato-en-vivo": "widget con un dato real y actualizado (auroras, fase lunar, ISS, lanzamiento o asteroides); solo en landings de temática espacial",
  "dato-curioso": "una frase «¿Sabías que…?» real con su fuente; solo en landings de temática espacial",
  "ficha-tecnica": "tabla de especificaciones y medidas reales del brief",
  "sellos-confianza": "sellos cortos de confianza reales (pago contraentrega, envío, garantía); sin logos ni cifras inventadas",
  creditos: "créditos de las imágenes usadas; se genera solo desde los medios, la IA no lo redacta",
  "para-quien": "filtro de pertenencia «esto es para ti si…» con una imagen; 3 a 8 bloques `punto`",
  "mecanismo": "«pensabas que X, pero Y»: el mecanismo único con una imagen y hasta 4 anotaciones",
  "historia": "el punto de inflexión: lo que ya probó y por qué falló, sin culpa, con imagen de ambiente",
  "resumen": "recapitula lo que recibe la persona antes del formulario (4 a 8 ítems)",
  "escena-uso": "el producto en la vida real con 1 a 3 fotos de ambiente",
  "agenda": "qué pasa y cuándo (2 a 8 momentos); horas y días solo del brief",
  "ponentes": "quién lleva el evento o el curso (1 a 6 personas) con su foto real",
  "linea-tiempo": "historia en orden para divulgación (3 a 8 hitos con fecha de una fuente)",
  "impacto": "cifras reales de una causa (2 a 4 datos) con foto",
  "cta-fija": "barra fija con el llamado a la acción y el precio del vendedor",
};

const USO_HEROE: Record<VarianteHeroe, string> = {
  "producto-monumental": "producto grande y centrado con el titular encima y el CTA debajo; útil para comprador consciente del producto",
  "poster-a-sangre": "imagen a sangre con el titular y el CTA superpuestos en el tercio inferior; útil para estilo editorial",
  "titular-tipografico": "titular gigante centrado arriba con el producto debajo, sin solaparse; útil para brutalismo y semillas suizas",
  "problema-primero": "solo texto con una pregunta de dolor centrada; útil para nivel inconsciente o de problema (PAS)",
  "antes-despues-heroe": "titular centrado y slider comparativo a todo el ancho; útil para productos de resultado visible",
  "video-inmersivo": "clip en loop a sangre con titular centrado y CTA; útil para productos en uso y movimiento",
  "orbita-beneficios": "producto al centro y 3 o 4 beneficios alrededor; útil para productos con varias funciones",
  "mosaico-editorial": "collage asimétrico con el titular en una franja que lo cruza; útil para moda y estilo de vida",
};

/** Ejemplos few-shot A a D de docs/03, en su versión afirmativa. */
export const EJEMPLOS_FEW_SHOT = [
  "Ejemplo A · Copy: «Pasas 8 horas frente al computador y la espalda te lo cobra a las 4 p. m. Este corrector te recuerda enderezarte sin que tengas que pensarlo.»",
  "Ejemplo B · Botón: «Quiero que me contacten hoy».",
  'Ejemplo C · Sección del LandingDoc: {"id":"s1","tipo":"heroe","variante":"problema-primero","visible":true,"intencion":{"objetivo":"Que el lector se reconozca en el dolor en menos de 3 s","emocion":"alivio anticipado"},"ajustes":{"titular":"¿A las 4 p. m. ya te duele la espalda?","subtitular":"Hay una forma de enderezarte sin pensarlo.","textoBoton":"Ver cómo funciona"},"bloques":[],"efectos":["titular-cinetico"]}',
  "Ejemplo D · Héroe: producto centrado ocupando el 60 % del alto, titular centrado encima y CTA debajo; o imagen a sangre con el titular superpuesto en el tercio inferior.",
];

export const TEXTO_RAZONAMIENTO =
  "Antes de responder, razona paso a paso qué necesita el comprador en cada sección; entrega solo el resultado final en el formato pedido.";

export const TEXTO_CONTROL_CALIDAD =
  'Usa exclusivamente los datos del brief para cifras, precios, garantías y testimonios. Cuando un dato falte, marca el campo con `"[COMPLETAR]"`.';

const CONTRATO_LANDINGDOC = [
  "Entrega un único objeto JSON `LandingDoc`, sin texto antes ni después, con estos campos:",
  "- `version`: 1.",
  "- `meta`: { nombre, slug en kebab-case, producto, tecnicas[], semilla { estilo, industria, paletaId, tipografiaId, numero }, nivelConciencia, marco ('AIDA' o 'PAS'), eliminadas[] }.",
  "- `tokens`: { colores { fondo, superficie, texto, textoSuave, acento, acentoTexto, borde }, tipografia { titulos, cuerpo, escala }, radio, espaciado, borde, imagen, intensidad }.",
  "- `secciones[]` (de 5 a 16): { id, tipo, variante?, visible, intencion { objetivo, emocion?, objecionQueResponde? }, ajustes, bloques[ { id, tipo, ajustes } ], animacion?, efectos?[] }.",
  "- `assets[]`: { slot, tipo ('imagen' o 'video'), relacion, promptGrok, alt }.",
].join("\n");

const REGLAS_ESTRUCTURA = [
  "Reglas de estructura:",
  "- El héroe es la primera sección y usa una de las variantes aprobadas.",
  "- El formulario `formulario-lead` aparece exactamente una vez, cerca del final.",
  "- `cuenta-regresiva` solo con una fecha de oferta real del brief; `testimonios` y `cifras` solo con datos del brief.",
  "- Todos los colores y tipografías salen de `tokens`.",
].join("\n");

export function listaY(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

export function rellenar(texto: string, semilla?: Semilla): string {
  if (!semilla) {
    return texto
      .replaceAll("«{estilo} × {industria}»", "elegida para este producto")
      .replaceAll("{paletaId}", "la paleta entregada")
      .replaceAll("{tipografiaId}", "la pareja tipográfica entregada")
      .replaceAll("{numero}", "0")
      .replaceAll("{estilo}", "elegido")
      .replaceAll("{industria}", "elegida");
  }
  return texto
    .replaceAll("{estilo}", semilla.estilo)
    .replaceAll("{industria}", semilla.industria)
    .replaceAll("{paletaId}", semilla.paletaId)
    .replaceAll("{tipografiaId}", semilla.tipografiaId)
    .replaceAll("{numero}", String(semilla.numero));
}

function catalogoEfectos(intensidad: Brief["intensidad"]): string {
  const lineas = EFECTOS_ID.filter((id) => CATALOGO_EFECTOS[id].nivel <= intensidad).map((id) => {
    const d = CATALOGO_EFECTOS[id];
    const variantes = d.variantesHeroe ? ` (héroe: ${d.variantesHeroe.join(" o ")})` : "";
    return `- \`${id}\` · nivel ${d.nivel} · ${d.secciones.join(", ")}${variantes}`;
  });
  return [
    `Catálogo de efectos permitido para la intensidad ${intensidad} (elige solo de esta lista; máximo ${MAX_EFECTOS_NIVEL_3} de nivel 3 en toda la landing):`,
    ...lineas,
  ].join("\n");
}

export function bloqueBrief(brief: Brief): string {
  return `Brief del producto (única fuente de datos):\n${JSON.stringify(brief, null, 2)}`;
}

export function bloqueTokens(tokens: Tokens): string {
  return `Tokens de la semilla (fuente única de verdad visual):\n${JSON.stringify(tokens, null, 2)}`;
}

/** Numera 1..N en líneas de una sola oración. */
export function numerar(pasos: string[]): string {
  return pasos.map((p, i) => `${i + 1}. ${p}`).join("\n");
}

function sinDuplicados(lista: string[]): string[] {
  return [...new Set(lista)];
}

const PASO_INICIAL = "Genera el documento `LandingDoc` de una landing para el producto físico del brief.";

const PASO_PRIORIDAD =
  "Cuando dos indicaciones se crucen, aplica este orden: en colores y tipografías mandan los tokens de la semilla, salvo los colores de marca del brief; en cantidad de secciones y de campos manda el diseño sustractivo sobre el prompt ambicioso; en los textos mandan las reglas de restricciones negativas y de redacción humana. Entrega un único JSON.";

interface Opciones {
  brief: Brief;
  /** Módulos ya ordenados por prioridad. */
  modulos: ModuloTecnica[];
  semilla?: Semilla;
  /** `individual`: el rol es el del propio módulo. `combinado`: rol híbrido. */
  modo: "individual" | "combinado";
}

/** Arma los 4 bloques y registra cada fragmento en `aportes`. Sin llamadas a IA. */
export function armarPrompt({ brief, modulos, semilla, modo }: Opciones): PromptEstructurado {
  const aportes: Aporte[] = [];
  const sumar = (tecnica: TecnicaId, bloque: BloquePrompt, texto: string) => {
    aportes.push({ tecnica, bloque, texto });
    return texto;
  };
  const tokens = semilla ? tokensParaBrief(semilla, brief) : undefined;
  const ids = modulos.map((m) => m.id);

  // Aportes por técnica, en el orden de prioridad recibido.
  const rolPorModulo: string[] = [];
  const tareaPorModulo: string[] = [];
  const contextoPorModulo: string[] = [];
  const formatoPorModulo: string[] = [];
  for (const m of modulos) {
    if (modo === "individual") {
      if (m.aporta.rol) rolPorModulo.push(sumar(m.id, "rol", rellenar(m.aporta.rol, semilla)));
    } else {
      rolPorModulo.push(sumar(m.id, "rol", rellenar(PERFILES[m.id], semilla)));
    }
    for (const t of m.aporta.tarea ?? []) tareaPorModulo.push(sumar(m.id, "tarea", rellenar(t, semilla)));
    if (m.id === "semilla" && tokens) contextoPorModulo.push(sumar(m.id, "contexto", bloqueTokens(tokens)));
    for (const c of m.aporta.contexto ?? []) contextoPorModulo.push(sumar(m.id, "contexto", rellenar(c, semilla)));
    for (const f of m.aporta.formato ?? []) formatoPorModulo.push(sumar(m.id, "formato", rellenar(f, semilla)));
  }

  // Rol
  let rol: string;
  if (modo === "individual") {
    rol = rolPorModulo.join(" ");
  } else {
    const conAuditor = ids.includes("critico");
    const perfiles = rolPorModulo.filter((_, i) => modulos[i].id !== "critico");
    const base = perfiles.length > 0 ? `Eres ${listaY(perfiles)}` : "Eres un especialista en landings de productos físicos";
    rol = conAuditor
      ? `${base}, y trabajas con un ${rolPorModulo[ids.indexOf("critico")]} que revisará tu entrega con evidencia.`
      : `${base}.`;
  }

  // Tarea
  const tarea = numerar([PASO_INICIAL, ...tareaPorModulo, PASO_PRIORIDAD]);

  // Contexto
  const comunes = [
    bloqueBrief(brief),
    ...(tokens && !ids.includes("semilla") ? [bloqueTokens(tokens)] : []),
  ];
  const contexto = sinDuplicados([
    ...comunes,
    ...contextoPorModulo,
    `Tipos de sección disponibles:\n${TIPOS_SECCION_BASE.map((t) => `- \`${t}\`: ${USO_SECCION[t]}`).join("\n")}`,
    `Variantes de héroe aprobadas (todas con el contenido centrado, superpuesto o apilado):\n${VARIANTES_HEROE.map((v) => `- \`${v}\`: ${USO_HEROE[v]}`).join("\n")}`,
    `Ajustes y bloques válidos por tipo de sección (usa solo estos campos y valores; todo campo sin ? es obligatorio, no omitas ninguno; los textos respetan el máximo indicado; el signo ? marca un campo opcional):\n${guiaAjustesPorSeccion(TIPOS_SECCION_BASE)}`,
    REGLAS_ESTRUCTURA,
    catalogoEfectos(brief.intensidad),
    `Ejemplos few-shot:\n${EJEMPLOS_FEW_SHOT.join("\n")}`,
  ]).join("\n\n");

  // Formato
  const formato = sinDuplicados([
    CONTRATO_LANDINGDOC,
    tokens
      ? "Copia `tokens` y `meta.semilla` tal cual llegan en el contexto."
      : "Propón `tokens` coherentes con la categoría y la intensidad del brief.",
    ...formatoPorModulo,
    TEXTO_RAZONAMIENTO,
    TEXTO_CONTROL_CALIDAD,
  ]).join("\n\n");

  return { rol, tarea, contexto, formato, aportes };
}
