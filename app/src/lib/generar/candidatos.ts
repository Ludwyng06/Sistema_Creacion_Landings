import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { MedioBanco } from "@/lib/contratos";
import { buscarMedios } from "@/lib/bancos/repositorio";
import { optimizarImagen } from "@/lib/bancos/procesar";
import { descargar } from "@/lib/fuentes/http";
import { consultarSuave, type OpcionesEjecucion } from "@/lib/fuentes/ejecutar";
import { urlsImagenNasa } from "@/lib/fuentes/nasa-imagenes";
import type { Fuentes } from "@/lib/fuentes/registro";
import type { OpcionesFuente } from "@/lib/fuentes/tipos";
import type { Enrutado } from "./fuentes";

// Candidatos de imagen real para una landing: en espacio, el banco local (si existe) y, SIEMPRE, la búsqueda en vivo en NASA Images, APOD y
// Wikimedia por las consultas del brief (descargadas y optimizadas); para cualquier otro tema, Openverse y Wikimedia. Después el crítico de
// imágenes puntúa y elige. 24-A entrega 2: antes solo se leía el banco local de la base, que en una base sin sembrar llega vacío (las
// landings espaciales salían sin una sola foto de NASA).

const MAX_POR_FUENTE = 4;
const BAJADAS_A_LA_VEZ = 4;

export interface OpcionesCandidatos {
  dirMedia: string;
  fuentes: Fuentes;
  ejecucion?: OpcionesEjecucion;
  /** Para los tests: descarga de una URL. */
  bajar?: (fuente: string, url: string) => Promise<Buffer>;
  /** Para los tests: URL descargable de una imagen de NASA Images por su id. */
  urlNasa?: (nasaId: string) => Promise<string | null>;
  /** Opciones de las fuentes (entorno y `fetch`) para las consultas auxiliares. */
  opFuente?: OpcionesFuente;
}

interface Web {
  fuente: MedioBanco["fuente"];
  id: string;
  titulo: string;
  descripcion: string;
  url: string;
  credito: string;
  licencia: MedioBanco["licencia"];
  urlOrigen?: string;
}

const sinAcentos = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const palabras = (q: string) => sinAcentos(q).split(/[^a-z0-9]+/).filter((p) => p.length > 2);

/** Cuántas palabras de la consulta aparecen en el texto. */
const coincide = (texto: string, q: string) => {
  const t = sinAcentos(texto);
  return palabras(q).filter((p) => t.includes(p)).length;
};

async function enParalelo<T>(max: number, tareas: (() => Promise<T>)[]): Promise<T[]> {
  const salida: T[] = [];
  let i = 0;
  const trabajador = async () => {
    while (i < tareas.length) {
      const k = i++;
      salida[k] = await tareas[k]();
    }
  };
  await Promise.all(Array.from({ length: Math.min(max, tareas.length) }, trabajador));
  return salida;
}

export async function candidatosPorDefecto(consulta: string, enrutado: Enrutado, o: OpcionesCandidatos): Promise<MedioBanco[]> {
  const salida: MedioBanco[] = [];
  const ejec = o.ejecucion ?? {};
  const espacial = enrutado.imagenes.includes("nasa-images");
  if (espacial) {
    // Banco local (puede estar vacío en una base sin sembrar): se traen todos y el ranking decide por palabras clave.
    for (const banco of ["b1", "b3", "b4", "b5", "b7"]) salida.push(...(await buscarMedios({ banco, limite: 200 }).catch(() => [])));
  }
  const bajar = o.bajar ?? ((f: string, u: string) => descargar(f, u));
  const web: Web[] = [];
  const nasaUrl = o.urlNasa ?? (async (id: string) => {
    // La versión «large» (≈ 1-2 MB) basta para 1600 px y baja mucho más rápido que el original.
    const urls = await urlsImagenNasa(id, o.opFuente ?? {}).catch(() => [] as string[]);
    return urls[1] ?? urls[0] ?? null;
  });

  const busquedas: Promise<void>[] = [];
  if (espacial) {
    busquedas.push(
      (async () => {
        const r = await consultarSuave(o.fuentes.nasaImagenes, { q: consulta, max: 12 }, ejec);
        const buenas = (r?.datos ?? []).filter((f) => f.usoComercial).slice(0, MAX_POR_FUENTE);
        const urls = await Promise.all(buenas.map((f) => nasaUrl(f.nasaId).catch(() => null)));
        buenas.forEach((f, i) => {
          const url = urls[i] ?? f.miniatura;
          if (url) web.push({ fuente: "nasa-images", id: f.nasaId, titulo: f.titulo, descripcion: f.descripcion, url, credito: f.credito, licencia: "dominio-publico-nasa", urlOrigen: f.urlOrigen });
        });
      })(),
      (async () => {
        // APOD devuelve fotos al azar: solo entran las que hablan del tema de la consulta.
        const r = await consultarSuave(o.fuentes.apod, { cantidad: 24 }, ejec);
        const afines = (r?.datos ?? []).filter((f) => coincide(`${f.titulo} ${f.explicacion}`, consulta) >= 1).slice(0, MAX_POR_FUENTE);
        for (const f of afines) web.push({ fuente: "apod", id: `apod-${f.fecha}`, titulo: f.titulo, descripcion: f.explicacion.slice(0, 300), url: f.urlHd ?? f.url, credito: f.credito, licencia: "dominio-publico-nasa", urlOrigen: `https://apod.nasa.gov/apod/ap${f.fecha.replace(/-/g, "").slice(2)}.html` });
      })(),
    );
  }
  if (enrutado.imagenes.includes("openverse")) {
    busquedas.push(
      (async () => {
        const r = await consultarSuave(o.fuentes.openverse, { q: consulta, max: MAX_POR_FUENTE }, ejec);
        for (const f of r?.datos ?? []) web.push({ fuente: "openverse", id: f.idFuente, titulo: f.titulo, descripcion: "", url: f.url, credito: f.credito, licencia: f.licencia, urlOrigen: f.urlOrigen });
      })(),
    );
  }
  if (enrutado.imagenes.includes("wikimedia")) {
    busquedas.push(
      (async () => {
        const r = await consultarSuave(o.fuentes.wikimedia, { q: consulta, max: MAX_POR_FUENTE }, ejec);
        for (const f of r?.datos ?? []) web.push({ fuente: "wikimedia", id: f.idFuente, titulo: f.titulo, descripcion: f.descripcion, url: f.url, credito: f.credito, licencia: f.licencia, urlOrigen: f.urlOrigen });
      })(),
    );
  }
  await Promise.all(busquedas.map((p) => p.catch(() => undefined)));

  const carpeta = join(o.dirMedia, "bancos", "web");
  await mkdir(carpeta, { recursive: true });
  const descargadas = await enParalelo(
    BAJADAS_A_LA_VEZ,
    web.map((w) => async (): Promise<MedioBanco | null> => {
      const hash = createHash("sha256").update(`${w.fuente}|${w.id}`).digest("hex").slice(0, 16);
      const archivo = join(carpeta, `${hash}.webp`);
      try {
        const img = await optimizarImagen(await bajar(w.fuente, w.url), { lado: 1600, calidad: 78 });
        if (img.ancho < 800) return null;
        if (!existsSync(archivo)) await writeFile(archivo, img.webp);
        return {
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
          descripcion: w.descripcion.slice(0, 300),
          etiquetas: [],
          credito: w.credito,
          licencia: w.licencia,
          usoComercial: true,
          ...(w.urlOrigen ? { urlOrigen: w.urlOrigen } : {}),
        };
      } catch {
        // una imagen que no baja se omite: hay más candidatos y, al final, la generada
        return null;
      }
    }),
  );
  for (const m of descargadas) if (m) salida.push(m);
  return salida;
}
