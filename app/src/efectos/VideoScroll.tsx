"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { MarcadorAsset } from "@/componentes/MarcadorAsset";
import {
  acercar,
  ajusteCover,
  ENFOQUE_CENTRADO,
  objectPosition,
  type Enfoque,
  elegirFuente,
  indiceDeFotograma,
  masCercano,
  nombreFotograma,
  ordenDeCarga,
  probarRecursos,
  rutasDelHome,
  siguienteAPedir,
  type FuenteVideo,
  type ManifiestoFotogramas,
  type RutasVideo,
} from "./video-scroll/fuente";
import { useMedia, useMovimiento } from "./movimiento";

const PROMPT_GROK_HOME =
  "One continuous slow forward dolly shot, no cuts: the camera travels through a vast architectural space made entirely of giant sheets of off-white paper, folded like monumental origami walls, thin graphite grid lines drawn on every surface; the paper walls unfold into clean rectangular panels stacked like the sections of a web page, soft natural daylight from above, 24mm lens, calm constant speed, no text, no people, no logos, no stars.";

// Pocas tareas a la vez: decodificar cuesta CPU y compite con el titular, el botón y las letras.
const CONCURRENCIA_CARGA = 2;
const CONCURRENCIA_DECODIFICAR = 2;
/** Bitmaps vivos a la vez (≈ 3,7 MB cada uno a 1280×720): unos 60 MB como máximo. */
const MAX_BITMAPS = 16;
const VECINOS_ADELANTE = 8;
const VECINOS_ATRAS = 2;
const SUAVIZADO = 0.2;

interface Props {
  /** Progreso 0–1 del recorrido. Es una ref para no re-renderizar en cada cuadro. */
  progreso: RefObject<number>;
  /** Rutas propias del clip; por defecto, las del home. */
  rutas?: (movil: boolean) => RutasVideo;
  className?: string;
  /** Dónde enfocar el recorte en pantallas estrechas (no hay clip vertical: se usa el 16:9 con `cover`). Por defecto, centrado. */
  enfoqueMovil?: Enfoque;
}

/**
 * Efecto `video-scroll` (nivel 3): el clip se recorre con el scroll, hacia delante y hacia atrás.
 * Prefiere la secuencia de fotogramas en un canvas; si no hay, usa `<video>` con `currentTime`;
 * si tampoco, el póster; y si no existe nada, el `<MarcadorAsset>` con su prompt de Grok.
 * Con `prefers-reduced-motion` muestra solo el póster fijo.
 */
export function VideoScroll({ progreso, rutas: rutasDe = rutasDelHome, className = "", enfoqueMovil = ENFOQUE_CENTRADO }: Props) {
  const { reducido } = useMovimiento();
  const movil = useMedia("(max-width: 767px)");
  const rutas = useMemo(() => rutasDe(movil), [rutasDe, movil]);
  const [fuente, setFuente] = useState<FuenteVideo | null>(null);
  const [posterFalla, setPosterFalla] = useState(false);

  useEffect(() => {
    let vivo = true;
    void probarRecursos(rutas).then((disponible) => {
      if (vivo) setFuente(elegirFuente({ movil, reducido, rutas, disponible }));
    });
    return () => {
      vivo = false;
    };
  }, [rutas, movil, reducido]);

  const enfoque = rutas.enfoque ?? (movil ? enfoqueMovil : ENFOQUE_CENTRADO);
  const posterSrc = fuente && fuente.tipo !== "marcador" ? (fuente.tipo === "poster" ? fuente.src : fuente.poster) : rutas.poster;

  return (
    <div className={`absolute inset-0 overflow-hidden bg-papel-hondo ${className}`} data-video-scroll data-fuente={fuente?.tipo ?? "cargando"}>
      {fuente?.tipo === "marcador" ? (
        <MarcadorAsset slot="home-loop" relacion="16:9" tipo="video" promptGrok={PROMPT_GROK_HOME} llenar />
      ) : (
        <>
          {/* Póster: se ve mientras cargan los fotogramas y queda fijo con reduced-motion. */}
          {posterSrc && !posterFalla && (
            // eslint-disable-next-line @next/next/no-img-element -- el póster es un recurso local con onError propio
            <img src={posterSrc} alt="" className="absolute inset-0 size-full object-cover" style={{ objectPosition: objectPosition(enfoque) }} onError={() => setPosterFalla(true)} />
          )}
          {fuente?.tipo === "fotogramas" && <LienzoFotogramas carpeta={fuente.carpeta} manifiesto={fuente.manifiesto} progreso={progreso} enfoque={enfoque} />}
          {fuente?.tipo === "video" && <VideoConTiempo src={fuente.src} progreso={progreso} enfoque={enfoque} />}
        </>
      )}
    </div>
  );
}

// ── Canvas con la secuencia de fotogramas ──────────────────────────────────

function LienzoFotogramas({ carpeta, manifiesto, progreso, enfoque }: { carpeta: string; manifiesto: ManifiestoFotogramas; progreso: RefObject<number>; enfoque: Enfoque }) {
  const lienzo = useRef<HTMLCanvasElement>(null);
  const enfoqueActual = useRef(enfoque);
  const [listo, setListo] = useState(false);
  useEffect(() => {
    enfoqueActual.current = enfoque;
  }, [enfoque]);

  useEffect(() => {
    const canvas = lienzo.current;
    const ctx = canvas?.getContext("2d", { alpha: false });
    if (!canvas || !ctx) return;
    const formato = manifiesto.formato ?? "webp";
    const n = manifiesto.n;
    // En memoria solo viajan los archivos comprimidos (≈ 25 MB en total); los bitmaps se decodifican bajo demanda y solo
    // viven los cercanos al cuadro actual (`MAX_BITMAPS`), ya al tamaño con que se pintan.
    const blobs: (Blob | null)[] = Array.from({ length: n }, () => null);
    const bitmaps = new Map<number, ImageBitmap>();
    const decodificando = new Set<number>();
    let anchoBitmap = 0;
    let cargados = 0;
    let vivo = true;
    let cuadro = 0;
    let pintado = -1;
    let actual = progreso.current ?? 0;
    let direccion: -1 | 0 | 1 = 0;
    let indiceActual = 0;

    const informar = () => {
      let bytes = 0;
      for (const b of bitmaps.values()) bytes += b.width * b.height * 4;
      canvas.dataset.bitmaps = String(bitmaps.size);
      canvas.dataset.bytesBitmaps = String(bytes);
    };
    const soltarTodos = () => {
      bitmaps.forEach((b) => b.close());
      bitmaps.clear();
      informar();
    };

    const medir = () => {
      // A la densidad real de la pantalla (tope 2): más píxeles no se ven y cuestan memoria.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      // Los bitmaps se crean con el ancho con que se pintan (sin pasar del original): si cambia, se vuelven a decodificar.
      // Reducir con calidad alta cuesta mucho CPU en cada cuadro: solo se reduce al decodificar cuando la ventana usa menos de la
      // mitad del original (ahorra memoria); si no, se decodifica a tamaño nativo y `drawImage` ajusta al pintar.
      const necesario = Math.max(1, Math.ceil(ajusteCover(manifiesto.ancho, manifiesto.alto, canvas.width, canvas.height).ancho));
      const ancho = necesario < manifiesto.ancho * 0.5 ? necesario : manifiesto.ancho;
      if (Math.abs(ancho - anchoBitmap) > 8) {
        anchoBitmap = ancho;
        soltarTodos();
      }
      pintado = -1; // fuerza repintar con el nuevo tamaño
    };
    medir();
    const observador = typeof ResizeObserver !== "undefined" ? new ResizeObserver(medir) : null;
    observador?.observe(canvas);

    const pintar = (indice: number) => {
      const img = bitmaps.get(indice);
      if (!img) return;
      // El recorte se calcula con la relación del original; el bitmap ya viene reducido a ese ancho.
      const c = ajusteCover(manifiesto.ancho, manifiesto.alto, canvas.width, canvas.height, enfoqueActual.current);
      ctx.drawImage(img, c.x, c.y, c.ancho, c.alto);
      pintado = indice;
      canvas.dataset.fotograma = String(indice + 1);
      if (!canvas.dataset.listo) {
        canvas.dataset.listo = "true";
        setListo(true);
      }
    };

    /** Decodifica un cuadro (ya descargado) al tamaño del lienzo y lo guarda en la caché, que conserva los más cercanos al actual. */
    const decodificar = (i: number) => {
      const blob = blobs[i];
      if (!blob || bitmaps.has(i) || decodificando.has(i) || decodificando.size >= CONCURRENCIA_DECODIFICAR) return;
      decodificando.add(i);
      const ancho = anchoBitmap;
      createImageBitmap(blob, { resizeWidth: ancho, resizeQuality: "high" })
        .then((bitmap) => {
          decodificando.delete(i);
          if (!vivo || ancho !== anchoBitmap) {
            bitmap.close();
            return;
          }
          bitmaps.set(i, bitmap);
          while (bitmaps.size > MAX_BITMAPS) {
            let lejos = -1;
            for (const k of bitmaps.keys()) if (k !== indiceActual && (lejos < 0 || Math.abs(k - indiceActual) > Math.abs(lejos - indiceActual))) lejos = k;
            if (lejos < 0) break;
            bitmaps.get(lejos)?.close();
            bitmaps.delete(lejos);
          }
          informar();
        })
        .catch(() => decodificando.delete(i));
    };

    // Descarga progresiva de los archivos comprimidos: primero 1 de cada 8 (el scroll ya funciona) y después el resto, por
    // prioridad según hacia dónde se desplace la persona, con pocas peticiones a la vez. Arranca cuando el navegador está
    // libre, para no competir con el titular, el botón y las letras.
    const primera = ordenDeCarga(n);
    const pedidos = new Set<number>();
    let siguiente = 0;
    const elegirSiguiente = (): number => {
      while (siguiente < primera.length) {
        const i = primera[siguiente++];
        if (!pedidos.has(i)) return i;
      }
      return siguienteAPedir(pedidos, n, indiceActual, direccion);
    };
    const trabajador = async () => {
      while (vivo) {
        const i = elegirSiguiente();
        if (i < 0) return;
        pedidos.add(i);
        try {
          const respuesta = await fetch(`${carpeta}/${nombreFotograma(i, formato)}`);
          if (!respuesta.ok) continue;
          blobs[i] = await respuesta.blob();
          canvas.dataset.cargados = String(++cargados);
        } catch {
          // un fotograma que falla se salta: se pinta el más cercano
        }
      }
    };
    const arrancar = () => {
      for (let k = 0; k < CONCURRENCIA_CARGA; k++) void trabajador();
    };
    const conIdle = typeof window.requestIdleCallback === "function";
    const espera = conIdle ? window.requestIdleCallback(arrancar, { timeout: 1200 }) : window.setTimeout(arrancar, 300);

    const paso = () => {
      cuadro = requestAnimationFrame(paso);
      if (document.hidden) return;
      const objetivo = progreso.current ?? 0;
      if (Math.abs(objetivo - actual) > 0.0005) direccion = objetivo > actual ? 1 : -1;
      actual = acercar(actual, objetivo, SUAVIZADO);
      indiceActual = indiceDeFotograma(actual, n);

      // Cuadros que conviene tener decodificados: el actual y los vecinos en el sentido del scroll (y un par detrás).
      const sentido = direccion === 0 ? 1 : direccion;
      const deseados = [indiceActual];
      for (let k = 1; k <= VECINOS_ADELANTE; k++) deseados.push(indiceActual + sentido * k);
      for (let k = 1; k <= VECINOS_ATRAS; k++) deseados.push(indiceActual - sentido * k);
      for (const d of deseados) {
        if (d < 0 || d >= n) continue;
        const i = blobs[d] ? d : masCercano(blobs, d);
        if (i >= 0) decodificar(i);
      }

      // Se pinta el cuadro actual; mientras se decodifica, el más cercano que ya esté listo.
      let indice = bitmaps.has(indiceActual) ? indiceActual : -1;
      if (indice < 0) {
        let mejor = Infinity;
        for (const k of bitmaps.keys()) {
          const distancia = Math.abs(k - indiceActual);
          if (distancia < mejor) {
            mejor = distancia;
            indice = k;
          }
        }
      }
      if (indice >= 0 && indice !== pintado) pintar(indice);
    };
    cuadro = requestAnimationFrame(paso);

    return () => {
      vivo = false;
      if (conIdle) window.cancelIdleCallback(espera);
      else window.clearTimeout(espera);
      cancelAnimationFrame(cuadro);
      observador?.disconnect();
      soltarTodos();
      blobs.fill(null);
    };
  }, [carpeta, manifiesto, progreso]);

  return (
    <canvas
      ref={lienzo}
      aria-hidden="true"
      data-lienzo-fotogramas
      className={`absolute inset-0 size-full transition-opacity duration-500 ${listo ? "opacity-100" : "opacity-0"}`}
    />
  );
}

// ── Respaldo: <video> con currentTime ──────────────────────────────────────

function VideoConTiempo({ src, progreso, enfoque }: { src: string; progreso: RefObject<number>; enfoque: Enfoque }) {
  const video = useRef<HTMLVideoElement>(null);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    const el = video.current;
    if (!el) return;
    let cuadro = 0;
    let actual = progreso.current ?? 0;
    // Nunca se pide un seek nuevo mientras el anterior no termine (`seeked`): encolarlos es lo que traba el clip.
    let buscando = false;
    const alTerminar = () => {
      buscando = false;
    };
    el.addEventListener("seeked", alTerminar);
    const paso = () => {
      cuadro = requestAnimationFrame(paso);
      if (document.hidden || !Number.isFinite(el.duration) || el.duration <= 0) return;
      actual = acercar(actual, progreso.current ?? 0, SUAVIZADO);
      const destino = actual * el.duration;
      if (buscando || el.seeking || Math.abs(el.currentTime - destino) <= 0.04) return;
      buscando = true;
      if (typeof el.fastSeek === "function") el.fastSeek(destino);
      else el.currentTime = destino;
    };
    cuadro = requestAnimationFrame(paso);
    return () => {
      cancelAnimationFrame(cuadro);
      el.removeEventListener("seeked", alTerminar);
    };
  }, [progreso]);

  return (
    <video
      ref={video}
      src={src}
      muted
      playsInline
      preload="auto"
      aria-hidden="true"
      data-video-tiempo
      onLoadedData={() => setListo(true)}
      style={{ objectPosition: objectPosition(enfoque) }}
      className={`absolute inset-0 size-full object-cover transition-opacity duration-500 ${listo ? "opacity-100" : "opacity-0"}`}
    />
  );
}
