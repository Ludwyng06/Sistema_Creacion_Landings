import type { Asset, LandingDoc, Seccion, Tokens, TipoSeccion } from "@/lib/contratos";
import { VARIANTES_HEROE } from "@/lib/contratos";
import { ejemplo as ejemploAntesDespues, assets as assetsAntesDespues } from "@/secciones/antes-despues/ejemplo";
import { ejemplos as ejemplosBeneficios } from "@/secciones/beneficios/ejemplo";
import { ejemplo as ejemploCifras } from "@/secciones/cifras/ejemplo";
import { ejemplo as ejemploCintaAnuncio } from "@/secciones/cinta-anuncio/ejemplo";
import { ejemplos as ejemplosComoFunciona } from "@/secciones/como-funciona/ejemplo";
import { ejemplos as ejemplosComparativa } from "@/secciones/comparativa/ejemplo";
import { ejemplo as ejemploCuentaRegresiva } from "@/secciones/cuenta-regresiva/ejemplo";
import { ejemplo as ejemploFaq } from "@/secciones/faq/ejemplo";
import { ejemplo as ejemploFormulario } from "@/secciones/formulario-lead/ejemplo";
import { ejemplos as ejemplosGaleria, assets as assetsGaleria } from "@/secciones/galeria/ejemplo";
import { ejemplo as ejemploGarantia } from "@/secciones/garantia/ejemplo";
import { ejemplos as ejemplosHeroe, assets as assetsHeroe } from "@/secciones/heroe/ejemplo";
import { ejemplo as ejemploHtmlLibre } from "@/secciones/html-libre/ejemplo";
import { ejemplo as ejemploIncluye, assets as assetsIncluye } from "@/secciones/incluye/ejemplo";
import { ejemplo as ejemploOferta } from "@/secciones/oferta/ejemplo";
import { ejemplo as ejemploProblema, assets as assetsProblema } from "@/secciones/problema-solucion/ejemplo";
import { ejemplos as ejemplosTestimonios } from "@/secciones/testimonios/ejemplo";
import { ejemplo as ejemploVideo, assets as assetsVideo } from "@/secciones/video/ejemplo";

// Documentos de revisión: solo sirven para ver las secciones con paletas distintas.
// No pasan por `LandingDoc.parse` (no siempre tienen 5 a 10 secciones).

export const TOKENS_BAUHAUS: Tokens = {
  colores: {
    fondo: "#F4EFE6",
    superficie: "#FFFFFF",
    texto: "#1B1B1B",
    textoSuave: "#5A5A5A",
    acento: "#D9381E",
    acentoTexto: "#FFFFFF",
    borde: "#D8D0C0",
  },
  tipografia: { titulos: "Space Grotesk", cuerpo: "IBM Plex Sans", escala: "normal" },
  radio: 4,
  espaciado: "normal",
  borde: "fino",
  imagen: "natural",
  intensidad: 2,
};

export const TOKENS_NOCTURNO: Tokens = {
  colores: {
    fondo: "#14130F",
    superficie: "#1F1D18",
    texto: "#F1EDE3",
    textoSuave: "#B5AFA0",
    acento: "#E6B94A",
    acentoTexto: "#14130F",
    borde: "#38352C",
  },
  tipografia: { titulos: "Fraunces", cuerpo: "Instrument Sans", escala: "normal" },
  radio: 0,
  espaciado: "aireado",
  borde: "fino",
  imagen: "duotono",
  intensidad: 2,
};

export const TOKENS_BOSQUE: Tokens = {
  colores: {
    fondo: "#E9EFE8",
    superficie: "#FFFFFF",
    texto: "#12261C",
    textoSuave: "#4A5F53",
    acento: "#1F6B4A",
    acentoTexto: "#FFFFFF",
    borde: "#C4D2C7",
  },
  tipografia: { titulos: "Space Grotesk", cuerpo: "IBM Plex Sans", escala: "amplia" },
  radio: 16,
  espaciado: "denso",
  borde: "grueso",
  imagen: "natural",
  intensidad: 1,
};

export function armarDoc(
  slug: string,
  nombre: string,
  tokens: Tokens,
  secciones: Seccion[],
  assets: Asset[],
): LandingDoc {
  return {
    version: 1,
    meta: {
      nombre,
      slug,
      producto: "Corrector de postura inteligente",
      tecnicas: ["semilla", "sustractivo", "humana"],
      semilla: {
        estilo: nombre,
        industria: "salud y bienestar",
        paletaId: slug,
        tipografiaId: `${slug}-tipografia`,
        numero: 1,
      },
      nivelConciencia: "problema",
      marco: "PAS",
      eliminadas: [],
    },
    tokens,
    secciones,
    assets,
  };
}

/** Todos los slots que usan los ejemplos, con su prompt para Grok. */
export const ASSETS_EJEMPLO: Asset[] = [
  ...assetsHeroe,
  ...assetsProblema,
  ...assetsAntesDespues,
  ...assetsGaleria,
  ...assetsVideo,
  ...assetsIncluye,
];

export type DocumentoRevision = {
  grupo: "heroe" | "secciones";
  titulo: string;
  nota: string;
  doc: LandingDoc;
};

const NOTAS_HEROE: Record<(typeof VARIANTES_HEROE)[number], string> = {
  "producto-monumental": "Producto centrado (~60 % del viewport), titular encima, subtítulo y botón debajo.",
  "poster-a-sangre": "Imagen a sangre; titular y botón superpuestos en el tercio inferior sobre un velo del color de fondo.",
  "titular-tipografico": "Titular gigante a todo el ancho con el producto justo debajo, sin tapar ninguna línea.",
  "problema-primero": "Solo texto: la pregunta de dolor centrada y un indicador de scroll.",
  "antes-despues-heroe": "Titular centrado arriba y comparador antes/después a todo el ancho debajo.",
  "video-inmersivo": "Clip en loop a sangre con velo, titular centrado y botón; póster de respaldo.",
  "orbita-beneficios": "Producto al centro y beneficios alrededor en escritorio; en móvil, producto y lista debajo.",
  "mosaico-editorial": "Collage asimétrico de 3 a 5 imágenes con la franja del titular cruzándolo.",
};

const PALETAS = [TOKENS_BAUHAUS, TOKENS_NOCTURNO, TOKENS_BOSQUE];

const DOCUMENTOS_HEROE: DocumentoRevision[] = VARIANTES_HEROE.map((variante, i) => ({
  grupo: "heroe",
  titulo: `Héroe · ${variante}`,
  nota: NOTAS_HEROE[variante],
  doc: armarDoc(`revision-${variante}`, `Revisión ${variante}`, PALETAS[i % PALETAS.length], [ejemplosHeroe[variante]], ASSETS_EJEMPLO),
}));

const DOCUMENTOS_SECCIONES: DocumentoRevision[] = [
  {
    grupo: "secciones",
    titulo: "Secciones · primera mitad",
    nota: "Cinta, problema y solución, beneficios, cómo funciona, antes y después, comparativa y galería.",
    doc: armarDoc(
      "revision-secciones-1",
      "Bauhaus funcional",
      TOKENS_BAUHAUS,
      [
        ejemploCintaAnuncio,
        ejemploProblema,
        ejemplosBeneficios["lista-grande"],
        ejemplosComoFunciona["pasos-verticales"],
        ejemploAntesDespues,
        ejemplosComparativa.resaltado,
        ejemplosGaleria.mosaico,
      ],
      ASSETS_EJEMPLO,
    ),
  },
  {
    grupo: "secciones",
    titulo: "Secciones · segunda mitad",
    nota: "Video, testimonios, cifras, oferta, qué incluye, cuenta regresiva, garantía, preguntas, formulario y HTML libre.",
    doc: armarDoc(
      "revision-secciones-2",
      "Suizo verde",
      TOKENS_BOSQUE,
      [
        ejemploVideo,
        ejemplosTestimonios.muro,
        ejemploCifras,
        ejemploOferta,
        ejemploIncluye,
        ejemploCuentaRegresiva,
        ejemploGarantia,
        ejemploFaq,
        ejemploFormulario,
        ejemploHtmlLibre,
      ],
      ASSETS_EJEMPLO,
    ),
  },
  {
    grupo: "secciones",
    titulo: "Disposiciones alternativas",
    nota: "Las demás disposiciones de beneficios, cómo funciona, galería, testimonios y comparativa.",
    doc: armarDoc(
      "revision-alternativas",
      "Editorial nocturno",
      TOKENS_NOCTURNO,
      [
        ejemplosBeneficios["tarjetas-apiladas"],
        ejemplosBeneficios.numerada,
        ejemplosBeneficios.carrusel,
        ejemplosComoFunciona["linea-tiempo"],
        ejemplosGaleria.carrusel,
        ejemplosGaleria.historias,
        ejemplosTestimonios.carrusel,
        ejemplosTestimonios.destacado,
        ejemplosComparativa.minimal,
      ],
      ASSETS_EJEMPLO,
    ),
  },
];

export const DOCUMENTOS_REVISION: DocumentoRevision[] = [...DOCUMENTOS_HEROE, ...DOCUMENTOS_SECCIONES];

/** Ancla (`<slug>--<id>`) del primer ejemplo de cada tipo, para el índice de la página de revisión. */
export function primerEjemploPorTipo(): Partial<Record<TipoSeccion, string>> {
  const mapa: Partial<Record<TipoSeccion, string>> = {};
  for (const { doc } of DOCUMENTOS_SECCIONES) {
    for (const seccion of doc.secciones) mapa[seccion.tipo] ??= `${doc.meta.slug}--${seccion.id}`;
  }
  return mapa;
}
