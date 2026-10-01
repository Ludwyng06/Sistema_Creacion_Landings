// npm run media [-- --forzar] [-- --comprimir]
// Recorre public/media/**: convierte a WebP (calidad 82) las imágenes que no lo sean (sin borrar el original),
// genera `<slot>-poster.webp` de cada .mp4 (y `home/home-poster.webp` desde `home-loop.mp4`) y registra o actualiza la tabla `Asset`.
// Con --comprimir recodifica cada .mp4 en su lugar hasta su presupuesto de docs/06 (ver comprimir.ts). Es idempotente.
import { existsSync } from "node:fs";
import { copyFile, readdir, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import { comprimirVideo, type ResultadoCompresion } from "./comprimir";
import { primerFotograma } from "./ffmpeg";

// En Windows la caché de archivos de sharp los deja bloqueados y no se pueden borrar ni reemplazar.
sharp.cache(false);

const EXT_IMAGEN = new Set([".jpg", ".jpeg", ".png", ".avif", ".tif", ".tiff", ".gif"]);

export interface AssetRegistro {
  /** `public/media/<landingId>/…` es una landing; ejemplos y home van con `null`. */
  landingId: string | null;
  slot: string;
  tipo: "imagen" | "video";
  ruta: string;
}

export interface ResumenMedia {
  convertidas: string[];
  posters: string[];
  registrados: number;
  omitidas: number;
  comprimidos: ResultadoCompresion[];
}

export interface OpcionesMedia {
  raiz?: string;
  forzar?: boolean;
  /** Recodifica los .mp4 a H.264 dentro de su presupuesto de peso. */
  comprimir?: boolean;
  /** Registra o actualiza un asset; por defecto escribe en la tabla `Asset`. */
  registrar?: (a: AssetRegistro) => Promise<void>;
}

async function registrarEnBase(a: AssetRegistro): Promise<void> {
  const { db } = await import("../src/lib/db");
  const previo = await db.asset.findFirst({ where: { ruta: a.ruta } });
  if (previo) await db.asset.update({ where: { id: previo.id }, data: { tipo: a.tipo, slot: a.slot, landingId: a.landingId } });
  else await db.asset.create({ data: a });
}

async function* archivos(dir: string): AsyncGenerator<string> {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const ruta = join(dir, e.name);
    if (e.isDirectory()) {
      // los fotogramas de `fotogramas` no son recursos; los bancos y la vitrina los administran `bancos` y `vitrina`
      if (!/-frames(-movil)?$/.test(e.name) && !["bancos", "vitrina"].includes(e.name)) yield* archivos(ruta);
    } else yield ruta;
  }
}

export async function procesarMedia(o: OpcionesMedia = {}): Promise<ResumenMedia> {
  const raiz = resolve(o.raiz ?? join(process.cwd(), "public", "media"));
  const resumen: ResumenMedia = { convertidas: [], posters: [], registrados: 0, omitidas: 0, comprimidos: [] };
  if (!existsSync(raiz)) return resumen;
  const registrar = o.registrar ?? registrarEnBase;

  const partes = (archivo: string) => relative(raiz, archivo).split(sep);
  const rutaWeb = (archivo: string) => `/media/${partes(archivo).join("/")}`;
  const landingDe = (archivo: string) => {
    const p = partes(archivo);
    return p.length > 1 && p[0] !== "home" && p[0] !== "ejemplos" ? p[0] : null;
  };
  const alta = async (archivo: string, tipo: "imagen" | "video") => {
    await registrar({ landingId: landingDe(archivo), slot: basename(archivo, extname(archivo)), tipo, ruta: rutaWeb(archivo) });
    resumen.registrados++;
  };

  const lista: string[] = [];
  for await (const f of archivos(raiz)) lista.push(f);

  for (const archivo of lista.sort()) {
    const ext = extname(archivo).toLowerCase();
    const base = archivo.slice(0, archivo.length - ext.length);
    if (EXT_IMAGEN.has(ext)) {
      const destino = `${base}.webp`;
      if (!o.forzar && existsSync(destino)) resumen.omitidas++;
      else {
        await sharp(archivo, { animated: false }).rotate().webp({ quality: 82 }).toFile(destino);
        resumen.convertidas.push(rutaWeb(destino));
      }
      await alta(destino, "imagen");
    } else if (ext === ".webp") {
      // Los pósters y los WebP que salen de un original ya se registraron al procesar su origen.
      const tieneOrigen = [...EXT_IMAGEN].some((x) => existsSync(base + x) || existsSync(base + x.toUpperCase()));
      if (base.endsWith("-poster") || tieneOrigen || !(await stat(archivo)).isFile()) continue;
      await alta(archivo, "imagen");
    } else if (ext === ".mp4") {
      if (basename(archivo).startsWith(".")) continue; // temporal de una compresión interrumpida
      if (o.comprimir) resumen.comprimidos.push(await comprimirVideo(archivo, { forzar: o.forzar }));
      const poster = `${base}-poster.webp`;
      if (!o.forzar && existsSync(poster)) resumen.omitidas++;
      else {
        await writeFile(poster, await sharp(await primerFotograma(archivo)).webp({ quality: 82 }).toBuffer());
        resumen.posters.push(rutaWeb(poster));
      }
      await alta(archivo, "video");
      // docs/06: el póster del clip principal del home se llama `home-poster.webp`.
      if (partes(archivo).join("/") === "home/home-loop.mp4") {
        const homePoster = join(dirname(archivo), "home-poster.webp");
        if (o.forzar || o.comprimir || !existsSync(homePoster)) await copyFile(poster, homePoster);
        await alta(homePoster, "imagen");
      }
    }
  }
  return resumen;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  procesarMedia({ forzar: process.argv.includes("--forzar"), comprimir: process.argv.includes("--comprimir") })
    .then((r) => {
      if (r.registrados === 0 && r.convertidas.length === 0 && r.posters.length === 0) {
        console.log("No hay recursos todavía.");
        return;
      }
      for (const c of r.comprimidos) {
        const mb = (n: number) => `${(n / 1024 / 1024).toFixed(2)} MB`;
        const nombre = basename(c.archivo);
        if (c.omitido) console.log(`  = ${nombre}: ${mb(c.antes)} ya cabe en ${mb(c.presupuesto)}`);
        else console.log(`  ${c.cabe ? "~" : "!"} ${nombre}: ${mb(c.antes)} → ${mb(c.despues)} (presupuesto ${mb(c.presupuesto)}, crf ${c.crf}, escala ${c.escala})${c.cabe ? "" : " NO CABE: hay que acortar o recortar el clip"}`);
      }
      console.log(`Imágenes convertidas: ${r.convertidas.length} · Pósters: ${r.posters.length} · Assets registrados: ${r.registrados} · Ya existían: ${r.omitidas}`);
      for (const ruta of [...r.convertidas, ...r.posters]) console.log(`  + ${ruta}`);
    })
    .catch((e) => {
      console.error(e instanceof Error ? e.message : e);
      process.exit(1);
    });
}
