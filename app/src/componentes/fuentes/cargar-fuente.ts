import { pesosParaFamilia, URL_BASE_FUENTES } from "@/lib/fuentes/url";

const pedidas = new Set<string>();

/**
 * Vista previa del selector: pide la familia (peso 400 o el más cercano) una sola vez, cuando la fila se ve, la persona
 * pasa por encima o la elige. El `<link>` queda en el `<head>` con `data-fuente-previa`.
 */
export function cargarFuente(familia: string): void {
  if (typeof document === "undefined" || pedidas.has(familia)) return;
  pedidas.add(familia);
  const [peso] = pesosParaFamilia(familia, [400]);
  const nombre = encodeURIComponent(familia.trim()).replace(/%20/g, "+");
  const enlace = document.createElement("link");
  enlace.rel = "stylesheet";
  enlace.href = `${URL_BASE_FUENTES}?family=${nombre}${peso ? `:wght@${peso}` : ""}&display=swap`;
  enlace.dataset.fuentePrevia = familia;
  document.head.appendChild(enlace);
}
