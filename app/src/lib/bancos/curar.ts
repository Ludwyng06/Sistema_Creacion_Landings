import { readFile, rm, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

// Curaduría a mano de un banco: una persona mira la hoja de contactos y decide qué queda. Lo que se quita se borra del banco
// (registro y archivo) y se anota en `descartados.json` para que `npm run bancos` no lo vuelva a bajar.

export interface ResultadoCuraduria {
  quitados: number;
  quedan: number;
}

/** Nombre de archivo sin extensión, en minúscula: `PIA12235`, `pia12235.webp` y `pia12235` son la misma imagen. */
const clave = (nombre: string) => basename(nombre).replace(/\.webp$/i, "").toLowerCase();

export async function curarBanco(bancoId: string, archivos: string[], modo: "conservar" | "quitar", dirMedia: string): Promise<ResultadoCuraduria> {
  const { db } = await import("@/lib/db");
  const indicados = new Set(archivos.map(clave));
  const filas = await db.medioBanco.findMany({ where: { bancoId } });
  const sobran = filas.filter((f) => {
    const enLista = indicados.has(clave(f.ruta));
    return modo === "conservar" ? !enLista : enLista;
  });
  const carpeta = join(dirMedia, "bancos", bancoId);
  const archivoDescartados = join(carpeta, "descartados.json");
  const previos = new Set<string>(await readFile(archivoDescartados, "utf8").then((t) => JSON.parse(t) as string[], () => []));
  for (const f of sobran) {
    previos.add(`${f.fuente}:${f.idFuente}`);
    await rm(join(carpeta, basename(f.ruta)), { force: true });
    await db.medioBanco.delete({ where: { id: f.id } });
  }
  if (sobran.length > 0) await writeFile(archivoDescartados, JSON.stringify([...previos], null, 1), "utf8");
  return { quitados: sobran.length, quedan: filas.length - sobran.length };
}
