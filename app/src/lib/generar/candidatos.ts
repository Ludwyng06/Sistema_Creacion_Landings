import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { MedioBanco } from "@/lib/contratos";
import { buscarMedios } from "@/lib/bancos/repositorio";
import { optimizarImagen } from "@/lib/bancos/procesar";
import { descargar } from "@/lib/fuentes/http";
import { consultarSuave, type OpcionesEjecucion } from "@/lib/fuentes/ejecutar";
import type { Fuentes } from "@/lib/fuentes/registro";
import type { Enrutado } from "./fuentes";

// Candidatos de imagen real para una landing general: los bancos espaciales (NASA) o, para cualquier otro tema, Openverse y Wikimedia
// (descargados y optimizados). Después `validar-imagen` decide cuáles sirven; si ninguna, se genera con FLUX.

const MAX_POR_FUENTE = 4;

export interface OpcionesCandidatos {
  dirMedia: string;
  fuentes: Fuentes;
  ejecucion?: OpcionesEjecucion;
  /** Para los tests: descarga de una URL. */
  bajar?: (fuente: string, url: string) => Promise<Buffer>;
}

export async function candidatosPorDefecto(consulta: string, enrutado: Enrutado, o: OpcionesCandidatos): Promise<MedioBanco[]> {
  const salida: MedioBanco[] = [];
  if (enrutado.imagenes.includes("nasa-images")) {
    for (const banco of ["b1", "b3", "b4", "b5", "b7"]) salida.push(...(await buscarMedios({ banco, limite: 30 }).catch(() => [])));
  }
  const bajar = o.bajar ?? ((f: string, u: string) => descargar(f, u));
  const web: { fuente: MedioBanco["fuente"]; id: string; titulo: string; url: string; credito: string; licencia: MedioBanco["licencia"]; urlOrigen: string }[] = [];
  if (enrutado.imagenes.includes("openverse")) {
    const r = await consultarSuave(o.fuentes.openverse, { q: consulta, max: MAX_POR_FUENTE }, o.ejecucion ?? {});
    for (const f of r?.datos ?? []) web.push({ fuente: "openverse", id: f.idFuente, titulo: f.titulo, url: f.url, credito: f.credito, licencia: f.licencia, urlOrigen: f.urlOrigen });
  }
  if (enrutado.imagenes.includes("wikimedia")) {
    const r = await consultarSuave(o.fuentes.wikimedia, { q: consulta, max: MAX_POR_FUENTE }, o.ejecucion ?? {});
    for (const f of r?.datos ?? []) web.push({ fuente: "wikimedia", id: f.idFuente, titulo: f.titulo, url: f.url, credito: f.credito, licencia: f.licencia === "cc0" ? "cc0" : f.licencia, urlOrigen: f.urlOrigen });
  }
  const carpeta = join(o.dirMedia, "bancos", "web");
  await mkdir(carpeta, { recursive: true });
  for (const w of web) {
    const hash = createHash("sha256").update(`${w.fuente}|${w.id}`).digest("hex").slice(0, 16);
    const archivo = join(carpeta, `${hash}.webp`);
    try {
      const img = await optimizarImagen(await bajar(w.fuente, w.url), { lado: 1600, calidad: 78 });
      if (img.ancho < 800) continue;
      if (!existsSync(archivo)) await writeFile(archivo, img.webp);
      salida.push({
        id: hash,
        bancoId: "web",
        tipo: "imagen",
        fuente: w.fuente,
        idFuente: w.id,
        ruta: `/media/bancos/web/${hash}.webp`,
        ancho: img.ancho,
        alto: img.alto,
        orientacion: img.orientacion,
        coloresDominantes: img.coloresDominantes,
        titulo: w.titulo.slice(0, 120),
        descripcion: "",
        etiquetas: [],
        credito: w.credito,
        licencia: w.licencia,
        usoComercial: true,
        urlOrigen: w.urlOrigen,
      });
    } catch {
      // una imagen que no baja se omite: hay más candidatos y, al final, FLUX
    }
  }
  return salida;
}
