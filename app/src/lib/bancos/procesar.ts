import sharp from "sharp";
import type { OrientacionMedio } from "@/lib/contratos";
import { coloresDominantes } from "@/lib/investigacion/imagen";

// En Windows la caché de archivos de sharp los deja bloqueados y no se pueden borrar ni reemplazar.
sharp.cache(false);

export const LADO_MAXIMO = 1920;
export const CALIDAD_WEBP = 80;

export interface ImagenOptimizada {
  webp: Buffer;
  ancho: number;
  alto: number;
  orientacion: OrientacionMedio;
  coloresDominantes: string[];
}

export function orientacionDe(ancho: number, alto: number): OrientacionMedio {
  const r = ancho / alto;
  if (r > 1.15) return "horizontal";
  if (r < 0.87) return "vertical";
  return "cuadrada";
}

/** Dimensiones de la imagen original, sin decodificarla entera. */
export async function medirImagen(buffer: Buffer): Promise<{ ancho: number; alto: number }> {
  const m = await sharp(buffer, { limitInputPixels: false }).rotate().metadata();
  const rotada = (m.orientation ?? 1) >= 5;
  const ancho = (rotada ? m.height : m.width) ?? 0;
  const alto = (rotada ? m.width : m.height) ?? 0;
  return { ancho, alto };
}

/** WebP de hasta 1920 px por el lado mayor, con su orientación y sus colores dominantes. */
export async function optimizarImagen(buffer: Buffer, opciones: { lado?: number; calidad?: number } = {}): Promise<ImagenOptimizada> {
  const lado = opciones.lado ?? LADO_MAXIMO;
  const base = () => sharp(buffer, { limitInputPixels: false }).rotate();
  const { data, info } = await base()
    .resize(lado, lado, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: opciones.calidad ?? CALIDAD_WEBP })
    .toBuffer({ resolveWithObject: true });
  const colores = await coloresDominantes(data, 3).catch(() => [] as string[]);
  return { webp: data, ancho: info.width, alto: info.height, orientacion: orientacionDe(info.width, info.height), coloresDominantes: colores };
}
