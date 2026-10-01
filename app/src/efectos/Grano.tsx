"use client";

import { useMovimiento } from "./movimiento";

const RUIDO =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

/** `grano` (global): ruido de película al 5 % de opacidad. Con `prefers-reduced-motion` queda quieto. */
export function Grano() {
  const { reducido } = useMovimiento();
  return (
    <div
      aria-hidden="true"
      data-efecto="grano"
      data-estado={reducido ? "estatico" : "animado"}
      className="pointer-events-none absolute inset-0 z-40 overflow-hidden"
    >
      <div
        className={`absolute -inset-1/2 opacity-[0.05] ${reducido ? "" : "grano-capa"}`}
        style={{ backgroundImage: RUIDO }}
      />
    </div>
  );
}
