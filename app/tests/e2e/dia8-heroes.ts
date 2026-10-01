// El titular del héroe no puede cruzarse con la imagen, el video o su marcador (08-B). Excepto en las variantes
// superpuestas, donde el texto va por encima con su propio fondo o velo (`data-velo` o fondo del titular).
// Uso: PUERTO=3108 npx tsx tests/e2e/dia8-heroes.ts   (con `next dev -p 3108`; /dev no existe en producción)
// Con CAPTURAS=<carpeta> guarda una imagen de cada variante y titular.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = `http://localhost:${process.env.PUERTO ?? "3000"}`;
const SUPERPUESTAS = ["poster-a-sangre", "video-inmersivo", "mosaico-editorial"];

/** Corre en el navegador. */
function medir() {
  const casos: { caso: string; variante: string; lineas: number; cruces: string[]; sinVelo: boolean }[] = [];
  for (const bloque of document.querySelectorAll<HTMLElement>("[data-caso]")) {
    const h1 = bloque.querySelector("h1") as HTMLElement;
    const r = h1.getBoundingClientRect();
    const alto = parseFloat(getComputedStyle(h1).lineHeight) || r.height;
    const medios = [...bloque.querySelectorAll<HTMLElement>("[data-marcador-slot], .media-slot, [data-comparador], img, video")]
      .filter((m) => !h1.contains(m) && m.getBoundingClientRect().width > 0);
    const cruces: string[] = [];
    for (const m of medios) {
      const c = m.getBoundingClientRect();
      const dx = Math.min(r.right, c.right) - Math.max(r.left, c.left);
      const dy = Math.min(r.bottom, c.bottom) - Math.max(r.top, c.top);
      if (dx > 1 && dy > 1) cruces.push(`${m.getAttribute("data-marcador-slot") ?? m.tagName} (${dx.toFixed(0)}×${dy.toFixed(0)} px)`);
    }
    const seccion = bloque.querySelector("section") as HTMLElement;
    const conVelo = !!seccion.querySelector("[data-velo]") || getComputedStyle(h1.parentElement as HTMLElement).backgroundColor !== "rgba(0, 0, 0, 0)";
    casos.push({ caso: bloque.dataset.caso!, variante: bloque.dataset.variante!, lineas: Math.round(r.height / alto), cruces, sinVelo: !conVelo });
  }
  return casos;
}

async function main() {
  const navegador = await chromium.launch({ channel: "msedge" });
  let fallas = 0;
  try {
    for (const [ancho, alto] of [[390, 844], [1280, 800]] as const) {
      const pagina = await (await navegador.newContext({ viewport: { width: ancho, height: alto } })).newPage();
      await pagina.addInitScript("window.__name = (f) => f;");
      await pagina.goto(`${BASE}/dev/heroes`, { waitUntil: "load" });
      await pagina.waitForTimeout(2500);
      for (const c of await pagina.evaluate(medir)) {
        const superpuesta = SUPERPUESTAS.includes(c.variante);
        const mal = superpuesta ? c.sinVelo : c.cruces.length > 0;
        console.log(`${mal ? "FALLA" : "ok   "} @${ancho} ${c.caso} (${c.lineas} líneas)`, superpuesta ? (c.sinVelo ? "sin velo ni fondo propio" : "superpuesta con velo") : c.cruces.join(", "));
        if (mal) fallas++;
      }
      if (process.env.CAPTURAS) {
        mkdirSync(process.env.CAPTURAS, { recursive: true });
        for (const bloque of await pagina.locator("[data-caso]").all()) {
          const caso = (await bloque.getAttribute("data-caso"))!.replace(":", "-");
          await bloque.screenshot({ path: `${process.env.CAPTURAS}/${caso}-${ancho}.png` });
        }
      }
      await pagina.context().close();
    }
  } finally {
    await navegador.close();
  }
  console.log(fallas ? `${fallas} fallas` : "Héroes: OK");
  if (fallas) process.exit(1);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
