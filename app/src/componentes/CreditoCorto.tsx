"use client";

import { useAsset } from "./contexto-landing";

const MAXIMO = 48;

/** El crédito acortado para ir junto a la imagen («NASA/JPL-Caltech»). `null` si no hay. */
export function textoCreditoCorto(credito: string | undefined): string | null {
  const limpio = credito?.trim();
  if (!limpio) return null;
  return limpio.length > MAXIMO ? `${limpio.slice(0, MAXIMO - 1).trimEnd()}…` : limpio;
}

/** Crédito corto de la imagen de un slot, si el `Asset` trae ruta y crédito. No muestra nada si no. */
export function CreditoCorto({ slot, className = "" }: { slot?: string; className?: string }) {
  const asset = useAsset(slot);
  const texto = textoCreditoCorto(asset?.credito);
  if (!asset?.ruta || !texto) return null;
  return (
    <small data-credito={slot} title={asset.credito} className={`block text-xs text-suave ${className}`}>
      Imagen: {texto}
    </small>
  );
}
