// npm run capturas:home [-- --url http://localhost:3000]
// Capturas reales de landings de la vitrina para el home (capítulos 4 y 5), con el servidor ya en marcha:
//  · Capítulo 4: cada sección de `timbre-inteligente-vitrina` a 390 px (densidad 2), una imagen por sección.
//  · Capítulo 5: `kit-cohete-educativo` con los tokens de cada una de las 3 semillas del home, a 1280 px y a 390 px.
// Falla si a 390 px un titular ocupa más de 3 líneas o si hay desborde horizontal. Escribe las imágenes en
// public/media/home/capturas/ y las medidas en src/datos/home-capturas.json.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import sharp from "sharp";
import { semillasDelHome } from "../src/app/(home)/semillas-home";
import { tokensAVariables } from "../src/componentes/tokens-css";
import { urlFuentes } from "../src/lib/fuentes/url";
import { registro } from "../src/secciones/registro";

sharp.cache(false);

const argumento = (n: string) => process.argv[process.argv.indexOf(n) + 1];
const BASE = process.argv.includes("--url") ? argumento("--url") : "http://localhost:3000";
const SALIDA = join(process.cwd(), "public", "media", "home", "capturas");
mkdirSync(SALIDA, { recursive: true });

const ENSAMBLAJE = { slug: "timbre-inteligente-vitrina", tipos: ["heroe", "sellos-confianza", "problema-solucion", "beneficios", "galeria", "oferta"] };
const SEMILLA = { slug: "cepillo-dental-electrico-vitrina", tipos: ["heroe", "sellos-confianza", "beneficios", "galeria", "oferta"] };
const MAX_LINEAS_TITULAR = 3;

const etiqueta = (tipo: string) => (registro as Record<string, { etiqueta?: string }>)[tipo]?.etiqueta ?? tipo;

async function abrir(navegador: Browser, slug: string, ancho: number, alto: number, dpr: number): Promise<Page> {
  const ctx = await navegador.newContext({ viewport: { width: ancho, height: alto }, deviceScaleFactor: dpr, reducedMotion: "reduce" });
  await ctx.addInitScript("window.__name = (f) => f;");
  const p = await ctx.newPage();
  await p.goto(`${BASE}/l/${slug}`, { waitUntil: "load", timeout: 90_000 });
  // Nada fijo ni diferido: las imágenes cargan ya, la barra fija no tapa y la cinta de anuncio no se repite.
  await p.addStyleTag({ content: '[data-tipo="cta-fija"]{display:none!important}' });
  await p.evaluate(async () => {
    document.querySelectorAll("img").forEach((i) => (i.loading = "eager"));
    for (let y = 0; y < document.body.scrollHeight; y += 500) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
    await Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = () => r(null); setTimeout(r, 6000); }))));
    await document.fonts.ready;
  });
  await p.waitForTimeout(600);
  return p;
}

/** A 390 px: ningún titular pasa de 3 líneas y nada se sale por los lados. */
async function revisarMovil(p: Page, etiquetaPrueba: string): Promise<void> {
  const r = await p.evaluate((max) => {
    const largos = [...document.querySelectorAll<HTMLElement>("[data-seccion-id] h1, [data-seccion-id] h2")]
      .map((h) => {
        const linea = parseFloat(getComputedStyle(h).lineHeight) || parseFloat(getComputedStyle(h).fontSize) * 1.2;
        return { texto: (h.textContent ?? "").slice(0, 50), lineas: Math.round(h.getBoundingClientRect().height / linea) };
      })
      .filter((h) => h.lineas > max);
    return { largos, desborde: document.documentElement.scrollWidth > window.innerWidth };
  }, MAX_LINEAS_TITULAR);
  if (r.largos.length > 0) throw new Error(`${etiquetaPrueba}: titulares de más de ${MAX_LINEAS_TITULAR} líneas a 390 px: ${JSON.stringify(r.largos)}`);
  if (r.desborde) throw new Error(`${etiquetaPrueba}: desborde horizontal a 390 px`);
}

async function cajas(p: Page, tipos: string[]) {
  return p.evaluate((ts) => {
    return ts.map((t) => {
      const el = document.querySelector<HTMLElement>(`[data-seccion-id][data-tipo="${t}"]`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { tipo: t, top: Math.round(r.top + window.scrollY), alto: Math.round(r.height) };
    });
  }, tipos);
}

async function main() {
  const navegador = await chromium.launch({ channel: process.env.E2E_CANAL ?? "msedge" });
  const datos: Record<string, unknown> = {};
  try {
    // ── Capítulo 4: una imagen por sección, a 390 px ──
    {
      const p = await abrir(navegador, ENSAMBLAJE.slug, 390, 844, 2);
      await revisarMovil(p, ENSAMBLAJE.slug);
      const secciones = [];
      for (const tipo of ENSAMBLAJE.tipos) {
        const el = p.locator(`[data-seccion-id][data-tipo="${tipo}"]`).first();
        if ((await el.count()) === 0) throw new Error(`${ENSAMBLAJE.slug} no tiene la sección «${tipo}»`);
        const caja = (await el.boundingBox())!;
        const archivo = `ensamblaje-${tipo}.webp`;
        const buffer = await el.screenshot();
        await sharp(buffer).webp({ quality: 80 }).toFile(join(SALIDA, archivo));
        secciones.push({ tipo, etiqueta: etiqueta(tipo), archivo: `/media/home/capturas/${archivo}`, ancho: 390, top: 0, alto: Math.round(caja.height) });
        console.log(`ensamblaje · ${tipo}: 390×${Math.round(caja.height)}`);
      }
      datos.ensamblaje = { slug: ENSAMBLAJE.slug, secciones };
      await p.context().close();
    }

    // ── Capítulo 5: la landing con cada semilla, a 1280 y a 390 ──
    const semillas = semillasDelHome();
    const resultado: { escritorio: unknown[]; movil: unknown[] } = { escritorio: [], movil: [] };
    for (const [variante, ancho, alto, dpr] of [["escritorio", 1280, 800, 1], ["movil", 390, 844, 2]] as const) {
      const p = await abrir(navegador, SEMILLA.slug, ancho, alto, dpr);
      // Solo las secciones elegidas, una detrás de otra (sin los datos en vivo ni las fichas del medio).
      await p.evaluate((tipos) => {
        document.querySelectorAll<HTMLElement>("[data-seccion-id]").forEach((el) => {
          if (!tipos.includes(el.dataset.tipo ?? "")) el.style.display = "none";
        });
      }, SEMILLA.tipos);
      // Las secciones se revelan al entrar en pantalla: se recorre la página para que todas estén ya a la vista.
      await p.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 300) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 200));
        }
        window.scrollTo(0, 0);
        await new Promise((r) => setTimeout(r, 500));
      });
      for (const [n, s] of semillas.entries()) {
        await p.evaluate(
          async ({ variables, hoja }) => {
            const raiz = document.querySelector<HTMLElement>(".landing")!;
            for (const [k, v] of Object.entries(variables)) raiz.style.setProperty(k, String(v));
            const enlace = document.createElement("link");
            enlace.rel = "stylesheet";
            enlace.href = hoja;
            document.head.appendChild(enlace);
            await new Promise((r) => { enlace.onload = enlace.onerror = () => r(null); setTimeout(r, 8000); });
            await document.fonts.ready;
          },
          { variables: tokensAVariables(s.tokens) as Record<string, string>, hoja: urlFuentes(s.tokens) },
        );
        await p.waitForTimeout(700);
        if (variante === "movil") await revisarMovil(p, `${SEMILLA.slug} · ${s.etiqueta}`);
        const medidas = (await cajas(p, SEMILLA.tipos)).filter((c): c is NonNullable<typeof c> => c !== null);
        const inicio = medidas[0].top;
        const fin = medidas.at(-1)!.top + medidas.at(-1)!.alto;
        // Sección por sección (se revelan al estar a la vista) y pegadas en su lugar sobre el fondo de la semilla.
        const piezas = [];
        for (const m of medidas) {
          const imagen = await p.locator(`[data-seccion-id][data-tipo="${m.tipo}"]`).first().screenshot();
          piezas.push({ input: imagen, left: 0, top: Math.round((m.top - inicio) * dpr) });
        }
        const archivo = `semilla-${n + 1}-${variante}.webp`;
        await sharp({ create: { width: ancho * dpr, height: (fin - inicio) * dpr, channels: 3, background: s.tokens.colores.fondo } })
          .composite(piezas)
          .webp({ quality: variante === "escritorio" ? 78 : 80 })
          .toFile(join(SALIDA, archivo));
        (resultado[variante] as unknown[]).push({
          archivo: `/media/home/capturas/${archivo}`,
          ancho,
          alto: fin - inicio,
          secciones: medidas.map((m) => ({ tipo: m.tipo, etiqueta: etiqueta(m.tipo), top: m.top - inicio, alto: m.alto })),
        });
        console.log(`semilla ${n + 1} · ${variante}: ${ancho}×${fin - inicio}`);
      }
      await p.context().close();
    }
    datos.semilla = { slug: SEMILLA.slug, url: `/l/${SEMILLA.slug}`, ...resultado };
  } finally {
    await navegador.close();
  }
  writeFileSync(join(process.cwd(), "src", "datos", "home-capturas.json"), JSON.stringify(datos, null, 2) + "\n");
  console.log("capturas del home listas");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
