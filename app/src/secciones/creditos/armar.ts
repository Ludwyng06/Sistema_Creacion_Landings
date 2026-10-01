import type { Asset, LicenciaMedio } from "@/lib/contratos";

export const NOMBRE_LICENCIA: Record<LicenciaMedio, string> = {
  "dominio-publico-nasa": "Dominio público (NASA)",
  cc0: "CC0 o dominio público",
  "cc-by-4.0": "CC BY 4.0",
  // CC BY de otra versión (2.0, 3.0): la versión exacta va en el texto del crédito.
  "cc-by": "CC BY",
  "cc-by-sa": "CC BY-SA",
  pexels: "Licencia Pexels",
  generada: "Imagen generada con IA",
  pixabay: "Licencia Pixabay",
  usuario: "Imagen propia",
};

export type LineaCredito = {
  credito: string;
  licencia: string;
  /** Enlace a la página de origen, solo si es http o https. */
  urlOrigen?: string;
  /** Slots que usan este crédito. */
  slots: string[];
};

const ES_WEB = /^https?:\/\//i;
const FUENTES_NASA = new Set(["nasa-images", "apod", "epic"]);

/** Los `Asset` con archivo, crédito y licencia, agrupados por crédito + licencia (una línea por autor). */
export function lineasDeCredito(assets: Asset[]): LineaCredito[] {
  const lineas = new Map<string, LineaCredito>();
  for (const asset of assets) {
    const credito = asset.credito?.trim();
    if (!asset.ruta || !credito || !asset.licencia) continue;
    const licencia = NOMBRE_LICENCIA[asset.licencia] ?? asset.licencia;
    const clave = `${credito}|${licencia}`;
    const existente = lineas.get(clave);
    if (existente) {
      existente.slots.push(asset.slot);
      existente.urlOrigen ??= asset.urlOrigen && ES_WEB.test(asset.urlOrigen) ? asset.urlOrigen : undefined;
    } else {
      lineas.set(clave, {
        credito,
        licencia,
        urlOrigen: asset.urlOrigen && ES_WEB.test(asset.urlOrigen) ? asset.urlOrigen : undefined,
        slots: [asset.slot],
      });
    }
  }
  return [...lineas.values()];
}

/** `true` si alguna imagen viene de la NASA: obliga al aviso de que no hay respaldo. */
export function usaImagenesNasa(assets: Asset[]): boolean {
  return assets.some((a) => a.ruta && a.credito && a.licencia && a.fuente && FUENTES_NASA.has(a.fuente));
}
