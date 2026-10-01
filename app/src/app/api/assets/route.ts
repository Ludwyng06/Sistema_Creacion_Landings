import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { z } from "zod";
import { actualizarDoc, obtenerLanding, registrarAsset } from "@/lib/landings";
import { ErrorHttp, json, manejar, validarEntrada } from "../_util";

const MB = 1024 * 1024;
const MAX_IMAGEN = 15 * MB;
const MAX_VIDEO = 40 * MB;
const TIPOS_IMAGEN = ["image/jpeg", "image/png", "image/webp", "image/avif"];

const Campos = z.object({
  landingId: z.string().min(1, "Falta landingId"),
  slot: z
    .string()
    .min(1, "Falta slot")
    .max(80)
    .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, "El slot solo admite letras, números, guion y guion bajo (sin «..» ni «/»)"),
});

const RELACIONES: Record<string, number> = { "1:1": 1, "4:5": 4 / 5, "16:9": 16 / 9, "9:16": 9 / 16 };

import { carpetaMedia } from "@/lib/media/servir";

/**
 * `multipart/form-data { landingId, slot, archivo }` → 201 `{ ruta, tipo, slot }`.
 * Imagen (jpg, png, webp, avif; ≤ 15 MB): se recorta a la `relacion` del slot y se guarda como WebP calidad 82.
 * Video (mp4; ≤ 40 MB). Se guarda en `public/media/<landingId>/<slot>.<ext>` y se actualiza `assets[].ruta` del doc.
 */
export async function POST(request: Request) {
  return manejar(async () => {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new ErrorHttp(400, "La petición debe ser multipart/form-data.");
    }
    const { landingId, slot } = validarEntrada(Campos, { landingId: form.get("landingId"), slot: form.get("slot") });
    const archivo = form.get("archivo");
    if (!(archivo instanceof File)) throw new ErrorHttp(400, "Falta el archivo (campo «archivo»).");
    const landing = await obtenerLanding(landingId);

    const esVideo = archivo.type === "video/mp4";
    if (!esVideo && !TIPOS_IMAGEN.includes(archivo.type)) {
      throw new ErrorHttp(400, "Formato no admitido: usa jpg, png, webp, avif o mp4.");
    }
    if (archivo.size > (esVideo ? MAX_VIDEO : MAX_IMAGEN)) {
      throw new ErrorHttp(400, `El archivo supera el máximo de ${esVideo ? 40 : 15} MB.`);
    }

    const buffer = Buffer.from(await archivo.arrayBuffer());
    const carpeta = join(carpetaMedia(), landingId);
    await mkdir(carpeta, { recursive: true });
    const ext = esVideo ? "mp4" : "webp";
    const asset = landing.doc.assets.find((a) => a.slot === slot);

    if (esVideo) {
      await writeFile(join(carpeta, `${slot}.${ext}`), buffer);
    } else {
      let imagen: ReturnType<typeof sharp>;
      try {
        imagen = sharp(buffer);
        const { width, height } = await imagen.metadata();
        if (!width || !height) throw new Error("sin dimensiones");
        const relacion = asset ? RELACIONES[asset.relacion] : undefined;
        if (relacion) {
          let w = width;
          let h = Math.round(width / relacion);
          if (h > height) {
            h = height;
            w = Math.round(height * relacion);
          }
          imagen = imagen.extract({
            left: Math.floor((width - w) / 2),
            top: Math.floor((height - h) / 2),
            width: w,
            height: h,
          });
        }
        await writeFile(join(carpeta, `${slot}.${ext}`), await imagen.webp({ quality: 82 }).toBuffer());
      } catch {
        throw new ErrorHttp(400, "No se pudo leer la imagen: el archivo está dañado.");
      }
    }

    const ruta = `/media/${landingId}/${slot}.${ext}`;
    await registrarAsset({ landingId, slot, tipo: esVideo ? "video" : "imagen", ruta, promptGrok: asset?.promptGrok });
    if (asset) {
      const doc = { ...landing.doc, assets: landing.doc.assets.map((a) => (a.slot === slot ? { ...a, ruta } : a)) };
      await actualizarDoc(landingId, doc);
    }
    return json({ ruta, tipo: esVideo ? "video" : "imagen", slot }, 201);
  });
}
