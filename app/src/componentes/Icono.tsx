const TRAZOS: Record<string, string[]> = {
  check: ["M5 12.5l4.5 4.5L19 7.5"],
  espalda: ["M12 3v18", "M9 6h6", "M8.5 10h7", "M8.5 14h7", "M9 18h6"],
  reloj: ["M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z", "M12 7v5l3 2"],
  bateria: ["M3 8h15v8H3z", "M18 10.5h3v3h-3", "M6.5 11v2", "M9.5 11v2"],
  escudo: ["M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z", "M9 12l2 2 4-4"],
  envio: ["M3 7h11v9H3z", "M14 10h4l3 3v3h-7z"],
  corazon: ["M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"],
  estrella: ["M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"],
  rayo: ["M13 3L5 14h6l-1 7 8-11h-6z"],
  "flecha-abajo": ["M12 4v15", "M6 13l6 6 6-6"],
  mas: ["M12 5v14", "M5 12h14"],
  cerrar: ["M6 6l12 12", "M18 6L6 18"],
  play: ["M8 5l11 7-11 7z"],
  ojo: ["M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z", "M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z"],
  "ojo-cerrado": ["M3 3l18 18", "M10.6 6.1A9.8 9.8 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3 3.6", "M6.6 6.7A16.6 16.6 0 0 0 2 12s3.5 6 10 6c1.6 0 3-.3 4.2-.8"],
  copiar: ["M9 9h11v11H9z", "M5 15V4h11"],
  papelera: ["M4 7h16", "M9 7V4h6v3", "M6 7l1 13h10l1-13"],
  arrastre: ["M9 6h.01", "M15 6h.01", "M9 12h.01", "M15 12h.01", "M9 18h.01", "M15 18h.01"],
  "flecha-arriba": ["M12 20V5", "M6 11l6-6 6 6"],
  deshacer: ["M9 14L4 9l5-5", "M4 9h10a6 6 0 0 1 0 12h-3"],
  rehacer: ["M15 14l5-5-5-5", "M20 9H10a6 6 0 0 0 0 12h3"],
  candado: ["M6 11h12v9H6z", "M8.5 11V8a3.5 3.5 0 0 1 7 0v3"],
  billete: ["M3 7h18v10H3z", "M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z", "M6.5 12h.01", "M17.5 12h.01"],
  retorno: ["M4 12a8 8 0 1 0 2.6-5.9", "M4 4v4h4"],
  chat: ["M4 5h16v11H9l-5 4z", "M8 9.5h8", "M8 12.5h5"],
  flecha: ["M5 12h14", "M13 6l6 6-6 6"],
  "flecha-izquierda": ["M19 12H5", "M11 6l-6 6 6 6"],
  movil: ["M8 3h8v18H8z", "M11 18h2"],
  tablet: ["M5 4h14v16H5z", "M11 17h2"],
  escritorio: ["M3 5h18v11H3z", "M9 20h6", "M12 16v4"],
  "pantalla-completa": ["M4 9V4h5", "M20 9V4h-5", "M4 15v5h5", "M20 15v5h-5"],
  "salir-pantalla": ["M9 4v5H4", "M15 4v5h5", "M9 20v-5H4", "M15 20v-5h5"],
  editar: ["M4 20h4l10-10-4-4L4 16z", "M13 7l4 4"],
  paleta: ["M12 3a9 9 0 1 0 0 18c1.5 0 2-1 1.5-2-.6-1.2.2-2.5 1.6-2.5H17a4 4 0 0 0 4-4c0-5-4-9.5-9-9.5z", "M7.5 11h.01", "M10 7.5h.01", "M14.5 7.5h.01"],
  subir: ["M12 16V5", "M7 9l5-5 5 5", "M5 20h14"],
  descargar: ["M12 4v11", "M7 11l5 5 5-5", "M5 20h14"],
  enlace: ["M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1", "M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"],
  lista: ["M9 6h11", "M9 12h11", "M9 18h11", "M4.5 6h.01", "M4.5 12h.01", "M4.5 18h.01"],
  info: ["M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z", "M12 11v5", "M12 8h.01"],
};

const ALIAS: Record<string, string> = {
  postura: "espalda",
  tiempo: "reloj",
  carga: "bateria",
  garantia: "escudo",
  entrega: "envio",
  salud: "corazon",
};

/** Iconos de trazo que heredan `currentColor`; un nombre desconocido cae a «check». */
export function Icono({ nombre, className = "size-6" }: { nombre: string; className?: string }) {
  const clave = nombre.trim().toLowerCase();
  const trazos = TRAZOS[ALIAS[clave] ?? clave] ?? TRAZOS.check;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {trazos.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
