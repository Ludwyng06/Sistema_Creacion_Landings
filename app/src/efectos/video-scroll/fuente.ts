// Lógica pura del efecto `video-scroll` (docs/08 §3): de dónde sale la imagen y qué fotograma toca pintar.
// Va aparte del componente para poder probarla sin navegador.

export interface ManifiestoFotogramas {
  n: number;
  ancho: number;
  alto: number;
  fps: number;
  /** Formato de los archivos (`webp` por defecto, `avif` en la portada de alta calidad). */
  formato?: "webp" | "avif";
}

/** Rutas públicas de un clip. Los fotogramas los genera `npm run fotogramas -- <mp4>`. */
export interface RutasVideo {
  /** Carpeta con `0001.webp…` y `manifest.json`, sin barra final. */
  fotogramas: string;
  video: string;
  poster: string;
  /** Enfoque propio del juego (el de móvil ya viene recortado y centrado en los teléfonos). Sin él manda el que pida el componente. */
  enfoque?: Enfoque;
}

/** Lo que se encontró en disco al probar las rutas. */
export interface Disponibilidad {
  manifiesto: ManifiestoFotogramas | null;
  video: boolean;
  poster: boolean;
}

export type FuenteVideo =
  | { tipo: "fotogramas"; carpeta: string; manifiesto: ManifiestoFotogramas; poster: string | null }
  | { tipo: "video"; src: string; poster: string | null }
  | { tipo: "poster"; src: string }
  | { tipo: "marcador" };

export interface EntradaFuente {
  /** Pantalla estrecha: usa el clip vertical. */
  movil: boolean;
  /** `prefers-reduced-motion`: sin navegación por scroll, solo el póster fijo. */
  reducido: boolean;
  rutas: RutasVideo;
  disponible: Disponibilidad;
}

/**
 * Si el clip vertical (`home-loop-9x16`) está listo para usarse en móvil. Está en `false` mientras el que
 * hay en disco sea el equivocado: en móvil se usa el 16:9 (`home-loop`) con `object-fit: cover` centrado.
 */
export const USAR_VERTICAL = false;

/** Los clips finales de Grok que acepta el home (docs/06 §1). */
export function rutasDelHome(movil: boolean, usarVertical: boolean = USAR_VERTICAL): RutasVideo {
  if (movil && usarVertical) return { fotogramas: "/media/home/home-loop-9x16-frames", video: "/media/home/home-loop-9x16.mp4", poster: "/media/home/home-poster.webp" };
  // Móvil: juego propio de 720×720 recortado en los teléfonos de la banda (más nítido que escalar el de escritorio).
  if (movil) return { fotogramas: "/media/home/home-loop-frames-movil", video: "/media/home/home-loop.mp4", poster: "/media/home/home-poster-movil.webp", enfoque: ENFOQUE_CENTRADO };
  return { fotogramas: "/media/home/home-loop-frames", video: "/media/home/home-loop.mp4", poster: "/media/home/home-poster.webp" };
}

/** El clip vertical del cierre del home (720×1280): el mismo juego en móvil y en escritorio. */
export function rutasDelCierre(): RutasVideo {
  return { fotogramas: "/media/home/home-cierre-frames", video: "/media/home/home-cierre.mp4", poster: "/media/home/home-cierre-poster.webp", enfoque: ENFOQUE_CENTRADO };
}

/**
 * Orden de preferencia: fotogramas → video con `currentTime` → póster → marcador.
 * Con `reduced-motion` nunca se navega: póster fijo (o marcador si tampoco hay póster).
 */
export function elegirFuente({ movil, reducido, rutas, disponible }: EntradaFuente): FuenteVideo {
  void movil; // la elección de rutas por pantalla ya vino resuelta en `rutas`
  const poster = disponible.poster ? rutas.poster : null;
  if (reducido) return poster ? { tipo: "poster", src: poster } : { tipo: "marcador" };
  if (disponible.manifiesto && disponible.manifiesto.n > 0) {
    return { tipo: "fotogramas", carpeta: rutas.fotogramas, manifiesto: disponible.manifiesto, poster };
  }
  if (disponible.video) return { tipo: "video", src: rutas.video, poster };
  if (poster) return { tipo: "poster", src: poster };
  return { tipo: "marcador" };
}

type Buscador = (url: string, init?: RequestInit) => Promise<Response>;

/** Comprueba qué recursos existen. Nunca lanza: lo que falla cuenta como «no está». */
export async function probarRecursos(rutas: RutasVideo, buscar: Buscador = (u, i) => fetch(u, i)): Promise<Disponibilidad> {
  const existe = async (url: string): Promise<boolean> => {
    try {
      return (await buscar(url, { method: "HEAD" })).ok;
    } catch {
      return false;
    }
  };
  const leerManifiesto = async (): Promise<ManifiestoFotogramas | null> => {
    try {
      const r = await buscar(`${rutas.fotogramas}/manifest.json`);
      if (!r.ok) return null;
      const m = (await r.json()) as Partial<ManifiestoFotogramas>;
      return Number.isInteger(m.n) && (m.n ?? 0) > 0 && Number(m.ancho) > 0 && Number(m.alto) > 0
        ? { n: m.n as number, ancho: Number(m.ancho), alto: Number(m.alto), fps: Number(m.fps) || 24, ...(m.formato === "avif" || m.formato === "webp" ? { formato: m.formato } : {}) }
        : null;
    } catch {
      return null;
    }
  };
  const [manifiesto, video, poster] = await Promise.all([leerManifiesto(), existe(rutas.video), rutas.poster ? existe(rutas.poster) : false]);
  return { manifiesto, video, poster };
}

// ── Fotogramas ─────────────────────────────────────────────────────────────

export const limitar = (v: number, min = 0, max = 1): number => Math.min(max, Math.max(min, v));

/** Índice (base 0) del fotograma que corresponde a un progreso de 0 a 1. */
export function indiceDeFotograma(progreso: number, n: number): number {
  if (n <= 1) return 0;
  return Math.min(n - 1, Math.round(limitar(progreso) * (n - 1)));
}

/** Nombre de archivo de un fotograma (base 0): `0001.webp` o `0001.avif`. */
export const nombreFotograma = (indice: number, formato: "webp" | "avif" = "webp"): string => `${String(indice + 1).padStart(4, "0")}.${formato}`;

/**
 * Primera pasada de la precarga progresiva: 1 de cada 8 (cobertura pareja para que el scroll funcione enseguida) más el
 * último cuadro. El resto se pide después según hacia dónde se desplace la persona (`siguienteAPedir`).
 */
export function ordenDeCarga(n: number, salto = 8): number[] {
  const gruesos: number[] = [];
  const finos: number[] = [];
  for (let i = 0; i < n; i++) (i % salto === 0 ? gruesos : finos).push(i);
  if (n > 0 && !gruesos.includes(n - 1)) {
    gruesos.push(n - 1); // el último cuadro también entra en la primera pasada
    finos.splice(finos.indexOf(n - 1), 1);
  }
  return [...gruesos, ...finos];
}

/** El fotograma cargado más cercano a `indice`, o -1 si aún no hay ninguno. */
export function masCercano(cargados: ReadonlyArray<unknown | null | undefined>, indice: number): number {
  if (cargados[indice]) return indice;
  for (let d = 1; d < cargados.length; d++) {
    if (indice - d >= 0 && cargados[indice - d]) return indice - d;
    if (indice + d < cargados.length && cargados[indice + d]) return indice + d;
  }
  return -1;
}

/** Punto de la imagen que se mantiene a la vista al recortar (0 a 1 en cada eje; 0,5 = centrado). Equivale a `object-position`. */
export interface Enfoque {
  x: number;
  y: number;
}

export const ENFOQUE_CENTRADO: Enfoque = { x: 0.5, y: 0.5 };

/** Valor CSS de `object-position` para un enfoque. */
export const objectPosition = (e: Enfoque): string => `${Math.round(e.x * 100)}% ${Math.round(e.y * 100)}%`;

/** Recorte tipo `object-fit: cover` de una imagen en un lienzo, con el enfoque elegido (por defecto centrado). */
export function ajusteCover(anchoImg: number, altoImg: number, anchoLienzo: number, altoLienzo: number, enfoque: Enfoque = ENFOQUE_CENTRADO) {
  const escala = Math.max(anchoLienzo / anchoImg, altoLienzo / altoImg);
  const ancho = anchoImg * escala;
  const alto = altoImg * escala;
  return { x: (anchoLienzo - ancho) * enfoque.x, y: (altoLienzo - alto) * enfoque.y, ancho, alto };
}

/** Acerca `actual` a `objetivo` con suavizado exponencial; se detiene al llegar (sin saltos ni temblor). */
export function acercar(actual: number, objetivo: number, factor = 0.2, umbral = 0.0005): number {
  const d = objetivo - actual;
  return Math.abs(d) < umbral ? objetivo : actual + d * factor;
}

/**
 * Qué fotograma pedir ahora, después de la primera pasada: el que falta más cerca del cuadro actual, prefiriendo el
 * sentido en el que se mueve el scroll (`direccion` 1 = hacia delante, -1 = hacia atrás; 0 = sin preferencia).
 * `pedidos` son los ya cargados o en camino. Devuelve -1 si no falta ninguno.
 */
export function siguienteAPedir(pedidos: ReadonlySet<number>, n: number, actual: number, direccion: -1 | 0 | 1): number {
  let mejor = -1;
  let costeMejor = Infinity;
  for (let i = 0; i < n; i++) {
    if (pedidos.has(i)) continue;
    const d = i - actual;
    // Lo que queda delante del movimiento cuesta su distancia; lo que queda detrás, el doble más uno.
    const coste = direccion === 0 || Math.sign(d) === direccion || d === 0 ? Math.abs(d) : Math.abs(d) * 2 + 1;
    if (coste < costeMejor) {
      costeMejor = coste;
      mejor = i;
    }
  }
  return mejor;
}
