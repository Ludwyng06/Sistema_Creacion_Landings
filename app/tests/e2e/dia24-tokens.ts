// Aceptación 24-B · los tokens se ven: la misma landing (la de la vitrina, con sus fotos reales) con 4 juegos de tokens y de
// estilo distintos tiene que verse distinta a 390 y a 1280 px (diferencia de píxeles entre cada par de capturas) y los fondos de
// sección tienen que salir del estilo. Además cada variante nueva se dibuja distinta a su hermana.
// Uso: PUERTO=3122 npx tsx tests/e2e/dia24-tokens.ts   (capturas en docs/bitacora/capturas/dia24B/)
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright";
import sharp from "sharp";
import { combinar } from "@/lib/tecnicas/combinador";
import type { LandingDoc, Tokens } from "@/lib/contratos";
import { variantesDe } from "@/secciones/catalogo-variantes";
import { ASSETS_POR_TIPO } from "@/secciones/ejemplos-por-tipo";
import { landingEjemplo } from "../fixtures/landing-ejemplo";
import { briefCorrector } from "../tecnicas/briefs";

const BASE = `http://localhost:${process.env.PUERTO ?? "3000"}`;
const SALIDA = join(process.cwd(), "..", "docs", "bitacora", "capturas", "dia24B");
mkdirSync(SALIDA, { recursive: true });

function comprobar(condicion: unknown, mensaje: string): asserts condicion {
  if (!condicion) throw new Error(`FALLA: ${mensaje}`);
  console.log(`ok · ${mensaje}`);
}

type Juego = { nombre: string; tokens: Partial<Pick<Tokens, "radio" | "espaciado" | "borde" | "imagen" | "intensidad">> & { escala: Tokens["tipografia"]["escala"] }; estilo: string; numero: number };
const JUEGOS: Juego[] = [
  { nombre: "brutal", tokens: { radio: 0, espaciado: "denso", borde: "grueso", imagen: "natural", escala: "amplia", intensidad: 3 }, estilo: "brutalismo tipográfico", numero: 11 },
  { nombre: "ma", tokens: { radio: 4, espaciado: "aireado", borde: "ninguno", imagen: "recorte", escala: "normal", intensidad: 2 }, estilo: "japonés ma (espacio negativo)", numero: 12 },
  { nombre: "memphis", tokens: { radio: 999, espaciado: "normal", borde: "fino", imagen: "duotono", escala: "compacta", intensidad: 3 }, estilo: "Memphis contenido", numero: 13 },
  { nombre: "patente", tokens: { radio: 16, espaciado: "denso", borde: "fino", imagen: "marco", escala: "normal", intensidad: 1 }, estilo: "catálogo técnico de patentes de los 50", numero: 14 },
];

async function crear(doc: LandingDoc): Promise<{ id: string; slug: string }> {
  const r = await fetch(`${BASE}/api/landings`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brief: briefCorrector, tecnicas: ["semilla"], prompt: combinar(briefCorrector, []), doc, proveedor: "manual" }) });
  if (r.status !== 201) throw new Error(`No se creó «${doc.meta.nombre}»: ${r.status} ${(await r.text()).slice(0, 300)}`);
  return { ...((await r.json()) as { id: string }), slug: doc.meta.slug };
}

const SIN_DIFERIR = ".seccion-diferida{content-visibility:visible!important;contain-intrinsic-size:auto!important}";

async function capturar(p: Page, slug: string, archivo: string): Promise<Buffer> {
  await p.goto(`${BASE}/l/${slug}`, { waitUntil: "load" });
  await p.addStyleTag({ content: SIN_DIFERIR });
  // Recorre la página para que carguen las imágenes perezosas.
  await p.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
  });
  await p.waitForTimeout(1200);
  const buf = await p.screenshot({ fullPage: true, animations: "disabled" });
  const meta = await sharp(buf).metadata();
  await sharp(buf).extract({ left: 0, top: 0, width: meta.width!, height: Math.min(3200, meta.height!) }).toFile(join(SALIDA, archivo));
  return buf;
}

/** Diferencia media (0 a 1) entre dos capturas, comparadas a la misma altura. */
async function diferencia(a: Buffer, b: Buffer): Promise<number> {
  const ma = await sharp(a).metadata();
  const mb = await sharp(b).metadata();
  const w = Math.min(ma.width!, mb.width!);
  const h = Math.min(ma.height!, mb.height!, 4000);
  const crudo = async (x: Buffer) => sharp(x).extract({ left: 0, top: 0, width: w, height: h }).removeAlpha().raw().toBuffer();
  const [ra, rb] = await Promise.all([crudo(a), crudo(b)]);
  let suma = 0;
  for (let i = 0; i < ra.length; i++) suma += Math.abs(ra[i] - rb[i]);
  return suma / ra.length / 255;
}

/** Fracción (0 a 1) de píxeles que difieren de verdad en el primer viewport, sobre miniaturas de 320 px de ancho. */
async function fraccionDistinta(a: Buffer, b: Buffer, ancho: number, alto: number): Promise<number> {
  const mini = async (x: Buffer) =>
    sharp(x).extract({ left: 0, top: 0, width: ancho, height: alto }).resize({ width: 320 }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const [ma, mb] = await Promise.all([mini(a), mini(b)]);
  let distintos = 0;
  const n = ma.data.length / 3;
  for (let i = 0; i < n; i++) {
    const d = Math.abs(ma.data[i * 3] - mb.data[i * 3]) + Math.abs(ma.data[i * 3 + 1] - mb.data[i * 3 + 1]) + Math.abs(ma.data[i * 3 + 2] - mb.data[i * 3 + 2]);
    if (d > 48) distintos++;
  }
  return distintos / n;
}

async function main() {
  const lista = ((await (await fetch(`${BASE}/api/landings`)).json()) as { landings: { id: string; slug: string }[] }).landings;
  const origen = lista.find((l) => l.slug === "timbre-inteligente-vitrina") ?? lista[0];
  const base = ((await (await fetch(`${BASE}/api/landings/${origen.id}`)).json()) as { doc: LandingDoc }).doc;
  comprobar(base, `base: ${origen.slug}`);

  const creadas: string[] = [];
  const navegador = await chromium.launch({ channel: process.env.E2E_CANAL ?? "msedge" });
  try {
    const ctx390 = await navegador.newContext({ viewport: { width: 390, height: 844 } });
    const ctx1280 = await navegador.newContext({ viewport: { width: 1280, height: 800 } });
    for (const c of [ctx390, ctx1280]) await c.addInitScript("window.__name = (f) => f;");
    const p390 = await ctx390.newPage();
    const p1280 = await ctx1280.newPage();

    const capturas = new Map<string, Buffer[]>();
    const fondos: string[][] = [];
    for (const j of JUEGOS) {
      const doc = structuredClone(base);
      doc.meta.slug = `e2e24-${j.nombre}-${Date.now()}`;
      doc.meta.nombre = `Tokens ${j.nombre}`;
      doc.meta.semilla = { ...doc.meta.semilla, estilo: j.estilo, numero: j.numero };
      const { escala, ...resto } = j.tokens;
      doc.tokens = { ...doc.tokens, ...resto, tipografia: { ...doc.tokens.tipografia, escala } } as Tokens;
      const { id, slug } = await crear(doc);
      creadas.push(id);
      capturas.set(j.nombre, [await capturar(p390, slug, `tokens-${j.nombre}-390.png`), await capturar(p1280, slug, `tokens-${j.nombre}-1280.png`)]);
      fondos.push(await p1280.evaluate(() => [...document.querySelectorAll<HTMLElement>("[data-fondo]")].map((e) => e.dataset.fondo ?? "")));
    }
    const nombres = JUEGOS.map((j) => j.nombre);
    for (const [i, ancho] of ["390", "1280"].entries()) {
      for (let a = 0; a < nombres.length; a++) {
        for (let b = a + 1; b < nombres.length; b++) {
          const d = await diferencia(capturas.get(nombres[a])![i], capturas.get(nombres[b])![i]);
          comprobar(d > 0.02, `${ancho} px: «${nombres[a]}» y «${nombres[b]}» se ven distintas (diferencia ${(d * 100).toFixed(1)} %)`);
          const [w, h] = ancho === "1280" ? [1280, 800] : [390, 844];
          const f = await fraccionDistinta(capturas.get(nombres[a])![i], capturas.get(nombres[b])![i], w, h);
          comprobar(f > 0.15, `${ancho} px, primer viewport: «${nombres[a]}» y «${nombres[b]}» difieren en ${(f * 100).toFixed(1)} % de los píxeles (mínimo 15 %)`);
        }
      }
    }
    comprobar(new Set(fondos.map((f) => f.join("|"))).size === JUEGOS.length, `los 4 estilos reparten fondos distintos: ${fondos.map((f, i) => `${nombres[i]}=[${[...new Set(f)].join(",") || "liso"}]`).join(" ")}`);

    // ── Variantes nuevas: cada una se dibuja distinta a su hermana ──
    for (const [tipo, claves] of [
      ["cifras", ["franja", "tarjetas"]],
      ["problema-solucion", ["columna", "dividida"]],
      ["antes-despues", ["deslizador", "lado-a-lado"]],
      ["video", ["centrado", "lado"]],
      ["formulario-lead", ["tarjeta", "dividido"]],
    ] as const) {
      const tomas: Buffer[] = [];
      for (const clave of claves) {
        const v = variantesDe(tipo).find((x) => x.clave === clave)!;
        const doc = structuredClone(landingEjemplo);
        doc.meta.slug = `e2e24-${tipo}-${clave}-${Date.now()}`;
        const extra = { ...v.seccion, id: "var-1", visible: true };
        doc.secciones = [...doc.secciones.slice(0, 4), extra, ...doc.secciones.slice(4, 5)].slice(0, 6);
        doc.assets = [...new Map([...doc.assets, ...(ASSETS_POR_TIPO[tipo] ?? [])].map((a) => [a.slot, a])).values()];
        const { id, slug } = await crear(doc);
        creadas.push(id);
        await p1280.goto(`${BASE}/l/${slug}`, { waitUntil: "load" });
        await p1280.addStyleTag({ content: SIN_DIFERIR });
        await p1280.waitForTimeout(1200);
        const el = p1280.locator('[data-seccion-id="var-1"]');
        await el.scrollIntoViewIfNeeded();
        await p1280.waitForTimeout(600);
        tomas.push(await el.screenshot({ path: join(SALIDA, `variante-${tipo}-${clave}.png`), animations: "disabled" }));
      }
      const d = await diferencia(tomas[0], tomas[1]);
      comprobar(d > 0.01, `${tipo}: «${claves[0]}» y «${claves[1]}» se ven distintas (${(d * 100).toFixed(1)} %)`);
    }
  } finally {
    await navegador.close();
    for (const id of creadas) await fetch(`${BASE}/api/landings/${id}`, { method: "DELETE" }).catch(() => {});
  }
  console.log("\n24-B tokens y variantes: OK");
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
