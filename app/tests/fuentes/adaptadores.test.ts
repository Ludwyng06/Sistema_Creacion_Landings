import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { almacenMemoria, claveCache } from "@/lib/fuentes/cache";
import { consultarConCache, consultarSuave } from "@/lib/fuentes/ejecutar";
import { crearApod, normalizarApod } from "@/lib/fuentes/apod";
import { crearIss } from "@/lib/fuentes/iss";
import { crearLanzamientos, normalizarLanzamientos } from "@/lib/fuentes/lanzamientos";
import { crearNasaImagenes, creditoNasa, resolverImagenNasa } from "@/lib/fuentes/nasa-imagenes";
import { crearNeoWs } from "@/lib/fuentes/neows";
import { crearNoaaKp, nivelDeKp } from "@/lib/fuentes/noaa-kp";
import { crearOpenBeautyFacts, crearOpenFoodFacts } from "@/lib/fuentes/open-facts";
import { crearOpenverse, licenciaOpenverse } from "@/lib/fuentes/openverse";
import { crearPexels, normalizarPexels } from "@/lib/fuentes/pexels";
import { crearPixabay } from "@/lib/fuentes/pixabay";
import { crearSerpApiShopping } from "@/lib/fuentes/serpapi-shopping";
import { ErrorFuente } from "@/lib/fuentes/tipos";
import { crearUsnoLuna } from "@/lib/fuentes/usno-luna";
import { crearWikimedia, licenciaPermitida } from "@/lib/fuentes/wikimedia";

const DIR = join(__dirname, "fixtures", "api");
const fixture = (n: string): unknown => JSON.parse(readFileSync(join(DIR, n), "utf8"));

/** `fetch` falso: responde con el JSON grabado que corresponde a la URL y anota cada llamada. */
function fetchGrabado(rutas: [RegExp, unknown][]) {
  const llamadas: string[] = [];
  const fetchFn = (async (url: string | URL | Request) => {
    const u = String(url);
    llamadas.push(u);
    const hallada = rutas.find(([re]) => re.test(u));
    if (!hallada) return new Response("no hay fixture", { status: 404 });
    return new Response(JSON.stringify(hallada[1]), { status: 200 });
  }) as typeof fetch;
  return { fetchFn, llamadas };
}

const SIN_ESPERA = { esperaReintentoMs: 0 };

describe("nasa-imagenes", () => {
  it("normaliza la búsqueda: solo imágenes, con crédito y enlace de origen", async () => {
    const { fetchFn, llamadas } = fetchGrabado([[/images-api\.nasa\.gov\/search/, fixture("nasa-search.json")]]);
    const r = await crearNasaImagenes({ fetchFn }).consultar({ q: "aurora from ISS", max: 5 });
    expect(r.length).toBeGreaterThan(0);
    expect(llamadas[0]).toContain("media_type=image");
    for (const i of r) {
      expect(i.nasaId).toBeTruthy();
      expect(i.credito).toMatch(/NASA/);
      expect(i.urlOrigen).toContain("images.nasa.gov/details/");
    }
  });

  it("el crédito sale de photographer, secondary_creator o center", () => {
    expect(creditoNasa({ photographer: "Chris Hadfield", center: "JSC" })).toBe("Chris Hadfield / NASA JSC");
    expect(creditoNasa({ secondary_creator: "ESA/Hubble", center: "GSFC" })).toBe("ESA/Hubble / NASA GSFC");
    expect(creditoNasa({ photographer: "ISRO/NASA/JPL-Caltech/Brown Univ.", center: "JPL" })).toBe("ISRO/NASA/JPL-Caltech/Brown Univ.");
    expect(creditoNasa({ center: "JPL" })).toBe("NASA/JPL");
    expect(creditoNasa({})).toBe("NASA");
  });

  it("resuelve la imagen grande con /asset y prefiere el JPEG original", async () => {
    const { fetchFn } = fetchGrabado([[/\/asset\//, fixture("nasa-asset.json")]]);
    const url = await resolverImagenNasa("iss023e058455", { fetchFn });
    expect(url).toBe("https://images-assets.nasa.gov/image/iss023e058455/iss023e058455~orig.jpg");
  });

  it("una ficha con derechos de terceros no se ofrece para uso comercial", async () => {
    const json = {
      collection: {
        items: [{ data: [{ nasa_id: "x1", title: "Foto", description: "Image copyright Getty Images", center: "HQ", media_type: "image" }], links: [] }],
      },
    };
    const { fetchFn } = fetchGrabado([[/search/, json]]);
    const [foto] = await crearNasaImagenes({ fetchFn }).consultar({ q: "x" });
    expect(foto.usoComercial).toBe(false);
  });
});

describe("apod", () => {
  it("si el servicio de NASA no responde (504), la fuente degrada sin romper el resto", async () => {
    const fetchFn = (async () => new Response("Gateway Timeout", { status: 504 })) as typeof fetch;
    const f = crearApod({ env: { NASA_API_KEY: "k" }, fetchFn, esperaReintentoMs: 0 });
    expect(await consultarSuave(f, { cantidad: 5 }, { almacen: almacenMemoria() })).toBeNull();
  });

  it("sin NASA_API_KEY está deshabilitada (con DEMO_KEY agota el tiempo)", () => {
    expect(crearApod({ env: {} }).habilitada()).toBe(false);
    expect(crearApod({ env: { NASA_API_KEY: "DEMO_KEY" } }).habilitada()).toBe(true);
    expect(crearApod({ env: { NASA_API_KEY: "abc" } }).habilitada()).toBe(true);
  });

  it("excluye las que traen copyright de terceros y los videos", () => {
    const r = normalizarApod([
      { date: "2026-09-01", title: "Libre", explanation: "e", url: "https://apod.nasa.gov/a.jpg", hdurl: "https://apod.nasa.gov/a_hd.jpg", media_type: "image" },
      { date: "2026-09-02", title: "De un fotógrafo", explanation: "e", url: "https://apod.nasa.gov/b.jpg", media_type: "image", copyright: "Juan Pérez" },
      { date: "2026-09-03", title: "Video", explanation: "e", url: "https://youtube.com/x", media_type: "video" },
    ]);
    expect(r.map((x) => x.titulo)).toEqual(["Libre"]);
    expect(r[0].credito).toContain("Astronomy Picture of the Day");
  });

  it("la clave no aparece en el mensaje de error", async () => {
    const fetchFn = (async () => new Response("bad key SECRETA123", { status: 400 })) as typeof fetch;
    const f = crearApod({ env: { NASA_API_KEY: "SECRETA123" }, fetchFn });
    await expect(f.consultar({})).rejects.toSatisfy((e: Error) => !e.message.includes("SECRETA123"));
  });
});

describe("neows", () => {
  it("ordena por cercanía y trae distancia, diámetro y velocidad", async () => {
    const { fetchFn, llamadas } = fetchGrabado([[/neo\/rest\/v1\/feed/, fixture("neows.json")]]);
    const r = await crearNeoWs({ fetchFn, env: {} }).consultar({ fecha: "2026-09-30" });
    expect(llamadas[0]).toContain("api_key=DEMO_KEY");
    expect(r.cantidad).toBe(5);
    expect(r.asteroides.length).toBeGreaterThan(0);
    for (let i = 1; i < r.asteroides.length; i++) expect(r.asteroides[i].distanciaKm).toBeGreaterThanOrEqual(r.asteroides[i - 1].distanciaKm);
    expect(r.asteroides[0].diametroMaxM).toBeGreaterThan(0);
  });

  it("usa NASA_API_KEY cuando existe", async () => {
    const { fetchFn, llamadas } = fetchGrabado([[/feed/, fixture("neows.json")]]);
    await crearNeoWs({ fetchFn, env: { NASA_API_KEY: "mi-clave" } }).consultar({ fecha: "2026-09-30" });
    expect(llamadas[0]).toContain("api_key=mi-clave");
  });
});

describe("noaa-kp, usno-luna e iss", () => {
  it("noaa-kp toma el último índice y lo clasifica", async () => {
    const { fetchFn } = fetchGrabado([[/noaa-planetary-k-index/, fixture("noaa-kp.json")]]);
    const r = await crearNoaaKp({ fetchFn }).consultar({});
    expect(r.kp).toBeGreaterThanOrEqual(0);
    expect(r.medidoEn).toMatch(/Z$/);
    expect(["baja", "moderada", "alta", "muy-alta"]).toContain(r.nivel);
  });

  it("los niveles de Kp: 6 es alta como en el ejemplo del v2", () => {
    expect([0, 3.67, 4, 5, 6, 7, 9].map(nivelDeKp)).toEqual(["baja", "baja", "moderada", "alta", "alta", "muy-alta", "muy-alta"]);
  });

  it("usno-luna entrega la fase en español, el porcentaje y la próxima luna llena", async () => {
    const { fetchFn, llamadas } = fetchGrabado([
      [/rstt\/oneday/, fixture("usno-dia.json")],
      [/moon\/phases\/date/, fixture("usno-fases.json")],
    ]);
    const r = await crearUsnoLuna({ fetchFn }).consultar({ fecha: "2026-09-30" });
    expect(r).toEqual({ fase: "Gibosa menguante", iluminacion: 81, proximaLlena: "2026-10-26" });
    expect(llamadas[0]).toContain("date=2026-9-30");
  });

  it("usno-luna sigue funcionando si falla la lista de fases", async () => {
    const fetchFn = (async (url: string | URL | Request) =>
      String(url).includes("oneday") ? new Response(JSON.stringify(fixture("usno-dia.json"))) : new Response("x", { status: 500 })) as typeof fetch;
    const r = await crearUsnoLuna({ fetchFn, ...SIN_ESPERA }).consultar({ fecha: "2026-09-30" });
    expect(r.fase).toBe("Gibosa menguante");
    expect(r.proximaLlena).toBeNull();
    // una respuesta incompleta se guarda solo 5 minutos
    const f = crearUsnoLuna({ fetchFn, ...SIN_ESPERA });
    expect(f.ttlDe?.(r)).toBe(300);
    expect(f.ttlDe?.({ ...r, proximaLlena: "2026-10-26" })).toBe(6 * 3600);
  });

  it("iss normaliza latitud, longitud, altitud y velocidad", async () => {
    const { fetchFn } = fetchGrabado([[/wheretheiss\.at/, fixture("iss.json")]]);
    const r = await crearIss({ fetchFn }).consultar({});
    expect(r.latitud).toBeCloseTo(44.457, 2);
    expect(r.altitudKm).toBeGreaterThan(300);
    expect(r.medidoEn).toBe(new Date(1790778714 * 1000).toISOString());
  });
});

describe("lanzamientos", () => {
  it("normaliza misión, cohete, proveedor y lugar; solo los que aún no ocurrieron", async () => {
    const { fetchFn, llamadas } = fetchGrabado([[/launches\/upcoming/, fixture("lanzamientos.json")]]);
    const f = crearLanzamientos({ fetchFn });
    const r = normalizarLanzamientos(fixture("lanzamientos.json"), new Date("2026-09-30T12:00:00Z"));
    expect(r[0]).toMatchObject({ mision: "Crew-13", cohete: "Falcon 9 Block 5", proveedor: "SpaceX", lugar: "Cape Canaveral SFS, FL, USA", fecha: "2026-10-01T15:10:06Z" });
    expect(normalizarLanzamientos(fixture("lanzamientos.json"), new Date("2026-10-01T16:00:00Z")).map((l) => l.mision)).not.toContain("Crew-13");
    await f.consultar({ max: 3 });
    expect(llamadas[0]).toContain("/2.3.0/launches/upcoming/");
  });
});

describe("open-food-facts y open-beauty-facts", () => {
  it("open-food-facts trae ingredientes, nutrición por 100 g y crédito a los colaboradores", async () => {
    const { fetchFn } = fetchGrabado([[/openfoodfacts\.org\/cgi\/search/, fixture("open-food-facts.json")]]);
    const r = await crearOpenFoodFacts({ fetchFn }).consultar({ q: "collagen" });
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].ingredientes).toContain("Collagen");
    expect(r[0].nutricion.energiaKcal).toBe(400);
    expect(r[0].credito).toMatch(/colaboradores/);
    expect(r[0].urlOrigen).toContain("world.openfoodfacts.org/product/");
  });

  it("open-beauty-facts usa su propio dominio", async () => {
    const { fetchFn, llamadas } = fetchGrabado([[/openbeautyfacts\.org/, fixture("open-beauty-facts.json")]]);
    const r = await crearOpenBeautyFacts({ fetchFn }).consultar({ q: "vitamin c serum" });
    expect(llamadas[0]).toContain("world.openbeautyfacts.org");
    expect(r.map((x) => x.nombre)).toContain("Vitamin C serum");
  });
});

describe("wikimedia", () => {
  it("descarta las licencias que no son CC0, CC BY ni CC BY-SA", () => {
    expect(licenciaPermitida("CC BY-SA 4.0")).toBe("cc-by-sa");
    expect(licenciaPermitida("CC BY 2.0")).toBe("cc-by");
    expect(licenciaPermitida("CC BY 4.0")).toBe("cc-by-4.0");
    expect(licenciaPermitida("CC0")).toBe("cc0");
    expect(licenciaPermitida("Public domain")).toBe("cc0");
    expect(licenciaPermitida("CC BY-NC 4.0")).toBeNull();
    expect(licenciaPermitida("CC BY-ND 2.0")).toBeNull();
    expect(licenciaPermitida("All rights reserved")).toBeNull();
    expect(licenciaPermitida("")).toBeNull();
  });

  it("normaliza autor, licencia y crédito desde extmetadata", async () => {
    const { fetchFn } = fetchGrabado([[/commons\.wikimedia\.org\/w\/api\.php/, fixture("wikimedia.json")]]);
    const r = await crearWikimedia({ fetchFn }).consultar({ q: "electric toothbrush" });
    expect(r.length).toBe(3);
    const pro2 = r.find((x) => x.titulo.includes("Pro 2"))!;
    expect(pro2.licencia).toBe("cc-by");
    expect(pro2.credito).toMatch(/electricteeth · CC BY 2\.0 · Wikimedia Commons/);
    expect(r.filter((x) => x.licencia === "cc-by-sa")).toHaveLength(2);
    expect(r[0].url).toMatch(/^https:\/\/upload\.wikimedia\.org|^https:\/\/thumb\.wikimedia\.org/);
  });
});

describe("pexels", () => {
  it("sin PEXELS_API_KEY se omite sin error", async () => {
    const f = crearPexels({ env: {} });
    expect(f.habilitada()).toBe(false);
    expect(await consultarConCache(f, { q: "night sky" }, { almacen: almacenMemoria() })).toBeNull();
  });

  it("con clave la envía en el encabezado Authorization y normaliza", async () => {
    let auth: string | null = null;
    const fetchFn = (async (_u: string | URL | Request, init?: RequestInit) => {
      auth = new Headers(init?.headers).get("Authorization");
      return new Response(JSON.stringify({ photos: [{ id: 7, width: 4000, height: 3000, url: "https://www.pexels.com/photo/7/", photographer: "Ana Ruiz", avg_color: "#112233", alt: "cielo", src: { large2x: "https://images.pexels.com/7.jpeg" } }] }));
    }) as typeof fetch;
    const r = await crearPexels({ env: { PEXELS_API_KEY: "k1" }, fetchFn }).consultar({ q: "night sky" });
    expect(auth).toBe("k1");
    expect(r[0]).toMatchObject({ idFuente: "7", credito: "Ana Ruiz · Pexels", colorPromedio: "#112233" });
    expect(normalizarPexels({ photos: [{ id: 1 }] })).toEqual([]);
  });
});

describe("openverse", () => {
  it("sin clave, solo con licencias CC0, CC BY y CC BY-SA: descarta ND y NC", async () => {
    const { fetchFn, llamadas } = fetchGrabado([[/api\.openverse\.org\/v1\/images/, fixture("openverse.json")]]);
    const f = crearOpenverse({ fetchFn });
    expect(f.habilitada()).toBe(true);
    const r = await f.consultar({ q: "electric toothbrush", max: 10 });
    expect(llamadas[0]).toContain("license_type=commercial%2Cmodification");
    expect(r).toHaveLength(5);
    expect(r.map((x) => x.licencia)).toEqual(["cc-by", "cc-by", "cc-by-sa", "cc-by", "cc-by-sa"]);
    expect(r[0]).toMatchObject({ autor: "wwarby", licenciaTexto: "CC BY 2.0", origen: "flickr" });
    expect(r[0].credito).toBe("wwarby · CC BY 2.0 · Openverse/flickr");
    expect(r[0].urlOrigen).toContain("flickr.com/photos");
  });

  it("acepta la licencia CC BY 4.0 con su etiqueta y rechaza las demás", () => {
    expect(licenciaOpenverse("by", "4.0")).toBe("cc-by-4.0");
    expect(licenciaOpenverse("by", "2.0")).toBe("cc-by");
    expect(licenciaOpenverse("cc0")).toBe("cc0");
    expect(licenciaOpenverse("pdm")).toBe("cc0");
    for (const l of ["by-nd", "by-nc", "by-nc-sa", "by-nc-nd", "sampling+", ""]) expect(licenciaOpenverse(l), l).toBeNull();
  });
});

describe("pixabay", () => {
  const cuerpo = { hits: [{ id: 195893, pageURL: "https://pixabay.com/photos/blossom-195893/", tags: "blossom, bloom, flower", user: "Josch13", imageWidth: 4000, imageHeight: 3000, largeImageURL: "https://pixabay.com/get/x_1280.jpg" }, { id: 1 }] };

  it("sin PIXABAY_API_KEY se omite sin error", async () => {
    const f = crearPixabay({ env: {} });
    expect(f.habilitada()).toBe(false);
    expect(await consultarConCache(f, { q: "x" }, { almacen: almacenMemoria() })).toBeNull();
  });

  it("con clave normaliza autor y etiquetas; la clave no aparece en los errores", async () => {
    const { fetchFn, llamadas } = fetchGrabado([[/pixabay\.com\/api\//, cuerpo]]);
    const r = await crearPixabay({ env: { PIXABAY_API_KEY: "SECRETA9" }, fetchFn }).consultar({ q: "flower", orientacion: "horizontal" });
    expect(llamadas[0]).toContain("orientation=horizontal");
    expect(r).toEqual([{ idFuente: "195893", titulo: "blossom, bloom, flower", url: "https://pixabay.com/get/x_1280.jpg", ancho: 4000, alto: 3000, autor: "Josch13", credito: "Josch13 · Pixabay", etiquetas: ["blossom", "bloom", "flower"], urlOrigen: "https://pixabay.com/photos/blossom-195893/" }]);
    const malo = (async () => new Response("bad SECRETA9", { status: 400 })) as typeof fetch;
    await expect(crearPixabay({ env: { PIXABAY_API_KEY: "SECRETA9" }, fetchFn: malo }).consultar({ q: "x" })).rejects.toSatisfy((e: Error) => !e.message.includes("SECRETA9"));
  });
});

describe("serpapi-shopping", () => {
  it("sin SERPAPI_API_KEY está deshabilitada", () => {
    expect(crearSerpApiShopping({ env: {} }).habilitada()).toBe(false);
  });

  it("normaliza precios de referencia y descarta filas sin precio", async () => {
    const cuerpo = { shopping_results: [{ title: "Cepillo eléctrico", price: "$89.900", extracted_price: 89900, source: "Tienda X", link: "https://x.co/1" }, { title: "Sin precio" }] };
    const { fetchFn, llamadas } = fetchGrabado([[/engine=google_shopping/, cuerpo]]);
    const r = await crearSerpApiShopping({ env: { SERPAPI_API_KEY: "sk" }, fetchFn }).consultar({ q: "cepillo dental electrico" });
    expect(r).toEqual([{ titulo: "Cepillo eléctrico", precio: 89900, precioTexto: "$89.900", tienda: "Tienda X", enlace: "https://x.co/1", miniatura: null }]);
    expect(llamadas[0]).toContain("gl=co");
  });
});

describe("reintento y tope de tiempo", () => {
  it("reintenta una vez si responde 429 y devuelve la segunda respuesta", async () => {
    let n = 0;
    const fetchFn = (async () => (++n === 1 ? new Response("", { status: 429 }) : new Response(JSON.stringify(fixture("iss.json"))))) as typeof fetch;
    const r = await crearIss({ fetchFn, ...SIN_ESPERA }).consultar({});
    expect(n).toBe(2);
    expect(r.latitud).toBeDefined();
  });

  it("si el 5xx se repite falla con ErrorFuente y no reintenta más", async () => {
    let n = 0;
    const fetchFn = (async () => (++n, new Response("caído", { status: 503 }))) as typeof fetch;
    await expect(crearIss({ fetchFn, ...SIN_ESPERA }).consultar({})).rejects.toBeInstanceOf(ErrorFuente);
    expect(n).toBe(2);
  });

  it("un 404 no se reintenta", async () => {
    let n = 0;
    const fetchFn = (async () => (++n, new Response("no", { status: 404 }))) as typeof fetch;
    await expect(crearIss({ fetchFn }).consultar({})).rejects.toMatchObject({ tipo: "respuesta" });
    expect(n).toBe(1);
  });

  it("corta con la señal de aborto del fetch como timeout", async () => {
    const fetchFn = ((_u: string | URL | Request, init?: RequestInit) =>
      new Promise((_r, rechazar) => init?.signal?.addEventListener("abort", () => rechazar(new DOMException("t", "TimeoutError"))))) as typeof fetch;
    const control = new AbortController();
    const p = crearIss({ fetchFn }).consultar({}, control.signal);
    control.abort();
    await expect(p).rejects.toBeInstanceOf(ErrorFuente);
  });
});

describe("caché y contador de uso", () => {
  it("la clave normaliza mayúsculas, espacios y el orden de las llaves", () => {
    expect(claveCache("x", { q: "  Aurora   ISS ", max: 5 })).toBe(claveCache("x", { max: 5, q: "aurora iss" }));
    expect(claveCache("x", { q: "a" })).not.toBe(claveCache("y", { q: "a" }));
  });

  it("la segunda consulta sale de la caché y no vuelve a la red", async () => {
    const { fetchFn, llamadas } = fetchGrabado([[/wheretheiss/, fixture("iss.json")]]);
    const almacen = almacenMemoria();
    const f = crearIss({ fetchFn });
    const a = await consultarConCache(f, {}, { almacen });
    const b = await consultarConCache(f, {}, { almacen });
    expect(a?.deCache).toBe(false);
    expect(b?.deCache).toBe(true);
    expect(b?.datos).toEqual(a?.datos);
    expect(llamadas).toHaveLength(1);
  });

  it("vence según el ttl de la fuente", async () => {
    const { fetchFn, llamadas } = fetchGrabado([[/wheretheiss/, fixture("iss.json")]]);
    const almacen = almacenMemoria();
    let ahora = new Date("2026-09-30T10:00:00Z");
    const f = crearIss({ fetchFn }); // ttl 30 s
    await consultarConCache(f, {}, { almacen, ahora: () => ahora });
    ahora = new Date("2026-09-30T10:00:20Z");
    expect((await consultarConCache(f, {}, { almacen, ahora: () => ahora }))?.deCache).toBe(true);
    ahora = new Date("2026-09-30T10:01:00Z");
    expect((await consultarConCache(f, {}, { almacen, ahora: () => ahora }))?.deCache).toBe(false);
    expect(llamadas).toHaveLength(2);
  });

  it("cuenta las consultas por mes y al 90 % del plan la fuente se desactiva", async () => {
    const cuerpo = { shopping_results: [{ title: "T", price: "$1", extracted_price: 1000 }] };
    const { fetchFn, llamadas } = fetchGrabado([[/google_shopping/, cuerpo]]);
    const almacen = almacenMemoria();
    const f = crearSerpApiShopping({ env: { SERPAPI_API_KEY: "sk" }, fetchFn });
    almacen.usos.set("serpapi|2026-09", 224); // 90 % de 250 = 225
    const ahora = () => new Date("2026-09-30T10:00:00Z");
    expect((await consultarConCache(f, { q: "uno" }, { almacen, ahora }))?.deCache).toBe(false); // la 225.ª
    expect(almacen.usos.get("serpapi|2026-09")).toBe(225);
    expect(await consultarConCache(f, { q: "dos" }, { almacen, ahora })).toBeNull(); // desactivada
    expect(llamadas).toHaveLength(1);
    // al mes siguiente el contador vuelve a cero
    expect((await consultarConCache(f, { q: "dos" }, { almacen, ahora: () => new Date("2026-10-01T00:00:00Z") }))?.deCache).toBe(false);
  });

  it("consultarSuave devuelve null si la fuente falla, sin lanzar", async () => {
    const fetchFn = (async () => new Response("x", { status: 404 })) as typeof fetch;
    expect(await consultarSuave(crearIss({ fetchFn }), {}, { almacen: almacenMemoria() })).toBeNull();
  });
});
