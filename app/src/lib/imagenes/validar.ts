import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { ejecutar, type DepsEnrutador } from "@/lib/ia/enrutador";
import { SISTEMA_VALIDAR_IMAGEN, usuarioValidarImagen, ValidacionImagen } from "@/lib/ia/prompts/validar-imagen";

// Tarea `validar-imagen` del enrutador: Gemini multimodal decide si una imagen sirve para el lugar que se le quiere dar.

/** Confianza mínima para aceptar una imagen «apta»: una respuesta dudosa cuenta como no apta. */
export const CONFIANZA_MINIMA = 0.6;

export interface ResultadoValidacion extends ValidacionImagen {
  proveedor: string;
}

export async function validarImagen(archivoOBuffer: string | Buffer, esperado: string, deps?: DepsEnrutador): Promise<ResultadoValidacion> {
  const original = typeof archivoOBuffer === "string" ? await readFile(archivoOBuffer) : archivoOBuffer;
  const jpeg = await sharp(original).resize(768, 768, { fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 80 }).toBuffer();
  const r = await ejecutar(
    {
      tarea: "validar-imagen",
      sistema: SISTEMA_VALIDAR_IMAGEN,
      usuario: usuarioValidarImagen(esperado),
      esquema: ValidacionImagen,
      imagen: { mimeType: "image/jpeg", base64: jpeg.toString("base64") },
      maxTokens: 400,
      temperatura: 0,
      rapido: true,
    },
    deps,
  );
  const apta = r.datos.apta && r.datos.confianza >= CONFIANZA_MINIMA;
  return { ...r.datos, apta, proveedor: r.proveedor };
}
