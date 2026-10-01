// Validador 4 de docs/05 §4 · Anti-split (render).
// Mide, en la vista previa a ≥ 1024 px, el `h1` y la imagen o video principal del primer viewport.
// Falla si están lado a lado (el héroe «título a la izquierda, imagen a la derecha» está fuera del catálogo).
// Va en dos capas: una función pura sobre rectángulos (se prueba sin navegador) y un medidor de DOM.

/** Desde este ancho de vista previa el validador aplica (docs/05 §4). */
export const ANCHO_MINIMO_ANTI_SPLIT = 1024;

/** Tipo del mensaje con el que el iframe de la vista previa avisa al editor o al asistente. */
export const MSG_ANTI_SPLIT = "anti-split-render";

/** Rectángulo mínimo: lo que devuelve `getBoundingClientRect`. */
export interface Rectangulo {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export type ResultadoAntiSplit =
  | { aplica: false; motivo: "ancho" | "sin-h1" | "sin-medio"; split: false }
  | {
      aplica: true;
      split: boolean;
      /** Parte del elemento más bajo que cae dentro del rango vertical del otro (0–1). */
      solapamientoVertical: number;
      /** Parte del elemento más angosto que cae dentro del rango horizontal del otro (0–1). */
      solapamientoHorizontal: number;
      explicacion: string;
    };

const centroX = (r: Rectangulo) => (r.left + r.right) / 2;

function solapamiento(a0: number, a1: number, b0: number, b1: number): number {
  const menor = Math.min(a1 - a0, b1 - b0);
  if (menor <= 0) return 0;
  return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0)) / menor;
}

export const solapamientoVertical = (a: Rectangulo, b: Rectangulo) => solapamiento(a.top, a.bottom, b.top, b.bottom);
export const solapamientoHorizontal = (a: Rectangulo, b: Rectangulo) => solapamiento(a.left, a.right, b.left, b.right);

export interface EntradaAntiSplit {
  /** Ancho de la ventana (del iframe) donde se midió. */
  anchoVentana: number;
  h1: Rectangulo | null;
  medio: Rectangulo | null;
}

/**
 * Falla si el `h1` y el medio principal están lado a lado: solapamiento vertical > 50 % y el centro del
 * `h1` a la izquierda del centro de la imagen. Un título encima de la imagen (héroe superpuesto) se
 * solapa también en horizontal y no cuenta como lado a lado.
 */
export function evaluarAntiSplit({ anchoVentana, h1, medio }: EntradaAntiSplit): ResultadoAntiSplit {
  if (anchoVentana < ANCHO_MINIMO_ANTI_SPLIT) return { aplica: false, motivo: "ancho", split: false };
  if (!h1) return { aplica: false, motivo: "sin-h1", split: false };
  if (!medio) return { aplica: false, motivo: "sin-medio", split: false };
  const vertical = solapamientoVertical(h1, medio);
  const horizontal = solapamientoHorizontal(h1, medio);
  const split = vertical > 0.5 && centroX(h1) < centroX(medio) && horizontal < 0.5;
  return {
    aplica: true,
    split,
    solapamientoVertical: vertical,
    solapamientoHorizontal: horizontal,
    explicacion: split
      ? "El título y la imagen del primer pantallazo están lado a lado, con el título a la izquierda."
      : "El título y la imagen del primer pantallazo están centrados, apilados o superpuestos.",
  };
}

// ── Medidor de DOM ─────────────────────────────────────────────────────────

/** Elementos que cuentan como «imagen o video principal». */
const SELECTOR_MEDIO = "img, video, canvas, picture, svg[role='img'], [data-marcador-slot], [data-media-principal]";
const AREA_MINIMA = 120 * 80;

// La opacidad no cuenta: los revelados de entrada empiezan en 0 hasta que la sección asoma, y el layout ya está fijo.
const visible = (el: Element, vista: Window): boolean => {
  const estilo = vista.getComputedStyle(el);
  return estilo.display !== "none" && estilo.visibility !== "hidden";
};

function rectangulo(el: Element): Rectangulo {
  const r = el.getBoundingClientRect();
  return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
}

/** `h1` y medio principal del primer viewport de un documento (el del iframe de la vista previa). */
export function medirPrimerViewport(documento: Document): Pick<EntradaAntiSplit, "h1" | "medio"> {
  const vista = documento.defaultView;
  if (!vista) return { h1: null, medio: null };
  const alto = vista.innerHeight;
  const enPrimerViewport = (r: Rectangulo) => r.bottom > 0 && r.top < alto && r.right > r.left && r.bottom > r.top;

  const h1 = [...documento.querySelectorAll("h1")]
    .filter((el) => visible(el, vista))
    .map(rectangulo)
    .find(enPrimerViewport);

  let medio: Rectangulo | null = null;
  let mayor = 0;
  for (const el of documento.querySelectorAll(SELECTOR_MEDIO)) {
    if (!visible(el, vista)) continue;
    const r = rectangulo(el);
    if (!enPrimerViewport(r)) continue;
    const area = (r.right - r.left) * (Math.min(r.bottom, alto) - Math.max(r.top, 0));
    if (area >= AREA_MINIMA && area > mayor) {
      mayor = area;
      medio = r;
    }
  }
  return { h1: h1 ?? null, medio };
}

/** Mide el documento y evalúa: lo que llama el hook dentro del iframe. */
export function validarAntiSplitRender(documento: Document): ResultadoAntiSplit {
  const anchoVentana = documento.defaultView?.innerWidth ?? 0;
  if (anchoVentana < ANCHO_MINIMO_ANTI_SPLIT) return { aplica: false, motivo: "ancho", split: false };
  return evaluarAntiSplit({ anchoVentana, ...medirPrimerViewport(documento) });
}
