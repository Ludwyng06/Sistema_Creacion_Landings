"use client";

import { createContext, useContext } from "react";
import type { Asset } from "@/lib/contratos";

export type ValorLanding = {
  assets: Asset[];
  /** `id` del formulario de esta landing: único aunque haya varias en la misma página. */
  anclaFormulario: string;
  /** Id de la landing guardada: sin él (vista previa) el formulario no envía nada. */
  landingId?: string;
  /** `object-position` por slot de imagen (foco elegido en el editor). */
  focos?: Record<string, string>;
  /** Miniatura del editor: sin llamadas de red y sin elementos fijos a la ventana. */
  vistaPrevia?: boolean;
  /** Solo en el editor: abre la búsqueda de bancos del inspector para un slot sin imagen. */
  onBuscarBancos?: (slot: string) => void;
};

const ContextoLanding = createContext<ValorLanding>({
  assets: [],
  anclaFormulario: "formulario-lead",
});

export const ProveedorLanding = ContextoLanding.Provider;

export function useLanding(): ValorLanding {
  return useContext(ContextoLanding);
}

export function useAsset(slot?: string): Asset | undefined {
  const { assets } = useLanding();
  return slot ? assets.find((asset) => asset.slot === slot) : undefined;
}
