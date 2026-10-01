import "../ayudas-db";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { beforeEach, describe, expect, it } from "vitest";
import type { ZodType } from "zod";
import { GET as buscarGET } from "@/app/api/medios/buscar/route";
import { db } from "@/lib/db";
import type { DefinicionBanco } from "@/lib/bancos/definicion";
import { cifrasFieles, frasesValidas, hechosDeLanzamientos, hechosDeNeoWs, oracionesConDatos, type Hecho } from "@/lib/bancos/curiosos";
import { completarDescripciones, intercalar, llenarBanco, nombreArchivo } from "@/lib/bancos/llenar";
import { medirImagen, optimizarImagen, orientacionDe } from "@/lib/bancos/procesar";
import { buscarMedios, guardarMedio } from "@/lib/bancos/repositorio";
import { crearFuentes } from "@/lib/fuentes/registro";
import type { DepsEnrutador } from "@/lib/ia/enrutador";
import type { ProveedorIA } from "@/lib/ia/tipos";

const BANCO: DefinicionBanco = { id: "bt", nombre: "Banco de prueba", tematica: "espacio", fuentes: ["nasa-images"], consultas: ["moon"], excluir: ["logo"], anchoMinimo: 1600 };

const imagen = (ancho: number, alto: number, color = "#204080") => sharp({ create: { width: ancho, height: alto, channels: 3, background: color } }).jpeg().toBuffer();

const ficha = (id: string, titulo: string, descripcion = "The Moon photographed from orbit.") => ({
  data: [{ nasa_id: id, title: titulo, description: descripcion, center: "JSC", media_type: "image" }],
  links: [],
});

/** NASA falsa: 5 fichas (una con logo, una con copyright de terceros) y `/asset` con las 3 versiones. */
function fetchNasa() {
  return (async (url: string | URL | Request) => {
    const u = String(url);
    if (u.includes("/search")) {
      return new Response(
        JSON.stringify({
          collection: {
            items: [
              ficha("luna-1", "Full Moon"),
              ficha("luna-2", "Moon crater"),
              ficha("luna-logo", "Moon mission logo"),
              ficha("luna-tercero", "Moon at night", "Image copyright Getty Images"),
              ficha("luna-chica", "Small moon"),
              ficha("luna-3", "Earthrise"),
            ],
          },
        }),
      );
    }
    const id = /\/asset\/([^/?]+)/.exec(u)?.[1] ?? "x";
    return new Response(JSON.stringify({ collection: { items: [{ href: `http://images-assets.nasa.gov/image/${id}/${id}~orig.jpg` }, { href: `http://images-assets.nasa.gov/image/${id}/${id}~large.jpg` }] } }));
  }) as typeof fetch;
}

const descargarFalso = async (_f: string, url: string) => (url.includes("luna-chica") ? imagen(900, 600) : imagen(2400, 1400));

/** Proveedor de IA de mentira: describe cada `[id]` que recibe, o falla si se le pide. */
function iaFalsa(falla = false): { deps: DepsEnrutador; llamadas: number[] } {
  const llamadas: number[] = [];
  const proveedor: ProveedorIA = {
    id: "groq",
    disponible: () => true,
    async generarJSON<T>(p: { usuario: string; esquema: ZodType<T> }) {
      const ids = [...p.usuario.matchAll(/^\[([^\]]+)\]/gm)].map((m) => m[1]);
      llamadas.push(ids.length);
      if (falla) throw new Error("cuota agotada");
      const datos = { medios: ids.map((id) => ({ id, titulo: `Imagen ${id.slice(-4)}`, descripcion: "La Luna vista desde la órbita terrestre.", etiquetas: ["luna", "espacio", "noche", "gris", "órbita"] })) };
      return { datos: p.esquema.parse(datos), proveedor: "groq" as const, modelo: "sim", ms: 1 };
    },
  };
  return { deps: { proveedores: [proveedor], registrarUso: async () => {}, tablaTareas: {}, config: {}, espera: async () => {} }, llamadas };
}

let dirMedia = "";
beforeEach(async () => {
  dirMedia = mkdtempSync(join(tmpdir(), "bancos-test-"));
  await db.medioBanco.deleteMany({});
});

const correr = (n: number, extra: Partial<Parameters<typeof llenarBanco>[1]> = {}) =>
  llenarBanco(BANCO, { fuentes: crearFuentes({ fetchFn: fetchNasa(), esperaReintentoMs: 0 }), opcionesFuente: { fetchFn: fetchNasa() }, almacen: memoria(), dirMedia, n, descargarArchivo: descargarFalso, depsIA: iaFalsa().deps, ...extra });

import { almacenMemoria } from "@/lib/fuentes/cache";
const memoria = () => almacenMemoria();

describe("llenarBanco", () => {
  it("descarga, optimiza a WebP y guarda el registro con crédito, licencia, orientación y colores", async () => {
    const r = await correr(3);
    expect(r).toMatchObject({ banco: "bt", guardados: 3, sinDescribir: 0 });
    const filas = await db.medioBanco.findMany({ where: { bancoId: "bt" }, orderBy: { idFuente: "asc" } });
    expect(filas.map((f) => f.idFuente).sort()).toEqual(["luna-1", "luna-2", "luna-3"]);
    for (const f of filas) {
      expect(f.ruta).toMatch(/^\/media\/bancos\/bt\/.+\.webp$/);
      expect(existsSync(join(dirMedia, "bancos", "bt", f.ruta.split("/").pop()!))).toBe(true);
      expect(f.credito).toBe("NASA/JSC");
      expect(f.licencia).toBe("dominio-publico-nasa");
      expect(f.usoComercial).toBe(true);
      expect(f.orientacion).toBe("horizontal");
      expect(Math.max(f.ancho, f.alto)).toBeLessThanOrEqual(1920);
      expect(JSON.parse(f.coloresDominantes).length).toBeGreaterThan(0);
      expect(JSON.parse(f.etiquetas)).toHaveLength(5);
      expect(f.descripcion).toContain("Luna");
      expect(f.descripcionOrigen).toContain("Moon");
    }
  });

  it("descarta el logo, la ficha con derechos de terceros y la imagen que no llega al ancho mínimo", async () => {
    const r = await correr(10);
    const ids = (await db.medioBanco.findMany()).map((f) => f.idFuente).sort();
    expect(ids).toEqual(["luna-1", "luna-2", "luna-3"]);
    expect(r.descartados).toBe(3); // logo + terceros + chica
  });

  it("es idempotente: la segunda corrida no vuelve a bajar nada", async () => {
    await correr(3);
    let bajadas = 0;
    const r = await correr(3, { descargarArchivo: async (f, u) => (bajadas++, descargarFalso(f, u)) });
    expect(bajadas).toBe(0);
    expect(r).toMatchObject({ guardados: 0, yaEstaban: 3 });
    expect(await db.medioBanco.count()).toBe(3);
  });

  it("si la IA no responde deja los medios pendientes y --solo-ia los completa después", async () => {
    const r = await correr(2, { depsIA: iaFalsa(true).deps });
    expect(r).toMatchObject({ guardados: 2, sinDescribir: 2 });
    expect(await db.medioBanco.count({ where: { etiquetas: "[]" } })).toBe(2);
    const { deps, llamadas } = iaFalsa();
    const c = await completarDescripciones(undefined, { depsIA: deps });
    expect(c).toEqual({ hechos: 2, pendientes: 0 });
    expect(llamadas).toEqual([2]);
    expect(await db.medioBanco.count({ where: { etiquetas: "[]" } })).toBe(0);
  });

  it("pide la IA de a lotes de 6", async () => {
    const { deps, llamadas } = iaFalsa();
    // 8 fichas válidas
    const fetchOcho = (async (url: string | URL | Request) =>
      String(url).includes("/search")
        ? new Response(JSON.stringify({ collection: { items: Array.from({ length: 8 }, (_, i) => ficha(`m-${i}`, `Moon ${i}`)) } }))
        : fetchNasa()(url)) as typeof fetch;
    await llenarBanco(BANCO, { fuentes: crearFuentes({ fetchFn: fetchOcho }), opcionesFuente: { fetchFn: fetchOcho }, almacen: memoria(), dirMedia, n: 8, descargarArchivo: descargarFalso, depsIA: deps });
    expect(llamadas).toEqual([6, 2]);
  });

  it("como mucho la cuarta parte del banco puede ser vertical", async () => {
    const r = await correr(4, { descargarArchivo: async () => imagen(1700, 2400) });
    const verticales = await db.medioBanco.count({ where: { orientacion: "vertical" } });
    expect(verticales).toBeLessThanOrEqual(1);
    expect(r.guardados).toBeLessThanOrEqual(1);
  });
});

describe("filtro de licencias y búsqueda", () => {
  const base = { tipo: "imagen" as const, fuente: "nasa-images" as const, ruta: "/media/bancos/bt/x.webp", ancho: 1920, alto: 1080, coloresDominantes: ["#000000"], descripcion: "d", credito: "NASA", licencia: "dominio-publico-nasa" as const };

  it("un medio con usoComercial falso nunca se ofrece", async () => {
    await guardarMedio({ ...base, bancoId: "bt", idFuente: "a", orientacion: "horizontal", titulo: "Luna llena", etiquetas: ["luna"], usoComercial: true });
    await guardarMedio({ ...base, bancoId: "bt", idFuente: "b", orientacion: "horizontal", titulo: "Luna con derechos", etiquetas: ["luna"], usoComercial: false });
    await guardarMedio({ ...base, bancoId: "bt2", idFuente: "c", orientacion: "vertical", titulo: "Auroras verticales", etiquetas: ["aurora", "cielo"], usoComercial: true });
    expect((await buscarMedios({ q: "luna" })).map((m) => m.idFuente)).toEqual(["a"]);
    expect((await buscarMedios({ banco: "bt" })).map((m) => m.idFuente)).toEqual(["a"]);
    expect((await buscarMedios({ orientacion: "vertical" })).map((m) => m.idFuente)).toEqual(["c"]);
    expect((await buscarMedios({ q: "Órbita" })).length).toBe(0);
    expect((await buscarMedios({ q: "AURORA cielo" })).map((m) => m.idFuente)).toEqual(["c"]);
  });

  it("GET /api/medios/buscar filtra por banco, q y orientación y valida los parámetros", async () => {
    await guardarMedio({ ...base, bancoId: "b3", idFuente: "l1", orientacion: "horizontal", titulo: "Luna llena", etiquetas: ["luna"], usoComercial: true });
    await guardarMedio({ ...base, bancoId: "b3", idFuente: "l2", orientacion: "horizontal", titulo: "Cráter", etiquetas: ["luna"], usoComercial: false });
    const r = await buscarGET(new Request("http://x/api/medios/buscar?banco=b3&q=luna&orientacion=horizontal"));
    expect(r.status).toBe(200);
    const { medios } = await r.json();
    expect(medios).toHaveLength(1);
    expect(medios[0]).toMatchObject({ bancoId: "b3", idFuente: "l1", credito: "NASA", licencia: "dominio-publico-nasa", usoComercial: true });
    expect((await buscarGET(new Request("http://x/api/medios/buscar?orientacion=diagonal"))).status).toBe(400);
  });
});

describe("procesar imágenes", () => {
  it("optimiza a WebP de 1920 px como máximo y calcula la orientación", async () => {
    const img = await optimizarImagen(await imagen(4000, 2000));
    expect(img.ancho).toBe(1920);
    expect(img.alto).toBe(960);
    expect(img.orientacion).toBe("horizontal");
    expect((await sharp(img.webp).metadata()).format).toBe("webp");
    expect(img.coloresDominantes.length).toBeGreaterThan(0);
    expect(await medirImagen(await imagen(300, 500))).toEqual({ ancho: 300, alto: 500 });
    expect(orientacionDe(1000, 1000)).toBe("cuadrada");
    expect(orientacionDe(600, 1000)).toBe("vertical");
  });

  it("no agranda una imagen más chica que el máximo", async () => {
    const img = await optimizarImagen(await imagen(800, 600));
    expect([img.ancho, img.alto]).toEqual([800, 600]);
  });
});

describe("descripciones en español", () => {
  it("detecta un texto que la IA dejó en inglés", async () => {
    const { pareceIngles } = await import("@/lib/bancos/enriquecer");
    expect(pareceIngles("Earthrise captured by Orion")).toBe(true);
    expect(pareceIngles("La Luna vista desde la órbita terrestre.")).toBe(false);
    expect(pareceIngles("Salida de la Tierra sobre el horizonte lunar")).toBe(false);
  });

  it("un medio cuyo título quedó en inglés se deja pendiente", async () => {
    const proveedor: ProveedorIA = {
      id: "groq",
      disponible: () => true,
      async generarJSON<T>(p: { esquema: ZodType<T> }) {
        return { datos: p.esquema.parse({ medios: [{ id: "x1", titulo: "Earthrise captured by Orion", descripcion: "La Tierra sale sobre el borde de la Luna.", etiquetas: ["luna", "tierra", "orion"] }] }), proveedor: "groq" as const, modelo: "sim", ms: 1 };
      },
    };
    const { describirMedios } = await import("@/lib/bancos/enriquecer");
    const r = await describirMedios([{ id: "x1", titulo: "t", texto: "x", banco: "b3", tema: "La Luna" }], { proveedores: [proveedor], registrarUso: async () => {}, tablaTareas: {}, config: {}, espera: async () => {} });
    expect(r.size).toBe(0);
  });
});

describe("ayudas de llenado", () => {
  it("intercala los resultados de cada consulta", () => {
    expect(intercalar([["a1", "a2", "a3"], ["b1"], ["c1", "c2"]])).toEqual(["a1", "b1", "c1", "a2", "c2", "a3"]);
    expect(intercalar([])).toEqual([]);
  });

  it("el nombre de archivo es seguro", () => {
    expect(nombreArchivo("File:2024 Szczoteczka do zębów Oral-B (1).jpg")).toBe("2024-szczoteczka-do-zebow-oral-b-1");
    expect(nombreArchivo("iss023e058455")).toBe("iss023e058455");
    expect(nombreArchivo("???")).toBe("medio");
  });
});

describe("datos curiosos (b8)", () => {
  const hecho: Hecho = { id: "b1-x-1", texto: "The galaxy is about 2.5 million light-years away from Earth.", tema: "b1", fuente: { nombre: "NASA · Andrómeda" } };

  it("de una ficha de NASA toma solo las oraciones con datos, no el pie de foto", () => {
    const ficha = "ISS023-E-058455 (29 May 2010) --- Aurora Australis is featured in this image. The galaxy sits about 2.5 million light-years from Earth and holds a trillion stars. Photo by Someone. Click here for more.";
    const r = oracionesConDatos(ficha);
    expect(r).toEqual(["The galaxy sits about 2.5 million light-years from Earth and holds a trillion stars."]);
  });

  it("descarta la frase que trae una cifra que el dato no tiene", () => {
    expect(cifrasFieles("¿Sabías que la galaxia está a unos 2,5 millones de años luz de la Tierra?", hecho.texto)).toBe(true);
    expect(cifrasFieles("¿Sabías que la galaxia está a unos 4 millones de años luz?", hecho.texto)).toBe(false);
  });

  it("frasesValidas exige el formato, la fidelidad de las cifras y la lista negra en cero", () => {
    const ok = "¿Sabías que la galaxia queda a unos 2,5 millones de años luz de la Tierra?";
    const r = frasesValidas(
      {
        frases: [
          { hecho: hecho.id, frase: ok },
          { hecho: hecho.id, frase: "¿Sabías que se repite el mismo hecho con otra frase de 2,5 millones de años luz?" }, // segundo del mismo hecho
          { hecho: "no-existe", frase: ok },
        ],
      },
      [hecho],
    );
    expect(r.map((x) => x.frase)).toEqual([ok]);
    const malas = frasesValidas(
      {
        frases: [
          { hecho: hecho.id, frase: "La galaxia queda a unos 2,5 millones de años luz de la Tierra." }, // sin «¿Sabías que»
        ],
      },
      [hecho],
    );
    expect(malas).toEqual([]);
    expect(frasesValidas({ frases: [{ hecho: hecho.id, frase: "¿Sabías que esta galaxia increíble queda a 9 millones de años luz de aquí?" }] }, [hecho])).toEqual([]);
  });

  it("los datos de NeoWs y de lanzamientos llevan su fuente y fecha", () => {
    const neo = hechosDeNeoWs({ fecha: "2026-09-30", cantidad: 1, asteroides: [{ nombre: "2020 XY", distanciaKm: 62349989, diametroMaxM: 392.68, velocidadKmh: 5660, peligroso: false, fechaAcercamiento: "" }] }, new Date("2026-09-30T00:00:00Z"));
    expect(neo[0].texto).toContain("2026-09-30");
    expect(neo[0].texto).toContain("62,349,989 km");
    expect(neo[0].fuente.nombre).toContain("NeoWs");
    const ll = hechosDeLanzamientos([{ id: "1", nombre: "F9 | Crew-13", mision: "Crew-13", cohete: "Falcon 9 Block 5", proveedor: "SpaceX", lugar: "Cape Canaveral", fecha: "2026-10-01T15:10:06Z", estado: "Go", descripcion: null }]);
    expect(ll[0].texto).toContain("2026-10-01");
    expect(ll[0].fuente.nombre).toContain("Launch Library");
  });
});
