// Ningún glifo puede salir del área visible de su máscara (tarea 07-B corregida): en /dev/titulares y en el home
// mide cada letra con Range.getBoundingClientRect contra el rect de su ancestro con `overflow: hidden`.
// Uso: PUERTO=3108 npx tsx tests/e2e/dia8-glifos.ts   (con `next dev -p 3108`; /dev no existe en producción)
import { chromium } from "playwright";

const BASE = `http://localhost:${process.env.PUERTO ?? "3000"}`;

/** Corre en el navegador: devuelve las letras cuyo rect se sale de la máscara. */
function medirGlifos(selector: string) {
  const fuera: string[] = [];
  let letras = 0;
  for (const raiz of document.querySelectorAll(selector)) {
    const recorrido = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
    for (let nodo = recorrido.nextNode(); nodo; nodo = recorrido.nextNode()) {
      const texto = nodo.textContent ?? "";
      let mascara: HTMLElement | null = nodo.parentElement;
      while (mascara && mascara !== raiz && getComputedStyle(mascara).overflow === "visible") mascara = mascara.parentElement;
      if (!mascara || getComputedStyle(mascara).overflow === "visible") continue;
      const caja = mascara.getBoundingClientRect();
      if (caja.width <= 1 || caja.height <= 1) continue; // texto solo para lectores de pantalla (`sr-only`)
      for (let i = 0; i < texto.length; i++) {
        if (texto[i].trim() === "") continue;
        const rango = document.createRange();
        rango.setStart(nodo, i);
        rango.setEnd(nodo, i + 1);
        const r = rango.getBoundingClientRect();
        letras++;
        const margen = 0.5;
        if (r.top < caja.top - margen || r.bottom > caja.bottom + margen || r.left < caja.left - margen || r.right > caja.right + margen) {
          fuera.push(`${texto[i]} (arriba ${(caja.top - r.top).toFixed(1)}, abajo ${(r.bottom - caja.bottom).toFixed(1)})`);
        }
      }
    }
  }
  return { letras, fuera };
}

async function main() {
  const navegador = await chromium.launch({ channel: "msedge" });
  let fallas = 0;
  try {
    for (const [ancho, alto] of [[1280, 800], [390, 844]] as const) {
      const pagina = await (await navegador.newContext({ viewport: { width: ancho, height: alto } })).newPage();
      await pagina.addInitScript("window.__name = (f) => f;");
      for (const ruta of ["/dev/titulares", "/"]) {
        await pagina.goto(BASE + ruta, { waitUntil: "load" });
        await pagina.waitForTimeout(3000); // la animación de entrada termina
        const r = await pagina.evaluate(medirGlifos, "[data-titular-cinetico], [data-efecto='titular-cinetico']");
        console.log(`${ruta} @${ancho}: ${r.letras} letras medidas, ${r.fuera.length} fuera de su máscara`, r.fuera.slice(0, 6));
        if (r.letras === 0 || r.fuera.length) fallas++;
      }
      await pagina.context().close();
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
