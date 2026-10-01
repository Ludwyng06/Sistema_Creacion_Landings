import type { Asset, EfectoId, LandingDoc, Seccion, Tokens } from "@/lib/contratos";
import { ejemplo as ejemploAntesDespues } from "@/secciones/antes-despues/ejemplo";
import { ejemplos as ejemplosComoFunciona } from "@/secciones/como-funciona/ejemplo";
import { ejemplo as ejemploFaq } from "@/secciones/faq/ejemplo";
import { ejemplos as ejemplosGaleria } from "@/secciones/galeria/ejemplo";
import { ejemplos as ejemplosHeroe } from "@/secciones/heroe/ejemplo";
import { ASSETS_EJEMPLO, TOKENS_BAUHAUS, armarDoc } from "../secciones/documentos";
import type { Demo } from "./demos";

// Un demo por efecto de nivel 3 (docs/08 §3). Usan recursos sintéticos de `public/dev/efectos/` (formas y degradados,
// nada de stock) para poder ver el efecto sin esperar a los archivos de Grok.

const CARPETA = "/dev/efectos";
const RUTAS: Record<string, string> = {
  "heroe-producto": "producto.webp",
  "heroe-poster": "hero.webp",
  "galeria-1": "galeria-1.webp",
  "galeria-2": "galeria-2.webp",
  "galeria-3": "galeria-3.webp",
  "galeria-4": "galeria-4.webp",
  "postura-antes": "antes.webp",
  "postura-despues": "despues.webp",
  "heroe-video": "clip.mp4",
};

export const ASSETS_NIVEL_3: Asset[] = ASSETS_EJEMPLO.map((a) => (RUTAS[a.slot] ? { ...a, ruta: `${CARPETA}/${RUTAS[a.slot]}` } : a));

const TOKENS: Tokens = { ...TOKENS_BAUHAUS, intensidad: 3 };

const con = (seccion: Seccion, ...efectos: EfectoId[]): Seccion => ({ ...seccion, efectos });
const doc = (slug: string, secciones: Seccion[]): LandingDoc => armarDoc(`efecto-${slug}`, `Demo ${slug}`, TOKENS, secciones, ASSETS_NIVEL_3);

export const DEMOS_NIVEL_3: Demo[] = [
  {
    efecto: "video-scroll",
    titulo: "video-scroll",
    nivel: 3,
    que: "El héroe queda fijo y el scroll recorre el clip hacia delante y hacia atrás (fotogramas en canvas, o <video> con currentTime).",
    reducido: "El héroe muestra el clip tal cual, sin fijarse ni ligarse al scroll.",
    nota: "El clip es una prueba sintética (un patrón de colores con un contador), no material de Grok.",
    doc: doc("video-scroll", [con(ejemplosHeroe["video-inmersivo"], "video-scroll"), ejemploFaq]),
  },
  {
    efecto: "producto-explotado",
    titulo: "producto-explotado",
    nivel: 3,
    que: "Las capas del producto se separan en Z con el scroll y se vuelven a armar. Con una sola imagen, se despega hacia la cámara.",
    reducido: "Las imágenes se ven armadas y quietas.",
    doc: doc("producto-explotado", [con(ejemplosHeroe["producto-monumental"], "producto-explotado"), ejemploFaq]),
  },
  {
    efecto: "pin-coreografia",
    titulo: "pin-coreografia",
    nivel: 3,
    que: "La sección se fija y sus bloques entran uno tras otro.",
    reducido: "Todos los bloques se ven a la vez, sin fijar la sección.",
    doc: doc("pin-coreografia", [con(ejemplosComoFunciona["pasos-verticales"], "pin-coreografia"), ejemploFaq]),
  },
  {
    efecto: "horizontal",
    titulo: "horizontal",
    nivel: 3,
    que: "La galería se fija y corre de lado con el scroll vertical.",
    reducido: "La galería es una pista con desplazamiento táctil normal (scroll-snap), sin fijarse.",
    doc: doc("horizontal", [con(ejemplosGaleria.carrusel, "horizontal"), ejemploFaq]),
  },
  {
    efecto: "shader-ondas",
    titulo: "shader-ondas",
    nivel: 3,
    que: "Las imágenes de la galería se distorsionan con ondas suaves (WebGL con OGL) que siguen al puntero y al scroll.",
    reducido: "Las imágenes se ven sin distorsión, como imágenes normales.",
    doc: doc("shader-ondas", [con(ejemplosGaleria.mosaico, "shader-ondas"), ejemploFaq]),
  },
  {
    efecto: "antes-despues-scroll",
    titulo: "antes-despues-scroll",
    nivel: 3,
    que: "La sección se fija y el scroll mueve el divisor del antes y el después.",
    reducido: "El comparador queda en el centro y se mueve solo con puntero o teclado.",
    doc: doc("antes-despues-scroll", [con(ejemploAntesDespues, "antes-despues-scroll"), ejemploFaq]),
  },
];
