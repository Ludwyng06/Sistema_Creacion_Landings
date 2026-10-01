"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react";

// Preferencias de movimiento y puntero. Todos los efectos pasan por aquí para tener
// un único respaldo `prefers-reduced-motion` (que la página de /dev/efectos puede simular).

function consulta(media: string): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
  return window.matchMedia(media);
}

export function useMedia(media: string): boolean {
  return useSyncExternalStore(
    (avisar) => {
      const lista = consulta(media);
      lista?.addEventListener?.("change", avisar);
      return () => lista?.removeEventListener?.("change", avisar);
    },
    () => consulta(media)?.matches ?? false,
    () => false,
  );
}

const ContextoMovimiento = createContext<{ forzarReducido: boolean }>({ forzarReducido: false });

export const ProveedorMovimiento = ContextoMovimiento.Provider;

export function useMovimiento(): { reducido: boolean; punteroFino: boolean } {
  const { forzarReducido } = useContext(ContextoMovimiento);
  const reducidoSistema = useMedia("(prefers-reduced-motion: reduce)");
  const punteroFino = useMedia("(pointer: fine)");
  return { reducido: forzarReducido || reducidoSistema, punteroFino };
}

/**
 * `true` cuando el elemento entra en pantalla (una sola vez). Sin `IntersectionObserver`
 * (entornos de prueba o navegadores viejos) se considera visible.
 */
export function useEnVista(ref: RefObject<Element | null>): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const elemento = ref.current;
    if (!elemento) return;
    if (typeof IntersectionObserver === "undefined") {
      const cuadro = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(cuadro);
    }
    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((entrada) => entrada.isIntersecting)) {
          setVisible(true);
          observador.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );
    observador.observe(elemento);
    return () => observador.disconnect();
  }, [ref]);

  return visible;
}

export type EstadoRevelado = "inicial" | "arriba" | "oculto" | "visible";

/**
 * Para los efectos de aparición. Lo que ya está a la vista al cargar (`inicial` en el HTML del servidor, `arriba` tras
 * hidratar) se pinta de una vez y anima con CSS, sin esperar a JavaScript: así el contenido de arriba no se retrasa y
 * el LCP no depende de la hidratación. Lo que queda por debajo pasa a `oculto` y se anuncia `visible` al entrar en pantalla.
 * Sin `IntersectionObserver` (pruebas, navegadores viejos) todo queda `visible`.
 */
export function useRevelado(ref: RefObject<Element | null>): EstadoRevelado {
  const [estado, setEstado] = useState<EstadoRevelado>("inicial");

  useEffect(() => {
    const elemento = ref.current;
    if (!elemento) return;
    if (typeof IntersectionObserver === "undefined") {
      const cuadro = requestAnimationFrame(() => setEstado("visible"));
      return () => cancelAnimationFrame(cuadro);
    }
    if (elemento.getBoundingClientRect().top < window.innerHeight * 0.92) {
      const cuadro = requestAnimationFrame(() => setEstado("arriba"));
      return () => cancelAnimationFrame(cuadro);
    }
    const cuadro = requestAnimationFrame(() => setEstado("oculto"));
    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((entrada) => entrada.isIntersecting)) {
          setEstado("visible");
          observador.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );
    observador.observe(elemento);
    return () => {
      cancelAnimationFrame(cuadro);
      observador.disconnect();
    };
  }, [ref]);

  return estado;
}
