import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { COMPLETAR, quitarCifras, tieneCifra } from "@/lib/investigacion/cifras";
import { esFuenteInvalida, extraerFragmentos } from "@/lib/investigacion/fragmentos";
import { aLab, coloresDeFoto, coloresDominantes, deltaE, prepararFoto } from "@/lib/investigacion/imagen";
import { armarConsultas, investigar, MAX_BUSQUEDAS, type AlmacenBusquedas } from "@/lib/investigacion/investigar";
import { leerMonto, precioReferencia } from "@/lib/investigacion/precio";
import type { RespuestaBusqueda } from "@/lib/investigacion/serpapi";
import type { DepsEnrutador } from "@/lib/ia/enrutador";
import { ErrorIA, type ProveedorIA } from "@/lib/ia/tipos";
import grabado from "./fixtures/serpapi-corrector.json";

const busquedas = grabado as { q: string; r: RespuestaBusqueda }[];
const NOMBRE = "Corrector de postura";
const env = { SERPAPI_API_KEY: "clave-secreta-de-prueba-123456" };

/** fetch simulado: sirve los fixtures grabados en orden y cuenta las búsquedas. */
function serpapiFalso() {
  const llamadas: string[] = [];
  const fetchFn = (async (url: string) => {
    if (String(url).includes("/account.json")) return Response.json({ plan_name: "Free Plan", searches_per_month: 250, total_searches_left: 240, this_month_usage: 10 });
    const q = new URL(String(url)).searchParams.get("q")!;
    llamadas.push(q);
    return Response.json(busquedas[(llamadas.length - 1) % busquedas.length].r);
  }) as unknown as typeof fetch;
  return { fetchFn, llamadas };
}

const memoria = (): AlmacenBusquedas => {
  const m = new Map<string, string>();
  return { leer: async (k) => m.get(k) ?? null, escribir: async (k, v) => void m.set(k, v) };
};

type Esquema = { parse: (v: unknown) => unknown };

/** Proveedor de IA simulado con soporte de imagen; responde según la tarea que lee en el sistema. */
function proveedorIA(respuestas: { identificar?: unknown; resumir: (ids: string[]) => unknown }) {
  const visto: { imagen?: unknown; usuarios: string[] } = { usuarios: [] };
  const proveedor = {
    id: "gemini",
    soportaImagen: true,
    disponible: () => true,
    async generarJSON(p: { sistema: string; usuario: string; esquema: Esquema; imagen?: unknown }) {
      visto.usuarios.push(p.usuario);
      if (p.sistema.startsWith("Identificas productos")) {
        visto.imagen = p.imagen;
        return { datos: p.esquema.parse(respuestas.identificar), proveedor: "gemini", modelo: "gemini-sim", ms: 1 };
      }
      const ids = [...p.usuario.matchAll(/^\[(f\d+)\]/gm)].map((m) => m[1]);
      return { datos: p.esquema.parse(respuestas.resumir(ids)), proveedor: "gemini", modelo: "gemini-sim", ms: 1 };
    },
  } as unknown as ProveedorIA;
  return { proveedor, visto };
}
const depsIA = (p: ProveedorIA): DepsEnrutador => ({ proveedores: [p], registrarUso: async () => {}, modo: "cascada", espera: async () => {} });

const identificacionOk = {
  reconocido: true,
  tipoProducto: "corrector de postura tipo arnés",
  categoriaSugerida: "salud-y-bienestar",
  rasgosVisibles: ["neopreno negro", "correas ajustables"],
  consultas: ["corrector de postura para qué sirve", "corrector de postura desventajas", "corrector de postura preguntas"],
  confianza: 0.9,
};

const resumenConTrampas = (ids: string[]) => ({
  beneficios: [
    { texto: "Ayuda a mantener la espalda recta al trabajar", fuentes: [ids[0]], tieneCifra: false },
    { texto: "Con 4,8 estrellas y $99.000 es el favorito", fuentes: [ids[1]], tieneCifra: false },
    { texto: "Se pone bajo la ropa sin que se note", fuentes: [ids[1], ids[2]], tieneCifra: false },
    { texto: "Idea sin fuente que se inventó el modelo", fuentes: [], tieneCifra: false },
    { texto: "Idea con fuente inventada", fuentes: ["f999"], tieneCifra: false },
  ],
  objeciones: [{ texto: "Puede incomodar si se usa muchas horas", fuentes: [ids[0]], tieneCifra: false }],
  preguntas: [{ texto: "¿Sirve para la escoliosis?", fuentes: [ids[2]], tieneCifra: false }],
  incluye: [{ texto: "Correas ajustables", fuentes: [ids[0]], tieneCifra: false }],
  problema: { texto: "Dolor de espalda por pasar horas sentado", fuentes: [ids[0], ids[1]], confianza: 0.9 },
  publico: { texto: "Personas que trabajan frente al computador", fuentes: [ids[2]], confianza: 0.8 },
  nivelConciencia: { valor: "problema", motivo: "Buscan cómo aliviar el dolor", fuentes: [ids[0]], confianza: 0.9 },
});

const CAMPOS_PROHIBIDOS = ["precio", "pruebaSocial", "oferta", "garantia"];

describe("cifras (fidelidad)", () => {
  it("«4,8 estrellas» y «$99.000» salen como [COMPLETAR] y tieneCifra", () => {
    const t = "Calificación de 4,8 estrellas por solo $99.000";
    expect(tieneCifra(t)).toBe(true);
    const limpio = quitarCifras(t);
    expect(limpio).toContain(COMPLETAR);
    expect(limpio).not.toMatch(/4,8|99\.000/);
  });
  it("las cifras del nombre del producto no cuentan", () => {
    expect(tieneCifra("El cepillo 9 en 1 limpia", "Cepillo 9 en 1")).toBe(false);
    expect(quitarCifras("El cepillo 9 en 1 limpia", "Cepillo 9 en 1")).toBe("El cepillo 9 en 1 limpia");
  });
});

describe("fragmentos grabados de SerpAPI", () => {
  const f = extraerFragmentos(busquedas.map((b) => b.r));
  it("extrae organic_results y related_questions con título, texto, enlace y sitio", () => {
    expect(f.length).toBeGreaterThan(8);
    expect(f.some((x) => x.tipo === "organico")).toBe(true);
    expect(f.some((x) => x.tipo === "pregunta")).toBe(true);
    for (const x of f) {
      expect(x.fuente.url).toMatch(/^https?:\/\//);
      expect(x.fuente.sitio.length).toBeGreaterThan(0);
      expect(x.texto.length).toBeGreaterThan(0);
    }
    expect(new Set(f.map((x) => x.id)).size).toBe(f.length);
  });
  it("extrae el knowledge_graph cuando viene", () => {
    const kg = extraerFragmentos([{ knowledge_graph: { title: "X", description: "Un producto.", source: { name: "Wikipedia", link: "https://es.wikipedia.org/wiki/X" } } }]);
    expect(kg).toHaveLength(1);
    expect(kg[0]).toMatchObject({ tipo: "conocimiento", fuente: { sitio: "es.wikipedia.org" } });
  });
});

describe("fuentes que no son fuente", () => {
  it("descarta traducciones, cachés, redirecciones y acortadores", () => {
    for (const u of [
      "https://translate.google.com/translate?u=https://x.com",
      "https://sitio-com.translate.goog/pagina?_x_tr_sl=en",
      "https://webcache.googleusercontent.com/search?q=cache:x",
      "https://www.google.com/url?q=https://x.com",
      "https://bit.ly/3abc",
      "https://t.co/xyz",
      "https://l.facebook.com/l.php?u=https://x.com",
      "no es un enlace",
    ]) expect(esFuenteInvalida(u), u).toBe(true);
    for (const u of ["https://www.mercadolibre.com.co/x", "https://es.wikipedia.org/wiki/X", "https://www.google.com/search?q=x"]) expect(esFuenteInvalida(u), u).toBe(false);
  });
  it("extraerFragmentos no cita esos dominios", () => {
    const f = extraerFragmentos([
      { organic_results: [
        { title: "Traducido", snippet: "Texto traducido", link: "https://translate.google.com/translate?u=https://x.com" },
        { title: "Bueno", snippet: "Texto bueno", link: "https://www.ejemplo.com.co/p" },
      ] },
    ]);
    expect(f.map((x) => x.fuente.sitio)).toEqual(["ejemplo.com.co"]);
  });
});

describe("precio de referencia (solo informativo)", () => {
  it("lee montos con formato colombiano", () => {
    expect(leerMonto("99.000")).toBe(99000);
    expect(leerMonto("1.299.900")).toBe(1299900);
    expect(leerMonto("29,99")).toBe(29.99);
  });
  it("devuelve el rango con las fuentes, o null si no hay precios", () => {
    const fr = extraerFragmentos([
      {
        organic_results: [
          { title: "A", snippet: "Cuesta $89.000 hoy", link: "https://a.co/x" },
          { title: "B", snippet: "Desde $129.900 con envío", link: "https://b.co/y" },
          { title: "C", snippet: "Sin precio", link: "https://c.co/z" },
        ],
      },
    ]);
    const r = precioReferencia(fr, "co")!;
    expect(r).toMatchObject({ min: 89000, max: 129900, moneda: "COP" });
    expect(r.fuentes.map((x) => x.sitio)).toEqual(["a.co", "b.co"]);
    expect(precioReferencia(fr.filter((x) => x.fuente.sitio === "c.co"))).toBeNull();
  });
});

describe("colores de la foto (sharp)", () => {
  const cuadro = (color: string, n: number) => sharp({ create: { width: n, height: n, channels: 3, background: color } }).png().toBuffer();
  it("saca los 3 colores dominantes en hex, ignorando el fondo blanco", async () => {
    const img = await sharp({ create: { width: 120, height: 120, channels: 3, background: "#ffffff" } })
      .composite([
        { input: await cuadro("#d62828", 40), left: 15, top: 15 },
        { input: await cuadro("#1d3557", 30), left: 65, top: 15 },
        { input: await cuadro("#f4a261", 20), left: 15, top: 80 },
      ])
      .png()
      .toBuffer();
    const c = await coloresDominantes(img);
    expect(c).toHaveLength(3);
    for (const h of c) expect(h).toMatch(/^#[0-9a-f]{6}$/);
    expect(c).not.toContain("#ffffff");
    expect(c[0]).toMatch(/^#d6(27|28)(27|28)$/);
  });
  /** Equivalente sintético de la foto de un cepillo negro y blanco con aro azul sobre concreto gris con degradado. */
  async function cepilloSintetico() {
    const W = 400;
    const H = 400;
    const data = Buffer.alloc(W * H * 3);
    const gris = (x: number, y: number) => Math.round(120 + (x / W) * 40 + (y / H) * 25); // degradado de 120 a 185
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) data.set([gris(x, y), gris(x, y), gris(x, y) + 3], (y * W + x) * 3);
    const pon = (x0: number, y0: number, w: number, h: number, c: [number, number, number]) => {
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) data.set(c, (y * W + x) * 3);
    };
    pon(120, 150, 170, 60, [22, 24, 30]); // cuerpo negro
    pon(120, 210, 170, 22, [240, 240, 242]); // franja blanca
    pon(290, 165, 40, 26, [245, 245, 247]); // cuello blanco
    pon(196, 170, 14, 14, [30, 110, 200]); // punto azul (aro)
    return { png: await sharp(data, { raw: { width: W, height: H, channels: 3 } }).png().toBuffer(), gris, W, H };
  }
  it("producto sintético sobre fondo gris con degradado: sale casi negro, casi blanco y un azul; nada del fondo", async () => {
    const { png, gris, W, H } = await cepilloSintetico();
    const { colores, avisos } = await coloresDeFoto(png);
    expect(avisos).toEqual([]);
    expect(colores).toHaveLength(3);
    const lab = colores.map((h) => aLab({ r: parseInt(h.slice(1, 3), 16), g: parseInt(h.slice(3, 5), 16), b: parseInt(h.slice(5, 7), 16) }));
    expect(lab.some((c) => c.L < 25), "casi negro").toBe(true);
    expect(lab.some((c) => c.L > 85), "casi blanco").toBe(true);
    expect(lab.some((c) => c.b < -25 && c.L > 25 && c.L < 70), "azul de acento").toBe(true);
    // ninguno cerca de ningún tono del degradado del fondo
    for (const c of lab) {
      for (let t = 0; t <= 20; t++) {
        const g = gris((t / 20) * (W - 1), (t / 20) * (H - 1));
        expect(deltaE(c, aLab({ r: g, g, b: g + 3 })), colores.join(",")).toBeGreaterThanOrEqual(12);
      }
      for (let x = 0; x < W; x += 40) for (let y = 0; y < H; y += 200) expect(deltaE(c, aLab({ r: gris(x, y), g: gris(x, y), b: gris(x, y) + 3 }))).toBeGreaterThanOrEqual(12);
    }
  });
  it("si el fondo se lleva casi toda la imagen, cae a la imagen entera con un aviso", async () => {
    const fondo = await sharp({ create: { width: 100, height: 100, channels: 3, background: "#909090" } }).png().toBuffer();
    const r = await coloresDeFoto(fondo);
    expect(r.colores.length).toBeGreaterThan(0);
    expect(r.avisos.join(" ")).toMatch(/casi no quedó imagen/);
  });
  it("producto sobre fondo gris: el gris no sale y ganan los colores del producto", async () => {
    const gris = "#8a8a8a";
    const producto = await sharp({ create: { width: 200, height: 200, channels: 3, background: gris } })
      .composite([
        { input: await cuadro("#c0392b", 90), left: 55, top: 55 }, // cuerpo del producto, en el centro
        { input: await cuadro("#f1c40f", 30), left: 85, top: 85 }, // detalle
        { input: await cuadro("#2c3e50", 20), left: 140, top: 140 }, // sombra
      ])
      .png()
      .toBuffer();
    const c = await coloresDominantes(producto);
    expect(c[0]).toMatch(/^#c[0-2]3[0-9a-f]2[0-9a-f]$/); // el cubo promedia: ~#c0392b
    expect(c.some((h) => h.startsWith("#f1c")||h.startsWith("#f0c"))).toBe(true);
    for (const h of c) {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
      const cercaDelGris = Math.hypot(r - 0x8a, g - 0x8a, b - 0x8a) < 48;
      expect(cercaDelGris, `${h} es el fondo`).toBe(false);
    }
  });
  it("una foto toda de un color no se queda sin colores", async () => {
    expect((await coloresDominantes(await cuadro("#808080", 40))).length).toBeGreaterThan(0);
  });
  it("prepararFoto da id, colores, JPEG para la IA y WebP; rechaza lo que no es imagen", async () => {
    const p = await prepararFoto(await cuadro("#c81e1e", 50));
    expect(p.id).toMatch(/^[0-9a-f]{12}$/);
    expect(p.colores.length).toBeGreaterThan(0);
    expect(Buffer.from(p.jpegBase64, "base64").subarray(0, 2).toString("hex")).toBe("ffd8");
    expect((await sharp(p.webp).metadata()).format).toBe("webp");
    await expect(prepararFoto(Buffer.from("no soy una imagen"))).rejects.toThrow(/dañado|imagen/);
  });
});

describe("consultas", () => {
  it("usa las sugeridas por la foto (2 o 3) y, sin ellas, arma 3 con el nombre", () => {
    expect(armarConsultas("X", undefined, ["a", "b", "c", "d"])).toEqual(["a", "b", "c"]);
    const q = armarConsultas("Corrector de postura", "salud-y-bienestar");
    expect(q).toHaveLength(MAX_BUSQUEDAS);
    expect(q.every((x) => x.includes("Corrector de postura"))).toBe(true);
  });
});

describe("investigar", () => {
  it("con foto identificada: borrador con fuentes y confianza, colores de la foto, sin precio ni prueba social", async () => {
    const { fetchFn, llamadas } = serpapiFalso();
    const { proveedor, visto } = proveedorIA({ identificar: identificacionOk, resumir: resumenConTrampas });
    const r = await investigar(
      { nombre: NOMBRE, foto: { jpegBase64: "AAAA", colores: ["#111111", "#222222", "#333333"], ruta: "/media/investigar/abc.webp" } },
      { serpapi: { env, fetchFn }, enrutador: depsIA(proveedor), cache: memoria() },
    );
    expect(visto.imagen).toEqual({ mimeType: "image/jpeg", base64: "AAAA" });
    expect(llamadas).toHaveLength(3);
    expect(r.usadas).toBe(3);
    expect(r.cuota).toEqual({ usadasMes: 10, limiteMes: 250 });
    expect(r.identificacion?.reconocido).toBe(true);

    const b = r.borrador;
    expect(b.categoria).toMatchObject({ valor: "salud-y-bienestar", origen: "foto" });
    expect(b.coloresMarca?.valor).toEqual(["#111111", "#222222", "#333333"]);
    expect(b.fotos?.valor).toEqual(["/media/investigar/abc.webp"]);
    expect(b.problema?.valor).toMatch(/dolor de espalda/i);
    expect(b.problema?.fuentes.length).toBeGreaterThan(0);
    expect(b.problema!.confianza).toBeGreaterThan(0);
    expect(b.problema!.confianza).toBeLessThanOrEqual(1);
    expect(b.nivelConciencia).toMatchObject({ valor: "problema", motivo: expect.any(String) });
    expect(b.incluye?.valor).toEqual(["Correas ajustables"]);
    expect(b.beneficios!.valor).toEqual(["Ayuda a mantener la espalda recta al trabajar", "Se pone bajo la ropa sin que se note"]);
    for (const c of Object.values(b)) if (c.origen === "busqueda") expect(c.fuentes.length).toBeGreaterThan(0);
  });

  it("aunque las fuentes traigan precio, calificación y testimonios: el borrador no los tiene y la sugerencia con cifra va marcada", async () => {
    const { fetchFn } = serpapiFalso();
    const { proveedor } = proveedorIA({ identificar: identificacionOk, resumir: resumenConTrampas });
    const r = await investigar({ nombre: NOMBRE, foto: { jpegBase64: "AAAA", colores: [] } }, { serpapi: { env, fetchFn }, enrutador: depsIA(proveedor), cache: memoria() });
    for (const campo of CAMPOS_PROHIBIDOS) expect(r.borrador).not.toHaveProperty(campo);
    const conCifra = r.sugerencias.beneficios.find((s) => s.tieneCifra)!;
    expect(conCifra.texto).toContain(COMPLETAR);
    expect(conCifra.texto).not.toMatch(/4,8|99\.000/);
    expect(r.borrador.beneficios!.valor.join(" ")).not.toContain(COMPLETAR);
    expect(r.sugerencias.beneficios.every((s) => s.fuentes.length > 0)).toBe(true);
    expect(r.sugerencias.beneficios.map((s) => s.texto)).not.toContain("Idea sin fuente que se inventó el modelo");
  });

  it("a la IA no le llegan montos: los fragmentos van con las cifras tapadas", async () => {
    const { fetchFn } = serpapiFalso();
    const { proveedor, visto } = proveedorIA({ identificar: identificacionOk, resumir: () => ({}) });
    await investigar({ nombre: NOMBRE }, { serpapi: { env, fetchFn }, enrutador: depsIA(proveedor), cache: memoria() });
    const enviado = visto.usuarios.at(-1)!;
    expect(enviado).toContain("Fragmentos de las búsquedas");
    expect(enviado).not.toMatch(/\d{1,3}\.\d{3}/);
  });

  it("foto no reconocible: se dice y se sigue con el nombre; la categoría no viene de la foto", async () => {
    const { fetchFn, llamadas } = serpapiFalso();
    const { proveedor } = proveedorIA({
      identificar: { ...identificacionOk, reconocido: false, confianza: 0.1, consultas: [] },
      resumir: (ids) => ({ ...resumenConTrampas(ids), categoria: "salud-y-bienestar" }),
    });
    const r = await investigar({ nombre: NOMBRE, foto: { jpegBase64: "AAAA", colores: ["#101010"] } }, { serpapi: { env, fetchFn }, enrutador: depsIA(proveedor), cache: memoria() });
    expect(r.avisos.join(" ")).toMatch(/no dejó reconocer el producto/);
    expect(llamadas.length).toBeLessThanOrEqual(MAX_BUSQUEDAS);
    expect(llamadas[0]).toContain("Corrector de postura");
    expect(r.borrador.categoria).toMatchObject({ origen: "busqueda" });
    expect(r.borrador.categoria!.confianza).toBeLessThan(0.5);
    expect(r.borrador.coloresMarca?.valor).toEqual(["#101010"]);
  });

  it("caché de 7 días: la segunda vez no gasta búsquedas; a los 8 días sí", async () => {
    const cache = memoria();
    let t = 1_000_000;
    const { proveedor } = proveedorIA({ identificar: identificacionOk, resumir: resumenConTrampas });
    const uno = serpapiFalso();
    const a = await investigar({ nombre: NOMBRE }, { serpapi: { env, fetchFn: uno.fetchFn }, enrutador: depsIA(proveedor), cache, ahora: () => t });
    expect(a.usadas).toBe(3);
    const dos = serpapiFalso();
    const b = await investigar({ nombre: "  corrector DE postura " }, { serpapi: { env, fetchFn: dos.fetchFn }, enrutador: depsIA(proveedor), cache, ahora: () => t + 86_400_000 });
    expect(b.usadas).toBe(0);
    expect(dos.llamadas).toHaveLength(0);
    t += 8 * 86_400_000;
    const tres = serpapiFalso();
    const c = await investigar({ nombre: NOMBRE }, { serpapi: { env, fetchFn: tres.fetchFn }, enrutador: depsIA(proveedor), cache, ahora: () => t });
    expect(c.usadas).toBe(3);
  });

  it("sin clave lanza un error legible (la ruta lo vuelve 503)", async () => {
    await expect(investigar({ nombre: NOMBRE }, { serpapi: { env: {} } })).rejects.toThrow(/SERPAPI_API_KEY/);
  });

  it("si la foto falla en la IA, sigue con el nombre y avisa", async () => {
    const { fetchFn } = serpapiFalso();
    const malo = {
      id: "gemini",
      soportaImagen: true,
      disponible: () => true,
      generarJSON: async (p: { sistema: string; esquema: Esquema }) => {
        if (p.sistema.startsWith("Identificas")) throw new ErrorIA("limite", "gemini: 429");
        return { datos: p.esquema.parse({}), proveedor: "gemini", modelo: "x", ms: 1 };
      },
    } as unknown as ProveedorIA;
    const r = await investigar({ nombre: NOMBRE, foto: { jpegBase64: "AAAA", colores: [] } }, { serpapi: { env, fetchFn }, enrutador: depsIA(malo), cache: memoria() });
    expect(r.identificacion).toBeNull();
    expect(r.avisos.join(" ")).toMatch(/No se pudo mirar la foto/);
  });

  it("la clave nunca aparece en los errores", async () => {
    const fetchFn = (async () => new Response(JSON.stringify({ error: `Invalid API key. Your API key: ${env.SERPAPI_API_KEY}` }), { status: 401 })) as unknown as typeof fetch;
    const { proveedor } = proveedorIA({ resumir: () => ({}) });
    const e = await investigar({ nombre: NOMBRE }, { serpapi: { env, fetchFn }, enrutador: depsIA(proveedor), cache: memoria() }).catch((x) => x as Error);
    expect(e).toBeInstanceOf(Error);
    expect((e as Error).message).not.toContain(env.SERPAPI_API_KEY);
  });
});
