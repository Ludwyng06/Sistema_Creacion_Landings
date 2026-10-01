import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { LandingDoc } from "@/lib/contratos";
import { db } from "@/lib/db";

// Imágenes de public/media/vitrina/ que alguna landing sigue usando: nunca se borran (base de datos o datos/vitrina/*.json).

const PREFIJO = "/media/vitrina/";

export function rutasDeDoc(doc: { assets?: { ruta?: string }[] }): string[] {
  return (doc.assets ?? []).map((a) => a.ruta).filter((r): r is string => typeof r === "string" && r.startsWith(PREFIJO));
}

/** Rutas web (`/media/vitrina/<slug>/<archivo>`) usadas por las landings de la base y por los JSON de la vitrina. */
export async function rutasReferenciadas(carpetaDatos: string): Promise<Set<string>> {
  const rutas = new Set<string>();
  const filas = await db.landing.findMany({ select: { doc: true } });
  for (const f of filas) {
    try {
      for (const r of rutasDeDoc(JSON.parse(f.doc) as LandingDoc)) rutas.add(r);
    } catch {
      // un documento dañado no referencia nada
    }
  }
  if (existsSync(carpetaDatos)) {
    for (const nombre of (await readdir(carpetaDatos)).filter((n) => n.endsWith(".json"))) {
      try {
        const j = JSON.parse(await readFile(join(carpetaDatos, nombre), "utf8")) as { doc?: LandingDoc };
        if (j.doc) for (const r of rutasDeDoc(j.doc)) rutas.add(r);
      } catch {
        // JSON ilegible: se ignora
      }
    }
  }
  return rutas;
}
