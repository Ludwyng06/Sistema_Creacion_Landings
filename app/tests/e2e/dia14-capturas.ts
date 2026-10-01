// Capturas 14-B: cada sección nueva y cada variante con imagen a 390 y 1280, con fotos reales de los bancos (/api/medios/buscar).
// Uso: PUERTO=3114 npx tsx tests/e2e/dia14-capturas.ts   (servidor encendido y bancos llenos: npm run bancos)
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import type { Asset, LandingDoc, Seccion } from "@/lib/contratos";
import { combinar } from "@/lib/tecnicas/combinador";
import { ejemplos as galeria, assets as assetsGaleria } from "@/secciones/galeria/ejemplo";
import { ejemplos as escena, assets as aEscena } from "@/secciones/escena-uso/ejemplo";
import { ASSETS_DE_VARIANTES_CON_IMAGEN, VARIANTES_CON_IMAGEN } from "@/secciones/ejemplos-imagen";
import { ejemplos as historia, assets as aHistoria } from "@/secciones/historia/ejemplo";
import { ejemplos as mecanismo, assets as aMecanismo } from "@/secciones/mecanismo/ejemplo";
import { ejemplos as paraQuien, assets as aParaQuien } from "@/secciones/para-quien/ejemplo";
import { ejemplos as resumen, assets as aResumen } from "@/secciones/resumen/ejemplo";
import { landingEjemplo } from "../fixtures/landing-ejemplo";
import { briefCorrector } from "../tecnicas/briefs";

const BASE = `http://localhost:${process.env.PUERTO ?? "3000"}`;
const SALIDA = join(process.cwd(), "..", "docs", "bitacora", "capturas", "dia14B");
mkdirSync(SALIDA, { recursive: true });

interface Medio {
  titulo: string;
  ruta: string;
  orientacion: string;
  credito: string;
  licencia: NonNullable<Asset["licencia"]>;
  fuente: NonNullable<Asset["fuente"]>;
  bancoId: string;
  urlOrigen?: string;
}

async function medios(): Promise<Medio[]> {
  const todos: Medio[] = [];
  for (const banco of ["b1", "b3", "b5", "b7"]) {
    const r = (await (await fetch(`${BASE}/api/medios/buscar?banco=${banco}&limite=8`)).json()) as { medios: Medio[] };
    todos.push(...r.medios);
  }
  if (todos.length < 4) throw new Error("Los bancos están vacíos: ejecuta npm run bancos primero.");
  return todos;
}

const paquetes = (banco: Medio[]): { nombre: string; secciones: Seccion[]; assets: Asset[] }[] => {
  const nuevas = [paraQuien, mecanismo, historia, resumen, escena].flatMap((m) => Object.values(m));
  const conImagen = [VARIANTES_CON_IMAGEN.beneficios["imagen-alterna"], VARIANTES_CON_IMAGEN["como-funciona"]["pasos-con-imagen"], VARIANTES_CON_IMAGEN.garantia["con-imagen"], VARIANTES_CON_IMAGEN.oferta["con-imagen"], VARIANTES_CON_IMAGEN.faq["con-imagen"], VARIANTES_CON_IMAGEN.incluye["fondo-banco"], galeria["carrusel-deslizante"]];
  const base: Asset[] = [...aParaQuien, ...aMecanismo, ...aHistoria, ...aResumen, ...aEscena, ...ASSETS_DE_VARIANTES_CON_IMAGEN, ...assetsGaleria];
  const asignados = base.map((a, i): Asset => {
    const m = banco[i % banco.length];
    return { ...a, ruta: m.ruta, alt: m.titulo || a.alt, fuente: m.fuente, credito: m.credito, licencia: m.licencia, urlOrigen: m.urlOrigen, bancoId: m.bancoId };
  });
  const mitad = Math.ceil(nuevas.length / 2);
  return [
    { nombre: "nuevas-a", secciones: nuevas.slice(0, mitad), assets: asignados },
    { nombre: "nuevas-b", secciones: nuevas.slice(mitad), assets: asignados },
    { nombre: "con-imagen", secciones: conImagen, assets: asignados },
  ];
};

async function main() {
  const banco = await medios();
  const navegador = await chromium.launch({ channel: process.env.E2E_CANAL ?? "msedge" });
  const problemas: string[] = [];
  try {
    for (const paquete of paquetes(banco).filter((x) => !process.env.SOLO || x.nombre === process.env.SOLO)) {
      const doc = structuredClone(landingEjemplo) as LandingDoc;
      doc.meta.slug = `cap14-${paquete.nombre}-${Date.now()}`;
      doc.meta.nombre = `Capturas 14-B ${paquete.nombre}`;
      if (process.env.EXCLUIR) paquete.secciones = paquete.secciones.filter((x) => !x.id.includes(process.env.EXCLUIR!));
      doc.secciones = paquete.secciones.map((s) => ({ ...s, efectos: [], animacion: undefined }));
      doc.assets = paquete.assets;
      const r = await fetch(`${BASE}/api/landings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: briefCorrector, tecnicas: ["semilla"], prompt: combinar(briefCorrector, []), doc, proveedor: "manual" }),
      });
      if (r.status !== 201) throw new Error(`POST ${r.status} ${await r.text()}`);
      const { slug } = (await r.json()) as { slug: string };
      for (const ancho of [390, 1280]) {
        const ctx = await navegador.newContext({ viewport: { width: ancho, height: 900 } });
        const p = await ctx.newPage();
        p.on("crash", () => problemas.push(`${paquete.nombre} @${ancho}: la página se cerró`));
        p.on("pageerror", (e) => problemas.push(`${paquete.nombre} @${ancho}: ${e.message.slice(0, 120)}`));
        await p.goto(`${BASE}/l/${slug}`, { waitUntil: "networkidle" });
        await p.evaluate(async () => {
          for (let y = 0; y < document.body.scrollHeight; y += 500) {
            window.scrollTo(0, y);
            await new Promise((r) => setTimeout(r, 90));
          }
          // Las imágenes fuera de pantalla (p. ej. las del carrusel) son diferidas: se fuerzan y se espera con tope.
          [...document.images].forEach((i) => (i.loading = "eager"));
          await Promise.race([new Promise((r) => setTimeout(r, 5000)), Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = () => r(null); }))))]);
          window.scrollTo(0, 0);
        });
        await p.waitForTimeout(500);
        if (await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) problemas.push(`${paquete.nombre} @${ancho}: scroll horizontal`);
        for (const s of paquete.secciones) {
          const el = p.locator(`[data-seccion-id="${s.id}"]`);
          const marcadores = await el.locator("[data-marcador-slot]").count();
          if (marcadores > 0) problemas.push(`${s.id} @${ancho}: ${marcadores} marcador(es) sin imagen`);
          await el.scrollIntoViewIfNeeded();
          await p.waitForTimeout(150);
          console.log("captura", s.id, ancho);
          await el.screenshot({ path: join(SALIDA, `${s.id.replace(/^ejemplo-/, "")}-${ancho}.png`) });
        }
        await ctx.close();
      }
      console.log(`ok · ${paquete.nombre} (${paquete.secciones.length} secciones)`);
    }
  } finally {
    await navegador.close();
  }
  console.log(problemas.length ? `Avisos:\n${problemas.join("\n")}` : "Capturas listas, sin avisos.");
  process.exit(problemas.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
