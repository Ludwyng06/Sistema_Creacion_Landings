import "../ayudas-db"; // primero: base SQLite aislada
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { EJEMPLOS } from "@/datos/ejemplos";
import { LandingDoc } from "@/lib/contratos";
import { db } from "@/lib/db";
import type { DepsEnrutador } from "@/lib/ia/enrutador";
import { ErrorIA, type RegistradorUso } from "@/lib/ia/tipos";
import { obtenerLanding, obtenerPorSlug } from "@/lib/landings";
import { enlazarRecursos, forzarHeroe, sembrar } from "../../scripts/semilla-db";
import { crearProveedores, docBase, manejadorBase } from "../construccion/ayudas";

const registrarUso: RegistradorUso = async () => {};
const carpetas: string[] = [];

function enrutador(): DepsEnrutador {
  const { proveedores } = crearProveedores(["gemini", "groq"], manejadorBase({ landing: () => docBase() }));
  return { proveedores, registrarUso, modo: "simultaneo", tablaTareas: {} };
}

async function carpetaTemporal(): Promise<string> {
  const d = await mkdtemp(join(tmpdir(), "semilla-"));
  carpetas.push(d);
  return d;
}

const sinMedia = () => carpetaTemporal();
const conteo = () => db.landing.count();

beforeEach(async () => {
  await db.landing.deleteMany();
});

afterAll(async () => {
  for (const c of carpetas) await rm(c, { recursive: true, force: true, maxRetries: 3 }).catch(() => {});
});

describe("db:semilla con proveedores simulados", () => {
  it("crea las 5 landings en el banco; la segunda corrida crea 0; --forzar las rehace", async () => {
    const mediaRaiz = await sinMedia();
    const lineas: string[] = [];
    const uno = await sembrar({ enrutador: enrutador(), mediaRaiz, log: (l) => lineas.push(l) });
    expect(uno.sinClaves).toBe(false);
    expect(uno.filas.map((f) => f.estado)).toEqual(Array(5).fill("creada"));
    expect(uno.filas.map((f) => f.id)).toEqual(EJEMPLOS.map((e) => e.id));
    expect(await conteo()).toBe(5);
    for (const f of uno.filas) {
      expect(f.banco).toBe(true);
      expect(f.proveedor).toBe("gemini");
      expect(f.salud!.rojo).toBe(0);
      expect(f.puntaje).toBe(9);
    }
    const l = await obtenerPorSlug("colageno");
    expect(l).toMatchObject({ estado: "en-banco", tecnicas: ["semilla", "ambicioso", "negativas", "humana"] });
    expect(l!.promptBloques.rol).toContain("Eres");
    expect(l!.doc.meta.slug).toBe("colageno");

    const dos = await sembrar({ enrutador: enrutador(), mediaRaiz });
    expect(dos.filas.map((f) => f.estado)).toEqual(Array(5).fill("omitida"));
    expect(await conteo()).toBe(5);

    const antes = (await obtenerPorSlug("colageno"))!.id;
    const tres = await sembrar({ enrutador: enrutador(), mediaRaiz, forzar: true });
    expect(tres.filas.map((f) => f.estado)).toEqual(Array(5).fill("creada"));
    expect(await conteo()).toBe(5);
    expect((await obtenerPorSlug("colageno"))!.id).not.toBe(antes);
  });

  it("--forzar con un proveedor que falla NO borra la landing previa; con uno que funciona la reemplaza", async () => {
    const mediaRaiz = await sinMedia();
    await sembrar({ enrutador: enrutador(), mediaRaiz, solo: "colageno" });
    const previa = (await obtenerPorSlug("colageno"))!;

    // La IA falla (cuota agotada): la landing anterior sigue igual y la fila queda en error.
    const { proveedores } = crearProveedores(
      ["gemini", "groq"],
      manejadorBase({
        landing: () => {
          throw new ErrorIA("limite", "sin cuota");
        },
      }),
    );
    const fallida = await sembrar({
      enrutador: { proveedores, registrarUso, modo: "simultaneo", tablaTareas: {} },
      mediaRaiz,
      solo: "colageno",
      forzar: true,
      log: () => {},
    });
    expect(fallida.filas[0].estado).toBe("error");
    expect(fallida.filas[0].detalle).toContain("cascada");
    expect(await conteo()).toBe(1);
    const intacta = (await obtenerPorSlug("colageno"))!;
    expect(intacta.id).toBe(previa.id);
    expect(intacta.doc).toEqual(previa.doc);
    expect(intacta.estado).toBe("en-banco");

    // La IA responde: entonces sí se reemplaza.
    const ok = await sembrar({ enrutador: enrutador(), mediaRaiz, solo: "colageno", forzar: true });
    expect(ok.filas[0].estado).toBe("creada");
    expect(await conteo()).toBe(1);
    expect((await obtenerPorSlug("colageno"))!.id).not.toBe(previa.id);
  });

  it("--solo procesa un solo ejemplo y rechaza un id desconocido", async () => {
    const r = await sembrar({ enrutador: enrutador(), mediaRaiz: await sinMedia(), solo: "timbre-camara" });
    expect(r.filas.map((f) => f.id)).toEqual(["timbre-camara"]);
    expect(await conteo()).toBe(1);
    await expect(sembrar({ enrutador: enrutador(), solo: "nada" })).rejects.toThrow(/No existe el ejemplo/);
  });

  it("fuerza la variante de héroe del ejemplo y anota el cambio", async () => {
    const r = await sembrar({ enrutador: enrutador(), mediaRaiz: await sinMedia() });
    const fila = (id: string) => r.filas.find((f) => f.id === id)!;
    expect(fila("corrector-postura").heroeCorregido).toBeUndefined(); // la IA ya eligió problema-primero
    expect(fila("colageno").heroeCorregido).toBe("problema-primero → producto-monumental");
    expect(fila("cepillo-9en1").heroeCorregido).toBe("problema-primero → titular-tipografico");
    for (const e of EJEMPLOS) {
      const l = await obtenerPorSlug(e.id);
      expect(l!.doc.secciones.find((s) => s.tipo === "heroe")!.variante).toBe(e.varianteHeroe);
    }
  });

  it("forzarHeroe cambia solo el héroe y no toca el documento original", () => {
    const doc = docBase();
    const { doc: nuevo, cambio } = forzarHeroe(doc, "video-inmersivo");
    expect(cambio).toBe("problema-primero");
    expect(nuevo.secciones[0].variante).toBe("video-inmersivo");
    expect(doc.secciones[0].variante).toBe("problema-primero");
    expect(forzarHeroe(doc, "problema-primero")).toEqual({ doc });
  });

  it("enlaza los recursos de public/media/ejemplos/<id>/ (prefiere .webp; el video usa su .mp4)", async () => {
    const media = await carpetaTemporal();
    const carpeta = join(media, "ejemplos", "corrector-postura");
    await mkdir(carpeta, { recursive: true });
    await writeFile(join(carpeta, "oferta-producto.png"), "x");
    await writeFile(join(carpeta, "oferta-producto.webp"), "x");
    await writeFile(join(carpeta, "clip.mp4"), "x");
    await writeFile(join(carpeta, "clip-poster.webp"), "x");
    await writeFile(join(carpeta, "solo-poster-poster.webp"), "x");

    const doc = docBase();
    doc.assets.push(
      { slot: "clip", tipo: "video", relacion: "16:9", promptGrok: "p", alt: "a" },
      { slot: "solo-poster", tipo: "video", relacion: "16:9", promptGrok: "p", alt: "a" },
      { slot: "no-existe", tipo: "imagen", relacion: "1:1", promptGrok: "p", alt: "a" },
    );
    const { doc: enlazado, enlazados } = enlazarRecursos(doc, EJEMPLOS[0], media);
    expect(enlazados).toBe(3);
    expect(enlazado.assets.map((a) => a.ruta)).toEqual([
      "/media/ejemplos/corrector-postura/oferta-producto.webp",
      "/media/ejemplos/corrector-postura/clip.mp4",
      "/media/ejemplos/corrector-postura/solo-poster-poster.webp", // sin .mp4, usa el póster
      undefined,
    ]);

    const r = await sembrar({ enrutador: enrutador(), mediaRaiz: media, solo: "corrector-postura" });
    expect(r.filas[0].recursos).toBe(1);
    const guardada = await obtenerPorSlug("corrector-postura");
    expect(guardada!.doc.assets[0].ruta).toBe("/media/ejemplos/corrector-postura/oferta-producto.webp");
  });
});

describe("db:semilla sin claves de IA", () => {
  it("no falla: explica qué falta, ofrece --desde-json y no crea nada", async () => {
    const lineas: string[] = [];
    const r = await sembrar({ enrutador: { proveedores: [], registrarUso }, log: (l) => lineas.push(l) });
    expect(r).toEqual({ filas: [], sinClaves: true });
    expect(await conteo()).toBe(0);
    const salida = lineas.join("\n");
    expect(salida).toContain("No hay claves de IA");
    expect(salida).toContain("GEMINI_API_KEY");
    expect(salida).toContain("--desde-json");
    expect(salida).toContain("datos/semilla-manual");
  });

  it("con el entorno vacío también detecta que faltan claves", async () => {
    const r = await sembrar({ enrutador: { env: {}, registrarUso }, log: () => {} });
    expect(r.sinClaves).toBe(true);
  });
});

describe("db:semilla --desde-json", () => {
  it("carga un LandingDoc válido, rechaza uno inválido con un mensaje legible y avisa de los que faltan", async () => {
    const carpeta = await carpetaTemporal();
    await writeFile(join(carpeta, "corrector-postura.json"), `Aquí está:\n\`\`\`json\n${JSON.stringify(docBase())}\n\`\`\``);
    const invalido = docBase() as unknown as Record<string, unknown>;
    invalido.tokens = { colores: {} };
    await writeFile(join(carpeta, "colageno.json"), JSON.stringify(invalido));
    await writeFile(join(carpeta, "cepillo-9en1.json"), "esto no es json");

    const r = await sembrar({ enrutador: { proveedores: [], registrarUso }, desdeJson: carpeta, mediaRaiz: await sinMedia(), log: () => {} });
    expect(r.sinClaves).toBe(false); // con --desde-json no hacen falta claves
    const por = Object.fromEntries(r.filas.map((f) => [f.id, f]));
    expect(por["corrector-postura"]).toMatchObject({ estado: "creada", proveedor: "manual", banco: true });
    expect(por.colageno.estado).toBe("error");
    expect(por.colageno.detalle).toContain("no es un LandingDoc válido");
    expect(por.colageno.detalle).toContain("tokens");
    expect(por["cepillo-9en1"]).toMatchObject({ estado: "error", detalle: expect.stringContaining("JSON") });
    expect(por["timbre-camara"].estado).toBe("sin-archivo");
    expect(por["llavero-3en1"].estado).toBe("sin-archivo");
    expect(await conteo()).toBe(1);
    const guardada = await obtenerPorSlug("corrector-postura");
    expect(guardada!.proveedor).toBe("manual");
    expect(() => LandingDoc.parse(guardada!.doc)).not.toThrow();
    expect((await obtenerLanding(guardada!.id)).doc.meta.slug).toBe("corrector-postura");
  });

  it("es idempotente y --forzar solo reemplaza si el archivo nuevo es válido", async () => {
    const carpeta = await carpetaTemporal();
    const ruta = join(carpeta, "corrector-postura.json");
    await writeFile(ruta, JSON.stringify(docBase()));
    const opciones = { enrutador: { proveedores: [], registrarUso }, desdeJson: carpeta, solo: "corrector-postura", mediaRaiz: await sinMedia(), log: () => {} };
    expect((await sembrar(opciones)).filas[0].estado).toBe("creada");
    expect((await sembrar(opciones)).filas[0].estado).toBe("omitida");
    const id = (await obtenerPorSlug("corrector-postura"))!.id;

    await writeFile(ruta, "{}");
    expect((await sembrar({ ...opciones, forzar: true })).filas[0].estado).toBe("error");
    expect((await obtenerPorSlug("corrector-postura"))!.id).toBe(id); // la anterior sigue ahí

    await writeFile(ruta, JSON.stringify(docBase()));
    expect((await sembrar({ ...opciones, forzar: true })).filas[0].estado).toBe("creada");
    expect((await obtenerPorSlug("corrector-postura"))!.id).not.toBe(id);
    expect(await conteo()).toBe(1);
  });
});
