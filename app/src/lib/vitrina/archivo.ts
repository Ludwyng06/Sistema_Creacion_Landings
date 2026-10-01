import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { Brief, LandingDoc, PromptEstructurado, TecnicaId } from "@/lib/contratos";
import { guardarEnBanco, obtenerPorSlug, upsertLandingPorSlug } from "@/lib/landings";

// Siembra la vitrina desde datos/vitrina/<slug>.json, sin claves de IA (`npm run db:semilla -- --vitrina`).

export const ArchivoVitrinaSchema = z.object({
  slug: z.string().min(1),
  numero: z.number().int(),
  brief: Brief,
  tecnicas: z.array(TecnicaId),
  prompt: PromptEstructurado,
  doc: LandingDoc,
  proveedor: z.string(),
});

export interface FilaVitrina {
  slug: string;
  estado: "creada" | "omitida" | "error";
  banco?: boolean;
  detalle?: string;
}

export async function sembrarVitrina(o: { carpeta: string; forzar?: boolean; solo?: string; log?: (l: string) => void }): Promise<FilaVitrina[]> {
  const archivos = (await readdir(o.carpeta).catch(() => [] as string[])).filter((f) => f.endsWith(".json")).sort();
  const filas: FilaVitrina[] = [];
  for (const f of archivos) {
    const slug = f.replace(/\.json$/, "");
    if (o.solo && o.solo !== slug) continue;
    try {
      const datos = ArchivoVitrinaSchema.parse(JSON.parse(await readFile(join(o.carpeta, f), "utf8")));
      const existente = await obtenerPorSlug(datos.doc.meta.slug);
      if (existente && !o.forzar) {
        filas.push({ slug, estado: "omitida", detalle: "ya existe (usa --forzar para rehacerla)" });
        continue;
      }
      const creada = await upsertLandingPorSlug({ brief: datos.brief, tecnicas: datos.tecnicas, prompt: datos.prompt, doc: datos.doc, proveedor: datos.proveedor });
      const banco = await guardarEnBanco(creada.id);
      filas.push({ slug, estado: "creada", banco: banco.ok, detalle: banco.ok ? undefined : banco.motivos.map((m) => `${m.validador}: ${m.mensaje}`).join("; ") });
    } catch (e) {
      filas.push({ slug, estado: "error", detalle: e instanceof Error ? e.message.split("\n")[0] : String(e) });
    }
  }
  return filas;
}
