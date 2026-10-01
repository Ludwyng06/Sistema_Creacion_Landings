import { render } from "@testing-library/react";
import { LandingRender } from "@/componentes/LandingRender";
import type { Asset, LandingDoc, Seccion, Tokens } from "@/lib/contratos";
import { landingEjemplo } from "../fixtures/landing-ejemplo";

type Opciones = {
  assets?: Asset[];
  tokens?: Partial<Tokens>;
  reducirMovimiento?: boolean;
  /** Simula el editor: los marcadores de imagen ofrecen «Buscar en bancos». */
  onBuscarBancos?: (slot: string) => void;
};

/** Documento mínimo con los tokens y el meta del fixture del orquestador. */
export function docCon(secciones: Seccion[], opciones: Opciones = {}): LandingDoc {
  return {
    ...landingEjemplo,
    tokens: { ...landingEjemplo.tokens, ...opciones.tokens },
    secciones,
    assets: opciones.assets ?? landingEjemplo.assets,
  };
}

export function renderizar(secciones: Seccion[], opciones: Opciones = {}) {
  return render(
    <LandingRender doc={docCon(secciones, opciones)} reducirMovimiento={opciones.reducirMovimiento} onBuscarBancos={opciones.onBuscarBancos} />,
  );
}

/**
 * Simula `window.matchMedia`: cada consulta responde según los booleanos indicados.
 * Devuelve una función que restaura el original.
 */
export function simularMedia(respuestas: { reducir?: boolean; punteroFino?: boolean }): () => void {
  const original = window.matchMedia;
  window.matchMedia = ((consulta: string) => ({
    matches: consulta.includes("prefers-reduced-motion")
      ? Boolean(respuestas.reducir)
      : consulta.includes("pointer: fine")
        ? Boolean(respuestas.punteroFino)
        : false,
    media: consulta,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  return () => {
    window.matchMedia = original;
  };
}
