"use client";

import { useEffect, useRef } from "react";

/**
 * Hoja de Google Fonts que no bloquea el primer pintado: se descarga como `media="print"` (sin bloquear) y, ya hidratada
 * la página, pasa a `all`. Mientras tanto se ve la tipografía de reserva (`display=swap`); sin JavaScript, el `noscript` la carga normal.
 */
export function HojaFuentes({ href }: { href: string }) {
  const ref = useRef<HTMLLinkElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.media = "all";
  }, [href]);
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link ref={ref} rel="stylesheet" href={href} media="print" />
      <noscript>
        <link rel="stylesheet" href={href} />
      </noscript>
    </>
  );
}
