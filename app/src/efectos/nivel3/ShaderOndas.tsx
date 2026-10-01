"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Mesh, Program, Renderer, Texture, Triangle } from "ogl";
import { useMovimiento } from "../movimiento";

const VERTICE = /* glsl */ `
  attribute vec2 uv;
  attribute vec2 position;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

// Distorsión suave: una onda que sale del puntero y un vaivén lento que sigue al scroll. Nada de destellos.
const FRAGMENTO = /* glsl */ `
  precision highp float;
  uniform sampler2D tMapa;
  uniform vec2 uImagen;
  uniform vec2 uLienzo;
  uniform vec2 uPuntero;
  uniform float uTiempo;
  uniform float uScroll;
  varying vec2 vUv;
  void main() {
    float escala = max(uLienzo.x / uImagen.x, uLienzo.y / uImagen.y);
    vec2 uv = (vUv - 0.5) * uLienzo / (uImagen * escala) + 0.5;
    vec2 aspecto = vec2(uLienzo.x / uLienzo.y, 1.0);
    float d = distance(vUv * aspecto, uPuntero * aspecto);
    float onda = sin(d * 26.0 - uTiempo * 2.2) * 0.006 * exp(-d * 3.5);
    float vaiven = sin(vUv.y * 9.0 + uTiempo * 0.8 + uScroll * 5.0) * 0.0025;
    uv += vec2(vaiven, onda);
    gl_FragColor = texture2D(tMapa, uv);
  }
`;

/** Lienzo WebGL (OGL) que dibuja la misma imagen con distorsión. Si algo falla, la imagen original se queda a la vista. */
function LienzoOndas({ imagen }: { imagen: HTMLImageElement }) {
  const lienzo = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = lienzo.current;
    const contenedor = canvas?.parentElement;
    if (!canvas || !contenedor) return;
    if (getComputedStyle(contenedor).position === "static") contenedor.style.position = "relative";
    let renderer: Renderer;
    try {
      renderer = new Renderer({ canvas, alpha: true, dpr: Math.min(window.devicePixelRatio || 1, 1.5) });
    } catch {
      return; // sin WebGL: se queda la imagen normal
    }
    const gl = renderer.gl;
    if (!gl) return;

    const textura = new Texture(gl, { generateMipmaps: false });
    const programa = new Program(gl, {
      vertex: VERTICE,
      fragment: FRAGMENTO,
      uniforms: {
        tMapa: { value: textura },
        uImagen: { value: [1, 1] },
        uLienzo: { value: [1, 1] },
        uPuntero: { value: [0.5, 0.5] },
        uTiempo: { value: 0 },
        uScroll: { value: 0 },
      },
    });
    // Si el shader no compila (GPU sin soporte, contexto perdido…), la imagen original se queda a la vista.
    if (!programa.program || !gl.getProgramParameter(programa.program, gl.LINK_STATUS)) return;
    const malla = new Mesh(gl, { geometry: new Triangle(gl), program: programa });

    let vivo = true;
    let listo = false;
    let visible = false;
    let cuadro = 0;
    const previo = imagen.style.visibility;

    const medir = () => {
      const ancho = contenedor.clientWidth;
      const alto = contenedor.clientHeight;
      if (ancho === 0 || alto === 0) return;
      renderer.setSize(ancho, alto);
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      programa.uniforms.uLienzo.value = [ancho * renderer.dpr, alto * renderer.dpr];
    };
    medir();
    const observadorTamano = typeof ResizeObserver !== "undefined" ? new ResizeObserver(medir) : null;
    observadorTamano?.observe(contenedor);

    const observadorVista = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver(([e]) => (visible = e.isIntersecting)) : null;
    if (observadorVista) observadorVista.observe(contenedor);
    else visible = true;

    const fuente = new Image();
    fuente.crossOrigin = "anonymous";
    fuente.onload = () => {
      if (!vivo) return;
      textura.image = fuente;
      programa.uniforms.uImagen.value = [fuente.naturalWidth, fuente.naturalHeight];
      listo = true;
      imagen.style.visibility = "hidden";
      canvas.dataset.listo = "true";
    };
    fuente.src = imagen.currentSrc || imagen.src;

    const alMoverse = (e: PointerEvent) => {
      const c = contenedor.getBoundingClientRect();
      programa.uniforms.uPuntero.value = [(e.clientX - c.left) / c.width, 1 - (e.clientY - c.top) / c.height];
    };
    contenedor.addEventListener("pointermove", alMoverse, { passive: true });

    const dibujar = (t: number) => {
      cuadro = requestAnimationFrame(dibujar);
      if (!listo || !visible || document.hidden) return;
      programa.uniforms.uTiempo.value = t / 1000;
      programa.uniforms.uScroll.value = window.scrollY / 1000;
      renderer.render({ scene: malla });
    };
    cuadro = requestAnimationFrame(dibujar);

    return () => {
      vivo = false;
      cancelAnimationFrame(cuadro);
      observadorTamano?.disconnect();
      observadorVista?.disconnect();
      contenedor.removeEventListener("pointermove", alMoverse);
      imagen.style.visibility = previo;
      // En desarrollo React monta dos veces el efecto con el mismo canvas: solo se suelta el contexto si el canvas se fue.
      queueMicrotask(() => {
        if (!canvas.isConnected) gl.getExtension("WEBGL_lose_context")?.loseContext();
      });
    };
  }, [imagen]);

  return <canvas ref={lienzo} aria-hidden="true" data-lienzo-ondas className="pointer-events-none absolute inset-0 size-full" />;
}

/**
 * `shader-ondas`: distorsión suave sobre las imágenes de la sección (galería o héroe), dibujada con OGL sobre cada
 * imagen. Con `prefers-reduced-motion`, o si el navegador no ofrece WebGL, las imágenes se ven tal cual.
 */
export function ShaderOndas({ children }: { children: ReactNode }) {
  const { reducido } = useMovimiento();
  const raiz = useRef<HTMLDivElement>(null);
  const [imagenes, setImagenes] = useState<HTMLImageElement[]>([]);

  useEffect(() => {
    if (reducido) return;
    const buscar = () => {
      const lista = [...(raiz.current?.querySelectorAll("img") ?? [])].filter((img) => img.parentElement && (img.currentSrc || img.src)).slice(0, 4);
      setImagenes((previo) => (previo.length === lista.length && previo.every((img, i) => img === lista[i]) ? previo : lista));
    };
    buscar();
    const observador = new MutationObserver(buscar);
    if (raiz.current) observador.observe(raiz.current, { childList: true, subtree: true });
    return () => observador.disconnect();
  }, [reducido]);

  if (reducido) return <div data-efecto-estatico="shader-ondas">{children}</div>;
  return (
    <div ref={raiz} data-shader-ondas>
      {children}
      {imagenes.map((img) => createPortal(<LienzoOndas imagen={img} />, img.parentElement!, img.currentSrc || img.src))}
    </div>
  );
}
