import type { CSSProperties } from "react";
import type { Tokens } from "@/lib/contratos";

// Familias que la app ya carga con next/font (ver layout.tsx): el nombre del token
// se resuelve a su variable CSS; el resto cae a una pila genérica.
const FAMILIAS_CARGADAS: Record<string, { variable: string; generica: string }> = {
  "space grotesk": { variable: "--font-space-grotesk", generica: "ui-sans-serif, system-ui, sans-serif" },
  "ibm plex sans": { variable: "--font-ibm-plex-sans", generica: "ui-sans-serif, system-ui, sans-serif" },
  fraunces: { variable: "--font-fraunces", generica: "ui-serif, Georgia, serif" },
  "instrument sans": { variable: "--font-instrument-sans", generica: "ui-sans-serif, system-ui, sans-serif" },
};

const GENERICA_POR_DEFECTO = "ui-sans-serif, system-ui, sans-serif";

export function familiaCss(nombre: string): string {
  const conocida = FAMILIAS_CARGADAS[nombre.trim().toLowerCase()];
  if (conocida) return `var(${conocida.variable}), ${conocida.generica}`;
  return `"${nombre.replace(/"/g, "")}", ${GENERICA_POR_DEFECTO}`;
}

const ESPACIO: Record<Tokens["espaciado"], string> = {
  denso: "clamp(2rem, 6vw, 3.5rem)",
  normal: "clamp(3rem, 8vw, 5.5rem)",
  aireado: "clamp(4rem, 11vw, 8rem)",
};

const ESCALA: Record<Tokens["tipografia"]["escala"], string> = {
  compacta: "0.92",
  normal: "1",
  amplia: "1.12",
};

const ANCHO_BORDE: Record<Tokens["borde"], string> = {
  ninguno: "0px",
  fino: "1px",
  grueso: "3px",
};

/** Única puerta entre `doc.tokens` y el CSS: los componentes solo leen estas variables. */
export function tokensAVariables(tokens: Tokens): CSSProperties {
  const { colores, tipografia } = tokens;
  const variables: Record<string, string> = {
    "--c-fondo": colores.fondo,
    "--c-superficie": colores.superficie,
    "--c-texto": colores.texto,
    "--c-texto-suave": colores.textoSuave,
    "--c-acento": colores.acento,
    "--c-acento-texto": colores.acentoTexto,
    "--c-borde": colores.borde,
    "--f-titulos": familiaCss(tipografia.titulos),
    "--f-cuerpo": familiaCss(tipografia.cuerpo),
    "--radio": `${tokens.radio}px`,
    "--espacio": ESPACIO[tokens.espaciado],
    "--escala": ESCALA[tipografia.escala],
    // Titulares y subtítulo siguen al texto hasta que alguien los separe (por landing o por sección).
    "--escala-t": "var(--escala)",
    "--escala-s": "var(--escala)",
    "--borde-ancho": ANCHO_BORDE[tokens.borde],
  };
  return variables as CSSProperties;
}
