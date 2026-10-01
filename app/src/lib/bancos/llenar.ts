import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { LicenciaMedio, MedioBanco } from "@/lib/contratos";
import type { DepsEnrutador } from "@/lib/ia/enrutador";
import type { AlmacenFuentes } from "@/lib/fuentes/cache";
import { consultarSuave } from "@/lib/fuentes/ejecutar";
import { descargar } from "@/lib/fuentes/http";
import { urlsImagenNasa } from "@/lib/fuentes/nasa-imagenes";
import { crearFuentes, type Fuentes } from "@/lib/fuentes/registro";
import { ErrorFuente, type OpcionesFuente } from "@/lib/fuentes/tipos";
import { bancoPorId, IMAGENES_POR_BANCO, type DefinicionBanco } from "./definicion";
import { describirMedios, type MedioParaDescribir } from "./enriquecer";
import { medirImagen, optimizarImagen } from "./procesar";
import { actualizarDescripcion, existeMedio, guardarMedio, medioSinDescribir, type NuevoMedio } from "./repositorio";

// Llena un banco: recorre sus consultas semilla, descarga, optimiza a WebP (máximo 1920 px) en public/media/bancos/<banco>/,
// guarda el registro con su crédito y licencia y pide a la IA el título, la descripción y las etiquetas en español.

export interface Candidato {
  fuente: MedioBanco["fuente"];
  idFuente: string;
  titulo: string;
  descripcionOrigen: string;
  credito: string;
  licencia: LicenciaMedio;
  usoComercial: boolean;
  urlOrigen: string;
  /** URLs para descargar, de la mejor a la peor. Vacío: se resuelven al momento (NASA). */
  urls: string[];
  /** Solo NASA: hay que pedir `/asset/{id}` para saber las URLs. */
  resolverUrls?: () => Promise<string[]>;
}

export interface DepsLlenado {
  fuentes?: Fuentes;
  opcionesFuente?: OpcionesFuente;
  almacen?: AlmacenFuentes;
  /** Carpeta `public/media` (los tests usan una temporal). */
  dirMedia: string;
  /** Imágenes que se buscan en el banco. */
  n?: number;
  /** `false` salta la IA: los medios quedan sin descripción en español hasta `--solo-ia`. */
  usarIA?: boolean;
  depsIA?: DepsEnrutador;
  descargarArchivo?: (fuente: string, url: string) => Promise<Buffer>;
  guardar?: (m: NuevoMedio) => Promise<MedioBanco>;
  existe?: (bancoId: string, fuente: string, idFuente: string) => Promise<boolean>;
  log?: (linea: string) => void;
}

export interface ResumenBanco {
  banco: string;
  guardados: number;
  yaEstaban: number;
  descartados: number;
  sinDescribir: number;
  /** Consultas semilla que no respondieron (la fuente falló o estaba apagada). */
  consultasFallidas: string[];
}

const LOTE_IA = 6;

const enMinuscula = (t: string) => t.toLowerCase();

/** Alterna los resultados de cada consulta semilla, para que un solo tema no llene el banco. */
export function intercalar<T>(listas: T[][]): T[] {
  const salida: T[] = [];
  const max = Math.max(0, ...listas.map((l) => l.length));
  for (let i = 0; i < max; i++) for (const l of listas) if (i < l.length) salida.push(l[i]);
  return salida;
}

export function nombreArchivo(idFuente: string): string {
  return (
    idFuente
      .replace(/^File:/i, "")
      .replace(/\.[a-z0-9]{3,4}$/i, "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 60) || "medio"
  );
}

async function candidatosDe(def: DefinicionBanco, d: DepsLlenado, resumen: ResumenBanco): Promise<Candidato[]> {
  const f = d.fuentes ?? crearFuentes(d.opcionesFuente);
  const ctx = { almacen: d.almacen };
  const porConsulta: Candidato[][] = [];
  for (const q of def.consultas) {
    // Una lista por fuente, alternadas: con varias fuentes ninguna acapara el banco.
    const listas: Candidato[][] = [];
    for (const fuente of def.fuentes) {
      const lista: Candidato[] = [];
      listas.push(lista);
      if (fuente === "nasa-images") {
        const r = await consultarSuave(f.nasaImagenes, { q, max: 30 }, ctx);
        if (!r) resumen.consultasFallidas.push(`nasa-images:${q}`);
        for (const i of r?.datos ?? []) {
          lista.push({
            fuente: "nasa-images",
            idFuente: i.nasaId,
            titulo: i.titulo,
            descripcionOrigen: i.descripcion,
            credito: i.credito,
            licencia: "dominio-publico-nasa",
            usoComercial: i.usoComercial,
            urlOrigen: i.urlOrigen,
            urls: [],
            resolverUrls: () => urlsImagenNasa(i.nasaId, d.opcionesFuente),
          });
        }
      } else if (fuente === "wikimedia") {
        const r = await consultarSuave(f.wikimedia, { q, max: 20, ancho: 1600 }, ctx);
        if (!r) resumen.consultasFallidas.push(`wikimedia:${q}`);
        for (const i of r?.datos ?? []) {
          lista.push({
            fuente: "wikimedia",
            idFuente: i.idFuente,
            titulo: i.titulo,
            descripcionOrigen: i.descripcion,
            credito: i.credito,
            licencia: i.licencia,
            usoComercial: true,
            urlOrigen: i.urlOrigen,
            urls: [i.url],
          });
        }
      } else if (fuente === "openverse") {
        const r = await consultarSuave(f.openverse, { q, max: 20 }, ctx);
        if (!r) resumen.consultasFallidas.push(`openverse:${q}`);
        for (const i of r?.datos ?? []) {
          lista.push({
            fuente: "openverse",
            idFuente: i.idFuente,
            titulo: i.titulo,
            descripcionOrigen: i.etiquetas.join(", "),
            credito: i.credito,
            licencia: i.licencia,
            usoComercial: true,
            urlOrigen: i.urlOrigen,
            urls: [i.url],
          });
        }
      } else if (fuente === "pixabay") {
        const r = await consultarSuave(f.pixabay, { q, max: 15 }, ctx); // null si no hay PIXABAY_API_KEY: se omite sin error
        for (const i of r?.datos ?? []) {
          lista.push({
            fuente: "pixabay",
            idFuente: i.idFuente,
            titulo: i.titulo,
            descripcionOrigen: i.etiquetas.join(", "),
            credito: i.credito,
            licencia: "pixabay",
            usoComercial: true,
            urlOrigen: i.urlOrigen,
            urls: [i.url],
          });
        }
      } else if (fuente === "pexels") {
        const r = await consultarSuave(f.pexels, { q, max: 15 }, ctx); // null si no hay PEXELS_API_KEY: se omite sin error
        for (const i of r?.datos ?? []) {
          lista.push({
            fuente: "pexels",
            idFuente: i.idFuente,
            titulo: i.alt || q,
            descripcionOrigen: i.alt,
            credito: i.credito,
            licencia: "pexels",
            usoComercial: true,
            urlOrigen: i.urlOrigen,
            urls: [i.url],
          });
        }
      }
    }
    porConsulta.push(intercalar(listas));
  }
  return intercalar(porConsulta);
}

/** Llena un banco hasta `n` imágenes. Idempotente: lo que ya está no se vuelve a bajar. */
export async function llenarBanco(def: DefinicionBanco, d: DepsLlenado): Promise<ResumenBanco> {
  const log = d.log ?? (() => undefined);
  const guardar = d.guardar ?? guardarMedio;
  const existe = d.existe ?? existeMedio;
  const bajar = d.descargarArchivo ?? ((fuente: string, url: string) => descargar(fuente, url, d.opcionesFuente));
  const meta = d.n ?? IMAGENES_POR_BANCO;
  const resumen: ResumenBanco = { banco: def.id, guardados: 0, yaEstaban: 0, descartados: 0, sinDescribir: 0, consultasFallidas: [] };
  const carpeta = join(d.dirMedia, "bancos", def.id);
  await mkdir(carpeta, { recursive: true });

  // Lo que ya se bajó y no sirvió (muy chico) no se vuelve a bajar en la siguiente corrida.
  const archivoDescartados = join(carpeta, "descartados.json");
  const descartadosPrevios = new Set<string>(await readFile(archivoDescartados, "utf8").then((t) => JSON.parse(t) as string[], () => []));
  const descartadosNuevos = new Set<string>(descartadosPrevios);

  const candidatos = await candidatosDe(def, d, resumen);
  const vistos = new Set<string>();
  const nuevos: { id: string; candidato: Candidato }[] = [];
  let verticales = 0;
  let total = 0;

  for (const c of candidatos) {
    if (total >= meta) break;
    const clave = `${c.fuente}:${c.idFuente}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    if (descartadosPrevios.has(clave)) {
      resumen.descartados++;
      continue;
    }
    if (!c.usoComercial) {
      resumen.descartados++;
      continue;
    }
    const texto = enMinuscula(`${c.titulo} ${c.descripcionOrigen.slice(0, 200)}`);
    if (def.excluir.some((p) => texto.includes(p))) {
      resumen.descartados++;
      continue;
    }
    if (await existe(def.id, c.fuente, c.idFuente)) {
      resumen.yaEstaban++;
      total++;
      continue;
    }
    try {
      const urls = c.urls.length > 0 ? c.urls : ((await c.resolverUrls?.()) ?? []);
      let buffer: Buffer | null = null;
      for (const u of urls) {
        try {
          buffer = await bajar(c.fuente, u);
          break;
        } catch (e) {
          if (!(e instanceof ErrorFuente)) throw e;
        }
      }
      if (!buffer) {
        resumen.descartados++;
        continue;
      }
      const { ancho, alto } = await medirImagen(buffer);
      if (ancho < def.anchoMinimo || alto < 700) {
        resumen.descartados++;
        descartadosNuevos.add(clave);
        continue;
      }
      // Los fondos son sobre todo horizontales: como mucho la cuarta parte del banco puede ser vertical.
      if (ancho / alto < 0.87 && verticales >= Math.floor(meta / 4)) {
        resumen.descartados++;
        continue;
      }
      const img = await optimizarImagen(buffer);
      if (img.orientacion === "vertical") verticales++;
      const archivo = `${nombreArchivo(c.idFuente)}.webp`;
      await writeFile(join(carpeta, archivo), img.webp);
      const medio = await guardar({
        bancoId: def.id,
        tipo: "imagen",
        fuente: c.fuente,
        idFuente: c.idFuente,
        ruta: `/media/bancos/${def.id}/${archivo}`,
        ancho: img.ancho,
        alto: img.alto,
        orientacion: img.orientacion,
        coloresDominantes: img.coloresDominantes,
        titulo: c.titulo,
        descripcion: "",
        etiquetas: [],
        credito: c.credito,
        licencia: c.licencia,
        usoComercial: c.usoComercial,
        urlOrigen: c.urlOrigen,
        descripcionOrigen: c.descripcionOrigen,
      });
      nuevos.push({ id: medio.id, candidato: c });
      resumen.guardados++;
      total++;
      log(`  ${def.id} ${total}/${meta} ${c.idFuente} (${img.ancho}×${img.alto})`);
    } catch (e) {
      resumen.descartados++;
      log(`  ${def.id} se omitió ${c.idFuente}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (descartadosNuevos.size > descartadosPrevios.size) await writeFile(archivoDescartados, JSON.stringify([...descartadosNuevos], null, 1), "utf8");

  if (d.usarIA !== false) resumen.sinDescribir = await describirPendientes(def, d, nuevos);
  else resumen.sinDescribir = nuevos.length;
  return resumen;
}

/** Pide a la IA la descripción de los medios recién guardados, de a `LOTE_IA`. Devuelve cuántos quedaron sin describir. */
async function describirPendientes(def: DefinicionBanco, d: DepsLlenado, nuevos: { id: string; candidato: Candidato }[]): Promise<number> {
  const log = d.log ?? (() => undefined);
  let pendientes = 0;
  for (let i = 0; i < nuevos.length; i += LOTE_IA) {
    const lote = nuevos.slice(i, i + LOTE_IA);
    const fichas: MedioParaDescribir[] = lote.map(({ id, candidato }) => ({ id, titulo: candidato.titulo, texto: candidato.descripcionOrigen, banco: def.id, tema: def.nombre }));
    try {
      const r = await describirMedios(fichas, d.depsIA);
      for (const f of fichas) {
        const x = r.get(f.id);
        if (x) await actualizarDescripcion(f.id, { titulo: x.titulo, descripcion: x.descripcion, etiquetas: x.etiquetas });
        else pendientes++;
      }
    } catch (e) {
      pendientes += fichas.length;
      log(`  ${def.id}: la IA no respondió (${e instanceof Error ? e.message.split("\n")[0] : String(e)}); quedan pendientes para --solo-ia`);
    }
  }
  return pendientes;
}

/** `npm run bancos -- --solo-ia`: describe los medios que quedaron sin descripción por falta de cuota. */
export async function completarDescripciones(bancoId: string | undefined, d: Pick<DepsLlenado, "depsIA" | "log">): Promise<{ hechos: number; pendientes: number }> {
  const log = d.log ?? (() => undefined);
  const faltan = await medioSinDescribir(bancoId);
  let hechos = 0;
  for (let i = 0; i < faltan.length; i += LOTE_IA) {
    const lote = faltan.slice(i, i + LOTE_IA);
    const fichas: MedioParaDescribir[] = lote.map((m) => ({ id: m.id, titulo: m.titulo, texto: m.descripcionOrigen, banco: m.bancoId, tema: bancoPorId(m.bancoId)?.nombre ?? m.bancoId }));
    try {
      const r = await describirMedios(fichas, d.depsIA);
      for (const f of fichas) {
        const x = r.get(f.id);
        if (x) {
          await actualizarDescripcion(f.id, { titulo: x.titulo, descripcion: x.descripcion, etiquetas: x.etiquetas });
          hechos++;
        }
      }
    } catch (e) {
      log(`la IA no respondió (${e instanceof Error ? e.message.split("\n")[0] : String(e)}); se pausa y se sigue después`);
      break;
    }
  }
  return { hechos, pendientes: faltan.length - hechos };
}
