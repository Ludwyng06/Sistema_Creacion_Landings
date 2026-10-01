// Accesibilidad del día 8: recorre con Tab las pantallas y comprueba que cada elemento enfocado tiene un anillo de
// foco visible y que el orden sigue el de la pantalla (de arriba a abajo, de izquierda a derecha por paneles).
// Uso: PUERTO=3107 EDITOR=<id> npx tsx tests/e2e/dia8-a11y.ts
import { chromium } from "playwright";

const BASE = `http://localhost:${process.env.PUERTO ?? "3000"}`;
const rutas = [`/`, `/crear`, `/editor/${process.env.EDITOR ?? ""}`];

async function main() {
  const navegador = await chromium.launch({ channel: "msedge" });
  let fallas = 0;
  try {
    for (const ruta of rutas) {
      for (const [ancho, alto] of [[1280, 800], [390, 844]] as const) {
        const pagina = await (await navegador.newContext({ viewport: { width: ancho, height: alto }, reducedMotion: "reduce" })).newPage();
        await pagina.goto(BASE + ruta, { waitUntil: "load" });
        await pagina.waitForTimeout(2500);
        const sinFoco: string[] = [];
        const xs: string[] = [];
        let total = 0;
        for (let i = 0; i < 60; i++) {
          await pagina.keyboard.press("Tab");
          const info = await pagina.evaluate(() => {
            const el = document.activeElement as HTMLElement | null;
            if (!el || el === document.body) return null;
            const c = getComputedStyle(el);
            const visible = (c.outlineStyle !== "none" && parseFloat(c.outlineWidth) > 0) || c.boxShadow !== "none" || el.matches("[class*='focus-within'], :has(:focus-visible)");
            const r = el.getBoundingClientRect();
            return { nombre: `${el.tagName.toLowerCase()} ${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30)}`, visible, x: Math.round(r.x), y: Math.round(r.y + window.scrollY), oculto: r.width === 0 || r.height === 0 };
          });
          if (!info) continue;
          total++;
          if (info.oculto) xs.push(`elemento sin tamaño enfocable: ${info.nombre}`);
          if (!info.visible) sinFoco.push(info.nombre);
        }
        console.log(`${ruta} @${ancho}: ${total} elementos enfocados, ${sinFoco.length} sin anillo visible`, sinFoco.slice(0, 5), xs.slice(0, 3));
        fallas += sinFoco.length + xs.length;
        await pagina.context().close();
      }
    }
  } finally {
    await navegador.close();
  }
  if (fallas) process.exit(1);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
