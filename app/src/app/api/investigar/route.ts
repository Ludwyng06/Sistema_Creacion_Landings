import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { CategoriaBrief } from "@/lib/contratos";
import { obtenerDepsEnrutador } from "@/lib/ia/deps";
import { prepararFoto, TIPOS_FOTO } from "@/lib/investigacion/imagen";
import { ErrorSinClaveSerpApi, investigar } from "@/lib/investigacion/investigar";
import { ErrorSerpApi } from "@/lib/investigacion/serpapi";
import { ErrorHttp, json, leerCuerpo, manejar, validarEntrada } from "../_util";

const Campos = z.object({
  nombre: z.string().trim().min(2, "Escribe el nombre del producto").max(120),
  categoria: CategoriaBrief.optional(),
});

const CuerpoJson = Campos.extend({ imagenBase64: z.string().min(1).optional(), imagenTipo: z.enum(TIPOS_FOTO as [string, ...string[]]).optional() });

import { carpetaMedia } from "@/lib/media/servir";

/**
 * Investiga un producto en Google (SerpAPI, máx. 3 búsquedas, caché de 7 días) y arma un borrador del brief.
 *
 * Petición, una de dos:
 * - `multipart/form-data`: `nombre` (obligatorio), `categoria?` (una de `CategoriaBrief`) e `imagen?` (jpg, png, webp o avif, ≤ 15 MB).
 * - `application/json`: `{ nombre, categoria?, imagenBase64?, imagenTipo? }`.
 *
 * Respuesta 200: `RespuestaInvestigar` (ver `src/lib/contratos/investigacion.ts`):
 * `{ sugerencias: { beneficios[], objeciones[], preguntas[] }, consultas, usadas, cuota, borrador, identificacion, precioReferencia, avisos }`.
 * - Cada sugerencia: `{ texto, fuentes: [{ url, sitio }], tieneCifra }`. Las cifras ya vienen como `[COMPLETAR]`.
 * - `borrador`: campos propuestos `{ valor, fuentes, confianza, origen }` para `categoria`, `problema`, `publico`, `beneficios`, `objeciones`,
 *   `incluye`, `nivelConciencia` (con `motivo`), `coloresMarca` y `fotos`. NUNCA trae `precio`, `pruebaSocial`, `oferta` ni `garantia`.
 * - `precioReferencia`: `{ min, max, moneda, fuentes }` o `null`; solo informativo, no entra al brief.
 * - `cuota`: `{ usadasMes, limiteMes }` o `null`.
 *
 * Errores `{ error }`: 400 (falta el nombre, foto inválida), 503 (sin `SERPAPI_API_KEY`, o ningún proveedor de IA respondió),
 * 429 (se acabó el cupo de SerpAPI), 502 (SerpAPI falló).
 */
export async function POST(request: Request) {
  return manejar(async () => {
    let nombre: string;
    let categoria: z.infer<typeof CategoriaBrief> | undefined;
    let archivo: { buffer: Buffer; tipo: string } | undefined;

    if ((request.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      let form: FormData;
      try {
        form = await request.formData();
      } catch {
        throw new ErrorHttp(400, "La petición debe ser multipart/form-data válida.");
      }
      const c = form.get("categoria");
      ({ nombre, categoria } = validarEntrada(Campos, { nombre: form.get("nombre"), categoria: typeof c === "string" && c ? c : undefined }));
      const f = form.get("imagen");
      if (f instanceof File && f.size > 0) {
        if (!TIPOS_FOTO.includes(f.type)) throw new ErrorHttp(400, "Formato no admitido: usa jpg, png, webp o avif.");
        archivo = { buffer: Buffer.from(await f.arrayBuffer()), tipo: f.type };
      }
    } else {
      const c = await leerCuerpo(request, CuerpoJson);
      ({ nombre, categoria } = c);
      if (c.imagenBase64) archivo = { buffer: Buffer.from(c.imagenBase64, "base64"), tipo: c.imagenTipo ?? "image/jpeg" };
    }

    let foto: { jpegBase64: string; colores: string[]; ruta?: string } | undefined;
    if (archivo) {
      let p;
      try {
        p = await prepararFoto(archivo.buffer);
      } catch (e) {
        throw new ErrorHttp(400, e instanceof Error ? e.message : "No se pudo leer la foto.");
      }
      const carpeta = join(carpetaMedia(), "investigar");
      await mkdir(carpeta, { recursive: true });
      await writeFile(join(carpeta, `${p.id}.webp`), p.webp);
      foto = { jpegBase64: p.jpegBase64, colores: p.colores, ruta: `/media/investigar/${p.id}.webp` };
    }

    try {
      return json(await investigar({ nombre, categoria, foto }, { enrutador: obtenerDepsEnrutador() }));
    } catch (e) {
      if (e instanceof ErrorSinClaveSerpApi) throw new ErrorHttp(503, e.message, { sinClave: true });
      if (e instanceof ErrorSerpApi) throw new ErrorHttp(e.tipo === "cupo" ? 429 : e.tipo === "sin-clave" ? 503 : 502, e.message);
      throw e;
    }
  });
}
