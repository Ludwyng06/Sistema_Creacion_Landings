import "../ayudas-db";
import { existsSync, mkdirSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { VITRINA } from "@/datos/vitrina";
import { type LandingDoc as Doc, type Asset, type DatoCurioso, type MedioBanco, type Seccion } from "@/lib/contratos";
import { almacenMemoria } from "@/lib/fuentes/cache";
import { crearFuentes } from "@/lib/fuentes/registro";
import { registro } from "@/secciones/registro";
import { briefConPreguntas, elegirDatoCurioso } from "@/lib/vitrina/construir";
import { investigarEntrada } from "@/lib/vitrina/investigar";
import { ajustarHeroe, aplicarElecciones, coincidencias, elegirMedios, luminosidad, ponerPiesDeGaleria, publicarEnVitrina, slotsDelDoc } from "@/lib/vitrina/medios";
import { agregarSeccionesDelSistema, filasFicha, seccionCreditos, seccionCtaFija, seccionDatoCurioso, seccionDatoEnVivo, seccionFicha, seccionSellos, textoPlan, tiposDeLaIA, tiposDelSistema, widgetDeVariante } from "@/lib/vitrina/plan";
import { docBase } from "../construccion/ayudas";

/** Un documento como el que entregaría la IA: héroe con `slot`, galería de 4 imágenes y `incluye` con su imagen. */
function docVitrina(): Doc {
  const doc = docBase();
  const heroe = doc.secciones.findIndex((s) => s.tipo === "heroe");
  doc.secciones[heroe].ajustes.slot = "heroe-fondo";
  const ancla = doc.secciones.findIndex((s) => s.tipo === "oferta");
  const galeria: Seccion = {
    id: "galeria",
    tipo: "galeria",
    visible: true,
    intencion: { objetivo: "Mostrar el producto de cerca" },
    ajustes: { titulo: "Míralo de cerca", disposicion: "mosaico" },
    bloques: [1, 2, 3, 4].map((n) => ({ id: `gal-${n}`, tipo: "imagen", ajustes: { slot: `galeria-${n}` } })),
  };
  const incluye: Seccion = {
    id: "incluye",
    tipo: "incluye",
    visible: true,
    intencion: { objetivo: "Mostrar lo que viene en la caja" },
    ajustes: { titulo: "Qué viene en la caja", texto: "Todo para empezar.", imagen: "incluye-empaque" },
    bloques: [{ id: "it-1", tipo: "item", ajustes: { texto: "El producto" } }],
  };
  doc.secciones.splice(ancla, 0, galeria, incluye);
  doc.assets = [];
  return doc;
}

const entrada = (slug: string) => VITRINA.find((e) => e.slug === slug)!;
const PROYECTOR = entrada("proyector-galaxias-auroras");
const CEPILLO = entrada("cepillo-dental-electrico-vitrina");

const medio = (id: string, banco: string, extra: Partial<MedioBanco> = {}): MedioBanco => ({
  id,
  bancoId: banco,
  tipo: "imagen",
  fuente: "nasa-images",
  idFuente: id,
  ruta: `/media/bancos/${banco}/${id}.webp`,
  ancho: 1920,
  alto: 1080,
  orientacion: "horizontal",
  coloresDominantes: ["#0a0a1a", "#4488aa"],
  titulo: `Imagen ${id}`,
  descripcion: "Una imagen del banco",
  etiquetas: [],
  credito: "NASA/JPL",
  licencia: "dominio-publico-nasa",
  usoComercial: true,
  ...extra,
});

describe("la vitrina de datos", () => {
  it("son 8 briefs: 4 espaciales y 4 de producto, con slug único y bancos que existen", () => {
    expect(VITRINA).toHaveLength(8);
    expect(VITRINA.filter((e) => e.tematica === "espacio")).toHaveLength(4);
    expect(new Set(VITRINA.map((e) => e.slug)).size).toBe(8);
    for (const e of VITRINA) {
      expect(e.brief.precio.valor).toBeGreaterThan(0);
      expect(e.brief.pruebaSocial).toBeUndefined(); // sin testimonios ni calificaciones inventadas
      expect(filasFicha(e).length).toBeGreaterThanOrEqual(4);
      expect(filasFicha(e).length).toBeLessThanOrEqual(12);
      // como mucho la mitad de las filas queda por completar: el vendedor da lo que sabe y el resto es [COMPLETAR]
      expect(filasFicha(e).filter((f) => f.valor === "[COMPLETAR]").length).toBeLessThanOrEqual(Math.floor(filasFicha(e).length / 2));
      expect(e.tecnicas).not.toContain("sustractivo"); // la vitrina pide de 12 a 16 secciones
      if (e.tematica === "espacio") expect(e.widget).toBeDefined();
      else expect(e.widget).toBeUndefined();
    }
  });

  it("las cifras de la ficha son [COMPLETAR] o texto: el vendedor no dio números inventados", () => {
    for (const e of VITRINA) for (const f of e.ficha.filter((x) => !["Tipo", "Uso"].includes(x.nombre))) expect(/\d/.test(f.valor), `${e.slug} · ${f.nombre}`).toBe(false);
  });
});

describe("plan de secciones", () => {
  it("espaciales: 10 de la IA y 6 del sistema = 16; de producto: 11 y 4 = 15", () => {
    expect(tiposDeLaIA(PROYECTOR)).toHaveLength(10);
    expect(tiposDelSistema(PROYECTOR)).toHaveLength(6);
    expect(tiposDeLaIA(CEPILLO)).toHaveLength(11);
    expect(tiposDelSistema(CEPILLO)).toHaveLength(4);
    expect(tiposDeLaIA(PROYECTOR)).not.toContain("testimonios");
  });

  it("el texto del plan da el orden, los slots y las reglas de fidelidad", () => {
    const t = textoPlan(PROYECTOR);
    expect(t).toContain("`heroe`");
    expect(t).toContain("heroe-fondo");
    expect(t).toContain("galeria-1");
    expect(t).toContain("nunca partido");
    expect(t).toContain("sin testimonios");
    expect(textoPlan(CEPILLO)).toContain("como-funciona");
    expect(textoPlan(CEPILLO)).not.toContain("NASA");
  });

  it("agrega las secciones del sistema en orden, deja el héroe primero y descarta las que no son del plan", () => {
    const doc = docBase();
    const conTestimonios = { ...doc, secciones: [...doc.secciones, { ...doc.secciones[1], id: "extra", tipo: "testimonios" as const }] };
    const dato: DatoCurioso = { id: "b8-01", frase: "¿Sabías que las auroras se forman cuando electrones caen sobre la atmósfera superior?", tema: "b5", fuente: { nombre: "NASA · Aurora", url: "https://images.nasa.gov/details/x" } };
    const r = agregarSeccionesDelSistema(conTestimonios, { entrada: PROYECTOR, dato, hayCreditos: true });
    const tipos = r.secciones.map((s) => s.tipo);
    expect(tipos[0]).toBe("heroe");
    expect(tipos).not.toContain("testimonios");
    expect(tipos.at(-2)).toBe("creditos");
    expect(tipos.at(-1)).toBe("cta-fija");
    expect(tipos.indexOf("sellos-confianza")).toBeLessThan(tipos.indexOf("dato-en-vivo"));
    expect(tipos.indexOf("dato-en-vivo")).toBeLessThan(tipos.indexOf("dato-curioso"));
    expect(tipos.indexOf("dato-curioso")).toBeLessThan(tipos.indexOf("ficha-tecnica"));
    expect(tipos.indexOf("ficha-tecnica")).toBeLessThan(tipos.indexOf("formulario-lead"));
    for (const t of new Set(tipos)) expect(tipos.filter((x) => x === t), t).toHaveLength(1);
    // idempotente
    expect(agregarSeccionesDelSistema(r, { entrada: PROYECTOR, dato, hayCreditos: true }).secciones.map((s) => s.tipo)).toEqual(tipos);
  });

  it("sin créditos no hay sección de créditos, y de producto no hay secciones espaciales", () => {
    const r = agregarSeccionesDelSistema(docBase(), { entrada: CEPILLO, dato: null, hayCreditos: false });
    const tipos = r.secciones.map((s) => s.tipo);
    expect(tipos).not.toContain("creditos");
    expect(tipos).not.toContain("dato-en-vivo");
    expect(tipos).not.toContain("dato-curioso");
    expect(tipos).toContain("ficha-tecnica");
    expect(tipos).toContain("cta-fija");
  });

  it("las secciones del sistema cumplen los límites de los esquemas (y su esquema real cuando está registrado)", () => {
    const secciones: Seccion[] = [seccionSellos(PROYECTOR), seccionDatoEnVivo(PROYECTOR)!, seccionDatoCurioso({ id: "b8-01", frase: "¿Sabías que las auroras se forman cuando electrones caen sobre la atmósfera superior?", tema: "b5", fuente: { nombre: "NASA", url: "https://images.nasa.gov/x" } })!, seccionFicha(PROYECTOR), seccionCreditos(), seccionCtaFija(PROYECTOR)];
    const sellos = secciones[0];
    expect(sellos.bloques.length).toBeGreaterThanOrEqual(3);
    expect(sellos.bloques.length).toBeLessThanOrEqual(5);
    for (const b of sellos.bloques) {
      expect(String(b.ajustes.titulo).length).toBeLessThanOrEqual(32);
      expect(String(b.ajustes.texto).length).toBeLessThanOrEqual(90);
      expect(b.ajustes.icono).toMatch(/^[a-z-]+$/);
    }
    const ficha = secciones[3];
    expect(ficha.bloques.length).toBeGreaterThanOrEqual(4);
    for (const b of ficha.bloques) {
      expect(String(b.ajustes.nombre).length).toBeLessThanOrEqual(40);
      expect(String(b.ajustes.valor).length).toBeLessThanOrEqual(60);
      expect(String(b.ajustes.unidad ?? "").length).toBeLessThanOrEqual(12);
    }
    const dato = secciones[2];
    expect(String(dato.ajustes.fuenteUrl)).toMatch(/^https?:\/\//);
    expect(String(dato.ajustes.fuenteNombre).length).toBeLessThanOrEqual(60);
    expect(String(secciones[5].ajustes.texto).length).toBeLessThanOrEqual(40);
    // Con el esquema real de la 12-B (cuando el registro lo tiene) todas validan.
    for (const s of secciones) {
      const def = registro[s.tipo];
      if (def) expect(def.schema.safeParse({ ajustes: s.ajustes, bloques: s.bloques }).success, s.tipo).toBe(true);
    }
  });

  it("de las 8 entradas salen fichas y sellos que caben en los límites", () => {
    for (const e of VITRINA) {
      const f = seccionFicha(e);
      expect(f.bloques.length).toBeGreaterThanOrEqual(4);
      expect(seccionSellos(e).bloques.length).toBeGreaterThanOrEqual(3);
      expect(String(seccionCtaFija(e).ajustes.texto).length).toBeLessThanOrEqual(40);
    }
  });

  it("el widget de lanzamiento se llama «lanzamiento» en el contrato", () => {
    expect(widgetDeVariante("cuenta-regresiva-lanzamiento")).toBe("lanzamiento");
    expect(widgetDeVariante("auroras")).toBe("auroras");
  });
});

describe("asignación de medios", () => {
  it("lee los slots de las secciones con su rol", () => {
    const slots = slotsDelDoc(docVitrina());
    expect(slots).toEqual([
      { slot: "heroe-fondo", rol: "heroe" },
      { slot: "galeria-1", rol: "galeria" },
      { slot: "galeria-2", rol: "galeria" },
      { slot: "galeria-3", rol: "galeria" },
      { slot: "galeria-4", rol: "galeria" },
      { slot: "incluye-empaque", rol: "incluye" },
    ]);
  });

  it("el héroe espacial elige un fondo horizontal y oscuro; cada slot recibe un medio distinto", () => {
    const candidatos = [
      medio("claro", "b1", { coloresDominantes: ["#f0f0f0"], titulo: "Galaxia clara" }),
      medio("vertical", "b1", { orientacion: "vertical", ancho: 1080, alto: 1920, titulo: "Galaxia vertical" }),
      medio("oscura", "b1", { coloresDominantes: ["#02030a", "#5eead4"], titulo: "Nebulosa de galaxia" }),
      medio("aurora", "b5", { titulo: "Aurora en la noche", etiquetas: ["aurora", "noche"] }),
    ];
    const pedidos = [{ slot: "heroe-fondo", rol: "heroe" as const }, { slot: "galeria-1", rol: "galeria" as const }, { slot: "galeria-2", rol: "galeria" as const }];
    const r = elegirMedios(pedidos, candidatos, { entrada: PROYECTOR, acento: "#5eead4" });
    expect(r.find((x) => x.slot === "heroe-fondo")!.medio.id).toBe("oscura");
    expect(new Set(r.map((x) => x.medio.id)).size).toBe(r.length);
    expect(r).toHaveLength(3);
  });

  it("el héroe de un producto solo lleva foto si muestra ese producto (2 coincidencias o más)", () => {
    const ruido = [medio("auto", "p-bienestar", { fuente: "wikimedia", titulo: "Un automóvil naranja", etiquetas: ["auto"] })];
    const bueno = medio("cepillo", "p-bienestar", { fuente: "wikimedia", titulo: "Cepillo dental eléctrico", descripcion: "Un cepillo eléctrico sobre fondo blanco", etiquetas: ["cepillo", "dental"] });
    const pedidos = [{ slot: "heroe-fondo", rol: "heroe" as const }];
    expect(elegirMedios(pedidos, ruido, { entrada: CEPILLO, acento: "#0891b2" })).toEqual([]);
    expect(elegirMedios(pedidos, [...ruido, bueno], { entrada: CEPILLO, acento: "#0891b2" }).map((x) => x.medio.id)).toEqual(["cepillo"]);
    expect(coincidencias(bueno, CEPILLO.claves)).toBeGreaterThanOrEqual(2);
  });

  it("«Qué viene en la caja» solo lleva una foto de producto, nunca una nebulosa", () => {
    const pedidos = [{ slot: "incluye-empaque", rol: "incluye" as const }];
    const espacio = [medio("nebulosa", "b1", { titulo: "Nebulosa de galaxia" })];
    expect(elegirMedios(pedidos, espacio, { entrada: PROYECTOR, acento: "#5eead4" })).toEqual([]);
    const producto = medio("proyector", "p-hogar", { fuente: "wikimedia", titulo: "Proyector de estrellas para el cuarto", etiquetas: ["proyector", "planetarium"] });
    expect(elegirMedios(pedidos, [...espacio, producto], { entrada: PROYECTOR, acento: "#5eead4" }).map((x) => x.medio.id)).toEqual(["proyector"]);
  });

  it("las fotos de los bancos de producto sin ninguna coincidencia no entran ni en las espaciales", () => {
    const ruido = medio("cuarto", "p-hogar", { fuente: "wikimedia", titulo: "Sala de un edificio", etiquetas: ["sala"] });
    expect(elegirMedios([{ slot: "galeria-1", rol: "galeria" as const }], [ruido], { entrada: PROYECTOR, acento: "#5eead4" })).toEqual([]);
  });

  it("el héroe de producto con una sola coincidencia queda como foto de ambiente (a sangre); con dos, es el producto", () => {
    const doc = docVitrina();
    const heroe0 = doc.secciones.findIndex((s) => s.tipo === "heroe");
    doc.assets = [{ slot: "heroe-fondo", tipo: "imagen", relacion: "16:9", promptGrok: "p", alt: "a", ruta: "/media/bancos/p-bienestar/x.webp" }];
    expect(ajustarHeroe(doc, CEPILLO, false).secciones[heroe0].variante).toBe("poster-a-sangre");
    expect(ajustarHeroe(doc, CEPILLO, true).secciones[heroe0].variante).toBe("producto-monumental");
  });

  it("los pies de la galería son el título de la imagen del banco, no lo que la IA escribió del producto", () => {
    const doc = docVitrina();
    const elecciones = [{ slot: "galeria-1", medio: medio("carina", "b1", { titulo: "Acantilados cósmicos en la Nebulosa de Carina" }), coincidencias: 1 }];
    const galeria = ponerPiesDeGaleria(doc, elecciones).secciones.find((s) => s.tipo === "galeria")!;
    expect(galeria.bloques[0].ajustes.pie).toBe("Acantilados cósmicos en la Nebulosa de Carina");
    expect(galeria.bloques[1].ajustes.pie).toBeUndefined(); // sin imagen elegida no se toca
  });

  it("aplicar las elecciones copia crédito, licencia y banco al Asset y conserva su prompt de Grok", () => {
    const base: Asset[] = [{ slot: "heroe-fondo", tipo: "imagen", relacion: "1:1", promptGrok: "Prompt de Grok", alt: "x" }];
    const m = medio("nebulosa", "b1", { credito: "NASA, ESA y CSA", licencia: "cc-by-4.0", urlOrigen: "https://images.nasa.gov/details/nebulosa" });
    const r = aplicarElecciones(base, [{ slot: "heroe-fondo", medio: m, coincidencias: 0 }, { slot: "galeria-1", medio: m, coincidencias: 0 }], (slot, relacion) => ({ slot, tipo: "imagen", relacion, promptGrok: "Nuevo", alt: slot }));
    expect(r.map((a) => a.slot)).toEqual(["heroe-fondo", "galeria-1"]);
    expect(r[0]).toMatchObject({ ruta: m.ruta, credito: "NASA, ESA y CSA", licencia: "cc-by-4.0", fuente: "nasa-images", bancoId: "b1", relacion: "16:9", promptGrok: "Prompt de Grok", urlOrigen: m.urlOrigen });
  });

  it("ajustarHeroe: espacial con imagen usa poster-a-sangre; sin imagen queda sin marcador (problema-primero)", () => {
    const doc = docVitrina();
    const slot = "heroe-fondo";
    const heroe0 = doc.secciones.findIndex((s) => s.tipo === "heroe");
    const conImagen = { ...doc, assets: [{ slot, tipo: "imagen" as const, relacion: "16:9" as const, promptGrok: "p", alt: "a", ruta: "/media/bancos/b1/x.webp" }] };
    expect(ajustarHeroe(conImagen, PROYECTOR).secciones[heroe0].variante).toBe("poster-a-sangre");
    expect(ajustarHeroe(conImagen, CEPILLO, true).secciones[heroe0].variante).toBe("producto-monumental");
    const sinImagen = { ...doc, assets: [{ slot, tipo: "imagen" as const, relacion: "16:9" as const, promptGrok: "p", alt: "a" }] };
    const s = ajustarHeroe(sinImagen, PROYECTOR).secciones[heroe0];
    expect(s.variante).toBe("problema-primero");
    expect(s.ajustes.slot).toBeUndefined();
  });

  it("publicar en la vitrina copia las imágenes usadas a 1600 px y borra las que ya no se usan", async () => {
    const dirMedia = mkdtempSync(join(tmpdir(), "vitrina-test-"));
    mkdirSync(join(dirMedia, "bancos", "b1"), { recursive: true });
    await sharp({ create: { width: 2400, height: 1200, channels: 3, background: "#123456" } }).webp().toFile(join(dirMedia, "bancos", "b1", "a.webp"));
    mkdirSync(join(dirMedia, "vitrina", "mi-slug"), { recursive: true });
    await sharp({ create: { width: 10, height: 10, channels: 3, background: "#000000" } }).webp().toFile(join(dirMedia, "vitrina", "mi-slug", "vieja.webp"));
    const doc = docBase();
    doc.assets = [{ slot: "s", tipo: "imagen", relacion: "16:9", promptGrok: "p", alt: "a", ruta: "/media/bancos/b1/a.webp" }];
    const r = await publicarEnVitrina(doc, "mi-slug", dirMedia);
    expect(r.assets[0].ruta).toBe("/media/vitrina/mi-slug/a.webp");
    const meta = await sharp(join(dirMedia, "vitrina", "mi-slug", "a.webp")).metadata();
    expect(meta.width).toBe(1600);
    expect(readdirSync(join(dirMedia, "vitrina", "mi-slug"))).toEqual(["a.webp"]);
    expect(existsSync(join(dirMedia, "bancos", "b1", "a.webp"))).toBe(true);
  });

  it("luminosidad: el negro es 0 y el blanco es 1", () => {
    expect(luminosidad("#000000")).toBeCloseTo(0, 3);
    expect(luminosidad("#ffffff")).toBeCloseTo(1, 3);
  });
});

describe("contexto de la construcción", () => {
  it("las preguntas reales se suman a las objeciones sin repetir y con tope", () => {
    const b = briefConPreguntas(PROYECTOR.brief, ["¿Se ve bien con la luz encendida?", "¿Cuánto consume de energía?", "¿Sirve en techos altos?", "¿Se puede regalar?", "¿Trae pilas?"]);
    expect(b.objeciones).toContain("¿Cuánto consume de energía?");
    expect(b.objeciones.filter((o) => o.includes("luz encendida"))).toHaveLength(1);
    expect(b.objeciones.length).toBeLessThanOrEqual(7);
  });

  it("la frase curiosa es la primera de sus temas que ninguna otra landing usó", () => {
    const datos: DatoCurioso[] = [
      { id: "b8-01", frase: "¿Sabías que uno?", tema: "b1", fuente: { nombre: "N" } },
      { id: "b8-02", frase: "¿Sabías que dos?", tema: "b5", fuente: { nombre: "N" } },
      { id: "b8-03", frase: "¿Sabías que tres?", tema: "b1", fuente: { nombre: "N" } },
    ];
    const usadas = new Set<string>(["b8-01"]);
    expect(elegirDatoCurioso(PROYECTOR, datos, usadas)?.id).toBe("b8-03");
    expect(elegirDatoCurioso(CEPILLO, datos, usadas)).toBeNull();
  });
});

describe("investigar", () => {
  it("anota cada fuente y sigue si una falla o está apagada", async () => {
    const fetchFn = (async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes("noaa-planetary")) return new Response(JSON.stringify([{ time_tag: "2026-09-30T00:00:00", Kp: 2.33 }]));
      return new Response("no", { status: 404 });
    }) as typeof fetch;
    const fuentes = crearFuentes({ fetchFn, esperaReintentoMs: 0, env: {} });
    const r = await investigarEntrada(PROYECTOR, { fuentes, ejecucion: { almacen: almacenMemoria() } });
    expect(r.fuentes.map((f) => f.fuente)).toEqual(["nasa-images", "noaa-kp", "serpapi"]);
    expect(r.fuentes.filter((f) => f.fuente !== "serpapi").every((f) => f.estado === "ok")).toBe(true);
    expect(r.fuentes.find((f) => f.fuente === "serpapi")).toMatchObject({ estado: "omitida" }); // sin SERPAPI_API_KEY
    expect(r.widget).toEqual({ variante: "auroras", responde: true });
    const sin = await investigarEntrada(CEPILLO, { fuentes, ejecucion: { almacen: almacenMemoria() } });
    expect(sin.fuentes.find((f) => f.fuente === "serpapi")).toMatchObject({ estado: "omitida" });
  });

  it("de producto trae precios de referencia y preguntas reales de SerpAPI", async () => {
    const fetchFn = (async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes("google_shopping")) return new Response(JSON.stringify({ shopping_results: [{ title: "Cepillo X", price: "$99.900", extracted_price: 99900, source: "Tienda" }] }));
      if (u.includes("engine=google")) return new Response(JSON.stringify({ related_questions: [{ question: "¿Vale la pena un cepillo eléctrico?" }, { question: "no es pregunta" }] }));
      return new Response("no", { status: 404 });
    }) as typeof fetch;
    const fuentes = crearFuentes({ fetchFn, esperaReintentoMs: 0, env: { SERPAPI_API_KEY: "k" } });
    const r = await investigarEntrada(CEPILLO, { fuentes, ejecucion: { almacen: almacenMemoria() } });
    expect(r.preciosReferencia).toEqual([{ titulo: "Cepillo X", precio: 99900, tienda: "Tienda" }]);
    expect(r.preguntas).toEqual(["¿Vale la pena un cepillo eléctrico?"]);
    // el precio de referencia nunca reemplaza al del vendedor
    expect(CEPILLO.brief.precio.valor).toBe(79900);
  });
});
