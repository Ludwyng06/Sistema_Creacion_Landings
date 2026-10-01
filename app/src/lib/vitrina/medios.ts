import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import type { Asset, LandingDoc, MedioBanco, OrientacionMedio, Seccion } from "@/lib/contratos";
import { aLab, deltaE } from "@/lib/investigacion/imagen";
import { METAS } from "@/secciones/metas";
import { HEROE_ESPACIAL, HEROE_PRODUCTO, HEROE_SIN_IMAGEN } from "./plan";
import type { EntradaVitrina } from "./tipos";

// Asigna medios de los bancos a los slots de la landing: por orientación, relevancia y color con los tokens.
// Los medios que se usan se copian a public/media/vitrina/<slug>/ (WebP a 1600 px o menos): esos sí se suben a git.

export type RolSlot = "heroe" | "galeria" | "problema" | "incluye" | "otro";

export interface PedidoSlot {
  slot: string;
  rol: RolSlot;
}

/** Tope de toda la vitrina en disco, según la tarea 12-A. */
export const TOPE_BYTES_VITRINA = 25 * 1024 * 1024;
export const LADO_VITRINA = 1600;

const sinAcentos = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Cada slot que la landing usa, con su rol; sale de los campos `slot` de los metadatos de cada sección. */
export function slotsDelDoc(doc: LandingDoc): PedidoSlot[] {
  const salida: PedidoSlot[] = [];
  const visto = new Set<string>();
  const rolDe = (tipo: string): RolSlot => (tipo === "heroe" ? "heroe" : tipo === "galeria" ? "galeria" : tipo === "problema-solucion" ? "problema" : tipo === "incluye" ? "incluye" : "otro");
  const agrega = (tipo: string, valor: unknown) => {
    for (const v of Array.isArray(valor) ? valor : [valor]) {
      if (typeof v !== "string" || !v || visto.has(v)) continue;
      visto.add(v);
      salida.push({ slot: v, rol: rolDe(tipo) });
    }
  };
  for (const s of doc.secciones) {
    const meta = METAS[s.tipo];
    if (!meta) continue;
    for (const [campo, def] of Object.entries(meta.ajustes)) if (def.control === "slot") agrega(s.tipo, s.ajustes[campo]);
    for (const b of s.bloques) {
      const campos = meta.bloques[b.tipo]?.campos ?? {};
      for (const [campo, def] of Object.entries(campos)) if (def.control === "slot") agrega(s.tipo, b.ajustes[campo]);
    }
  }
  return salida;
}

const relacionDe = (o: OrientacionMedio): Asset["relacion"] => (o === "horizontal" ? "16:9" : o === "vertical" ? "4:5" : "1:1");

/** Luminosidad relativa (0 a 1) de un color `#rrggbb`. */
export function luminosidad(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0.5;
  const n = Number.parseInt(m[1], 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function rgbDe(hex: string) {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** Palabras clave de la entrada que aparecen en el título, la descripción, las etiquetas o el nombre del archivo del medio. */
export function coincidencias(m: MedioBanco, claves: string[]): number {
  const texto = sinAcentos(`${m.titulo} ${m.descripcion} ${m.etiquetas.join(" ")} ${m.idFuente}`);
  return new Set(claves.map(sinAcentos).filter((k) => k.length > 2 && texto.includes(k))).size;
}

export interface OpcionesElegir {
  entrada: EntradaVitrina;
  acento: string;
  usados?: Set<string>;
}

export function puntuar(m: MedioBanco, rol: RolSlot, o: OpcionesElegir, deBanco: Map<string, number>): number {
  let p = 0;
  const hits = coincidencias(m, o.entrada.claves);
  p += 2 * Math.min(3, hits);
  const orient: Record<RolSlot, Record<OrientacionMedio, number>> = {
    heroe: { horizontal: 4, cuadrada: 0, vertical: -4 },
    galeria: { horizontal: 2, cuadrada: 2, vertical: 1 },
    problema: { horizontal: 2, cuadrada: 3, vertical: 1 },
    incluye: { horizontal: 2, cuadrada: 3, vertical: 1 },
    otro: { horizontal: 1, cuadrada: 1, vertical: 0 },
  };
  p += orient[rol][m.orientacion];
  // Banco preferido: los primeros de la lista de la entrada pesan más.
  const i = o.entrada.bancos.indexOf(m.bancoId);
  p += i === -1 ? -2 : Math.max(0, 2 - i);
  // Variedad: no más de dos medios seguidos del mismo banco en la galería.
  if (rol === "galeria") p -= Math.max(0, (deBanco.get(m.bancoId) ?? 0) - 1);
  // El héroe espacial va sobre fondo oscuro para que el titular cumpla contraste.
  if (rol === "heroe" && o.entrada.tematica === "espacio" && m.coloresDominantes[0]) {
    const l = luminosidad(m.coloresDominantes[0]);
    p += l < 0.12 ? 3 : l < 0.3 ? 1 : -2;
  }
  // Color: un dominante parecido al acento de los tokens.
  const cercano = m.coloresDominantes.some((c) => deltaE(aLab(rgbDe(c)), aLab(rgbDe(o.acento))) < 40);
  if (cercano) p += 2;
  return p;
}

export interface Eleccion {
  slot: string;
  medio: MedioBanco;
  /** Palabras clave de la entrada que el medio cumple: con 2 o más, la foto muestra de verdad ese tipo de producto. */
  coincidencias: number;
}

export interface Ranqueado {
  medio: MedioBanco;
  puntos: number;
  coincidencias: number;
}

/** Candidatos del banco para un rol, del más al menos relevante, sin los ya usados. */
export function rankearMedios(rol: RolSlot, candidatos: MedioBanco[], o: OpcionesElegir, deBanco: Map<string, number> = new Map()): Ranqueado[] {
  const usados = o.usados ?? new Set<string>();
  return candidatos
    .filter((m) => !usados.has(m.id))
    .map((m) => ({ medio: m, puntos: puntuar(m, rol, o, deBanco), coincidencias: coincidencias(m, o.entrada.claves) }))
    .filter((x) => {
      const deProducto = x.medio.bancoId.startsWith("p-");
      // «Qué viene en la caja» solo con una foto de producto: una nebulosa ahí no dice la verdad.
      if (rol === "incluye") return deProducto && x.coincidencias >= 1;
      // El héroe de un producto es horizontal (el vertical no cubre el ancho).
      if (rol === "heroe" && o.entrada.tematica === "producto") return x.coincidencias >= 1 && x.medio.orientacion !== "vertical";
      // Las fotos de los bancos de producto (Wikimedia y Openverse traen ruido) piden al menos una coincidencia, también en las espaciales.
      if (o.entrada.tematica === "producto" || deProducto) return x.coincidencias >= 1;
      return true;
    })
    .sort((a, b) => b.puntos - a.puntos);
}

/** Elige un medio distinto para cada slot, del rol más exigente al menos exigente. */
export function elegirMedios(pedidos: PedidoSlot[], candidatos: MedioBanco[], o: OpcionesElegir): Eleccion[] {
  const prioridad: RolSlot[] = ["heroe", "galeria", "problema", "incluye", "otro"];
  const usados = o.usados ?? new Set<string>();
  const deBanco = new Map<string, number>();
  const elegidos: Eleccion[] = [];
  for (const rol of prioridad) {
    for (const pedido of pedidos.filter((p) => p.rol === rol)) {
      const mejor = rankearMedios(rol, candidatos, { ...o, usados }, deBanco)[0];
      if (!mejor) continue;
      usados.add(mejor.medio.id);
      deBanco.set(mejor.medio.bancoId, (deBanco.get(mejor.medio.bancoId) ?? 0) + 1);
      elegidos.push({ slot: pedido.slot, medio: mejor.medio, coincidencias: mejor.coincidencias });
    }
  }
  return elegidos;
}

/** Copia una imagen de un banco a public/media/vitrina/<slug>/ (WebP a 1600 px o menos) y devuelve su ruta web. Idempotente. */
export async function copiarAVitrina(rutaBanco: string, slug: string, dirMedia: string): Promise<string> {
  const nombre = rutaBanco.split("/").pop()!;
  const destinoDir = join(dirMedia, "vitrina", slug);
  const destino = join(destinoDir, nombre);
  mkdirSync(destinoDir, { recursive: true });
  if (!existsSync(destino)) {
    const origen = join(dirMedia, rutaBanco.replace(/^\/media\//, ""));
    const { data } = await sharp(origen).resize(LADO_VITRINA, LADO_VITRINA, { fit: "inside", withoutEnlargement: true }).webp({ quality: 78 }).toBuffer({ resolveWithObject: true });
    await sharp(data).toFile(destino);
  }
  return `/media/vitrina/${slug}/${nombre}`;
}

/** Al terminar: las imágenes que quedaron en el documento se copian de los bancos (que no se suben a git) a la carpeta de la vitrina. */
export async function publicarEnVitrina(doc: LandingDoc, slug: string, dirMedia: string, protegidas: ReadonlySet<string> = new Set()): Promise<LandingDoc> {
  const assets: Asset[] = [];
  for (const a of doc.assets) {
    assets.push(a.ruta?.startsWith("/media/bancos/") ? { ...a, ruta: await copiarAVitrina(a.ruta, slug, dirMedia) } : a);
  }
  const final = { ...doc, assets };
  limpiarVitrina(final, slug, dirMedia, protegidas);
  return final;
}

/** Aplica las elecciones a `assets[]`: ruta, fuente, crédito, licencia y banco. Un slot sin asset se crea con su prompt de Grok. */
export function aplicarElecciones(assets: Asset[], elecciones: Eleccion[], crearVacio: (slot: string, relacion: Asset["relacion"]) => Asset): Asset[] {
  const porSlot = new Map(assets.map((a) => [a.slot, a]));
  for (const e of elecciones) {
    const previo = porSlot.get(e.slot) ?? crearVacio(e.slot, relacionDe(e.medio.orientacion));
    porSlot.set(e.slot, {
      ...previo,
      tipo: "imagen",
      relacion: relacionDe(e.medio.orientacion),
      ruta: e.medio.ruta,
      alt: e.medio.titulo,
      fuente: e.medio.fuente,
      credito: e.medio.credito,
      licencia: e.medio.licencia,
      ...(e.medio.urlOrigen ? { urlOrigen: e.medio.urlOrigen } : {}),
      bancoId: e.medio.bancoId,
    });
  }
  // Conserva el orden original y agrega los nuevos al final.
  const orden = [...assets.map((a) => a.slot), ...elecciones.map((e) => e.slot).filter((s) => !assets.some((a) => a.slot === s))];
  return [...new Set(orden)].map((s) => porSlot.get(s)!);
}

/**
 * Héroe según los medios. Espacial: la imagen del banco a sangre, o sin imagen si no hay. De producto: la foto que muestra el
 * producto (`fuerte`, 2 o más coincidencias) en `producto-monumental`; una foto de ambiente, a sangre; o sin imagen si no hay.
 */
export function ajustarHeroe(doc: LandingDoc, entrada: EntradaVitrina, fuerte = false): LandingDoc {
  const i = doc.secciones.findIndex((s) => s.tipo === "heroe");
  if (i === -1) return doc;
  const heroe = doc.secciones[i];
  const slot = typeof heroe.ajustes.slot === "string" ? heroe.ajustes.slot : undefined;
  const asset = slot ? doc.assets.find((a) => a.slot === slot) : undefined;
  const real = Boolean(asset?.ruta);
  const variante = !real ? HEROE_SIN_IMAGEN : entrada.tematica === "espacio" ? HEROE_ESPACIAL : fuerte ? HEROE_PRODUCTO : HEROE_ESPACIAL;
  const ajustes = { ...heroe.ajustes };
  if (variante === HEROE_SIN_IMAGEN) delete ajustes.slot;
  const nuevo: Seccion = { ...heroe, variante, ajustes };
  return { ...doc, secciones: doc.secciones.map((s, k) => (k === i ? nuevo : s)) };
}

/** Borra de la carpeta de la landing los archivos que el documento ya no usa. */
export function limpiarVitrina(doc: LandingDoc, slug: string, dirMedia: string, protegidas: ReadonlySet<string> = new Set()): number {
  const dir = join(dirMedia, "vitrina", slug);
  if (!existsSync(dir)) return 0;
  const usados = new Set(doc.assets.map((a) => a.ruta?.split("/").pop()).filter(Boolean));
  let borrados = 0;
  for (const f of readdirSync(dir)) {
    // Una imagen que otra landing (o una versión guardada de esta) todavía usa no se toca.
    if (!usados.has(f) && !protegidas.has(`/media/vitrina/${slug}/${f}`)) {
      rmSync(join(dir, f), { force: true });
      borrados++;
    }
  }
  return borrados;
}

/** Peso de toda la carpeta de la vitrina, en bytes. */
export function pesoVitrina(dirMedia: string): number {
  const raiz = join(dirMedia, "vitrina");
  if (!existsSync(raiz)) return 0;
  let total = 0;
  const recorrer = (d: string) => {
    for (const f of readdirSync(d, { withFileTypes: true })) {
      const ruta = join(d, f.name);
      if (f.isDirectory()) recorrer(ruta);
      else total += statSync(ruta).size;
    }
  };
  recorrer(raiz);
  return total;
}

const recortar = (t: string, max: number) => (t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`);

/**
 * Los pies de foto de la galería describen lo que la imagen del banco muestra (su título), no el producto:
 * la IA escribió los pies antes de saber qué imagen le tocaba a cada lugar.
 */
export function ponerPiesDeGaleria(doc: LandingDoc, elecciones: Eleccion[]): LandingDoc {
  const porSlot = new Map(elecciones.map((e) => [e.slot, e.medio]));
  return {
    ...doc,
    secciones: doc.secciones.map((s) => {
      if (s.tipo !== "galeria") return s;
      return {
        ...s,
        bloques: s.bloques.map((b) => {
          const medio = typeof b.ajustes.slot === "string" ? porSlot.get(b.ajustes.slot) : undefined;
          return medio ? { ...b, ajustes: { ...b.ajustes, pie: recortar(medio.titulo, 100) } } : b;
        }),
      };
    }),
  };
}
