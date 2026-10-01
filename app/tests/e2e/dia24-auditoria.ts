// Auditoría 24-B · ¿cada token cambia de verdad cada sección?
// Crea la misma landing con un juego base de tokens y 6 variantes (un token cada vez) y mide en el navegador, sección por sección,
// qué cambió. Imprime una tabla tipo → qué tokens no se notan. Las secciones sin tarjetas, bordes o imágenes no tienen por qué
// reaccionar a ese token: se leen a mano en la tabla.
// Uso: PUERTO=3122 npx tsx tests/e2e/dia24-auditoria.ts
import { chromium } from "playwright";
import { combinar } from "@/lib/tecnicas/combinador";
import type { Asset, LandingDoc, Seccion, Tokens } from "@/lib/contratos";
import { ASSETS_POR_TIPO, EJEMPLO_POR_TIPO } from "@/secciones/ejemplos-por-tipo";
import { landingEjemplo } from "../fixtures/landing-ejemplo";
import { briefCorrector } from "../tecnicas/briefs";

const BASE = `http://localhost:${process.env.PUERTO ?? "3000"}`;
const BASAL: Pick<Tokens, "radio" | "espaciado" | "borde" | "imagen" | "intensidad"> & { escala: Tokens["tipografia"]["escala"] } = { radio: 0, espaciado: "denso", borde: "ninguno", imagen: "natural", escala: "compacta", intensidad: 1 };
const VARIANTES: { token: string; cambio: Partial<typeof BASAL> }[] = [
  { token: "radio", cambio: { radio: 16 } },
  { token: "espaciado", cambio: { espaciado: "aireado" } },
  { token: "borde", cambio: { borde: "grueso" } },
  { token: "imagen", cambio: { imagen: "marco" } },
  { token: "imagen-duotono", cambio: { imagen: "duotono" } },
  { token: "escala", cambio: { escala: "amplia" } },
];

const tipos = Object.keys(EJEMPLO_POR_TIPO) as (keyof typeof EJEMPLO_POR_TIPO)[];
const grupos = [tipos.slice(0, 12), tipos.slice(12, 23), tipos.slice(23)];

function docDe(grupo: typeof tipos, t: typeof BASAL, nombre: string): LandingDoc {
  const doc = structuredClone(landingEjemplo);
  const secciones: Seccion[] = grupo.map((tipo) => structuredClone(EJEMPLO_POR_TIPO[tipo]));
  const assets: Asset[] = grupo.flatMap((tipo) => ASSETS_POR_TIPO[tipo] ?? []);
  doc.secciones = secciones.map((s) => ({ ...s, visible: true, efectos: [] }));
  doc.assets = [...new Map(assets.map((a) => [a.slot, a])).values()];
  doc.meta.slug = `e2e24-${nombre}-${Date.now()}`;
  doc.meta.nombre = `Auditoría ${nombre}`;
  doc.tokens = { ...doc.tokens, radio: t.radio, espaciado: t.espaciado, borde: t.borde, imagen: t.imagen, intensidad: t.intensidad, tipografia: { ...doc.tokens.tipografia, escala: t.escala } };
  return doc;
}

interface Medida { alto: number; radios: string; bordes: number; imagen: string; fuente: number }

async function main() {
  const navegador = await chromium.launch({ channel: process.env.E2E_CANAL ?? "msedge" });
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript("window.__name = (f) => f;");
  const p = await ctx.newPage();
  const ids: string[] = [];
  const medidas = new Map<string, Map<string, Medida>>(); // clave variante → tipo → medida
  const conjuntos = [{ token: "base", cambio: {} }, ...VARIANTES];
  try {
    for (const { token, cambio } of conjuntos) {
      const m = new Map<string, Medida>();
      for (const [g, grupo] of grupos.entries()) {
        const doc = docDe(grupo, { ...BASAL, ...cambio }, `${token}-${g}`);
        const r = await fetch(`${BASE}/api/landings`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brief: briefCorrector, tecnicas: ["semilla"], prompt: combinar(briefCorrector, []), doc, proveedor: "manual" }) });
        if (r.status !== 201) throw new Error(`No se creó ${token}-${g}: ${r.status} ${(await r.text()).slice(0, 300)}`);
        const { id } = (await r.json()) as { id: string };
        ids.push(id);
        await p.goto(`${BASE}/l/${doc.meta.slug}`, { waitUntil: "load" });
        await p.addStyleTag({ content: ".seccion-diferida{content-visibility:visible!important;contain-intrinsic-size:auto!important}" });
        await p.waitForTimeout(1500);
        const lectura = await p.evaluate(() =>
          [...document.querySelectorAll<HTMLElement>("[data-seccion-id]")].map((s) => {
            const todos = [s, ...s.querySelectorAll<HTMLElement>("*")].filter((e) => e.getBoundingClientRect().width > 0);
            const radios = new Set<string>();
            let bordes = 0;
            let imagen = "";
            let fuente = 0;
            for (const e of todos) {
              const c = getComputedStyle(e);
              const r = c.borderTopLeftRadius;
              if (r !== "0px") radios.add(r);
              bordes += ["Top", "Right", "Bottom", "Left"].reduce((n, l) => n + (c.getPropertyValue(`border-${l.toLowerCase()}-style`) !== "none" ? parseFloat(c.getPropertyValue(`border-${l.toLowerCase()}-width`)) : 0), 0);
              if (e.tagName === "IMG") imagen += `${c.filter}|${(e.parentElement && getComputedStyle(e.parentElement).padding) ?? ""}|${e.parentElement ? getComputedStyle(e.parentElement).borderTopWidth : ""};`;
              if (/^(H1|H2|H3|P)$/.test(e.tagName)) fuente = Math.max(fuente, parseFloat(c.fontSize));
            }
            return { tipo: s.dataset.tipo ?? "?", alto: Math.round(s.getBoundingClientRect().height), radios: [...radios].sort().join(","), bordes: Math.round(bordes), imagen, fuente: Math.round(fuente * 10) / 10 };
          }),
        );
        for (const l of lectura) m.set(l.tipo, l);
      }
      medidas.set(token, m);
    }
    const base = medidas.get("base")!;
    const filas: string[] = [];
    for (const tipo of tipos) {
      const b = base.get(tipo);
      if (!b) { filas.push(`${tipo.padEnd(18)} (no se pintó)`); continue; }
      const ignora: string[] = [];
      const cmp = (token: string, campo: keyof Medida) => {
        const v = medidas.get(token)!.get(tipo);
        if (v && v[campo] === b[campo]) ignora.push(token);
      };
      cmp("radio", "radios");
      cmp("espaciado", "alto");
      cmp("borde", "bordes");
      cmp("imagen", "imagen");
      cmp("imagen-duotono", "imagen");
      cmp("escala", "fuente");
      filas.push(`${tipo.padEnd(18)} sin efecto: ${ignora.length ? ignora.join(", ") : "—"}`);
    }
    console.log("\nTipo               tokens que NO cambian nada visible (a 390 px)\n" + filas.join("\n"));
  } finally {
    await navegador.close();
    for (const id of ids) await fetch(`${BASE}/api/landings/${id}`, { method: "DELETE" }).catch(() => {});
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
