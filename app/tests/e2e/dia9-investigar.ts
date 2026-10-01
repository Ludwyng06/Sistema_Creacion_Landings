// Aceptación 09-B: «Investigar el producto» en el paso 1 de /crear, con `POST /api/investigar` simulado (misma forma que la 09-A).
// Si la API real de A ya existe y hay clave, `REAL=1` la usa en vez de la simulada.
// Uso: PUERTO=3108 npx tsx tests/e2e/dia9-investigar.ts   → capturas en docs/bitacora/capturas/dia9B/
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright";

const BASE = `http://localhost:${process.env.PUERTO ?? "3000"}`;
const SALIDA = join(process.cwd(), "..", "docs", "bitacora", "capturas", "dia9B");

const fuente = (sitio: string) => [{ url: `https://${sitio}/nota`, sitio }];
const RESPUESTA = {
  sugerencias: {
    beneficios: [
      { texto: "Ayuda a mantener la espalda recta durante la jornada", fuentes: fuente("saludtotal.co"), tieneCifra: false },
      { texto: "Dura 8 horas con una carga completa", fuentes: fuente("tecnoresenas.com"), tieneCifra: true },
      { texto: "Se siente liviano bajo la ropa", fuentes: fuente("bienestar.co"), tieneCifra: false },
    ],
    objeciones: [{ texto: "Puede incomodar al sentarse por mucho tiempo", fuentes: fuente("foro.co"), tieneCifra: false }],
    preguntas: [{ texto: "¿Sirve si trabajo de pie?", fuentes: fuente("preguntas.co"), tieneCifra: false }],
  },
  consultas: ["corrector de postura beneficios", "corrector de postura opiniones"],
  usadas: 3,
  cuota: { usadasMes: 12, limiteMes: 250 },
  avisos: [],
  borrador: {},
  identificacion: null,
  precioReferencia: null,
};

let fallas = 0;
function ok(condicion: boolean, mensaje: string) {
  console.log(`${condicion ? "ok  " : "FALLA"} · ${mensaje}`);
  if (!condicion) fallas++;
}

async function llenar(pagina: Page) {
  await pagina.goto(`${BASE}/crear?modo=experto`, { waitUntil: "load" });
  await pagina.getByLabel("Nombre del producto").fill("Corrector de postura inteligente");
  await pagina.getByLabel("Categoría").selectOption("salud-y-bienestar");
}

async function main() {
  mkdirSync(SALIDA, { recursive: true });
  const navegador = await chromium.launch({ channel: "msedge" });
  try {
    for (const [ancho, alto] of [[390, 844], [1280, 800]] as const) {
      const contexto = await navegador.newContext({ viewport: { width: ancho, height: alto } });
      const pagina = await contexto.newPage();
      const errores: string[] = [];
      pagina.on("pageerror", (e) => errores.push(e.message));
      if (!process.env.REAL) await pagina.route("**/api/investigar", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(RESPUESTA) }));
      await llenar(pagina);

      const boton = pagina.getByRole("button", { name: "Investigar el producto" });
      ok(await boton.isEnabled(), `@${ancho} el botón se activa con nombre y categoría`);
      await boton.click();
      await pagina.locator("[data-resultados-investigacion]").waitFor();
      ok((await pagina.locator("[data-uso-mes]").textContent())?.includes("12 de 250") ?? false, `@${ancho} contador de búsquedas del mes`);
      ok((await pagina.locator("[data-sugerencia] a").count()) === 5, `@${ancho} cada sugerencia muestra su fuente con enlace`);
      ok((await pagina.locator("[data-marca-cifra]").count()) === 1, `@${ancho} solo la sugerencia con cifra lleva la marca`);
      ok(await pagina.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `@${ancho} sin desborde horizontal`);
      await pagina.locator("[data-panel-investigar]").screenshot({ path: join(SALIDA, `panel-${ancho}.png`) });
      await pagina.locator("[data-sugerencia='beneficios-1']").screenshot({ path: join(SALIDA, `tarjeta-con-cifra-${ancho}.png`) });

      // Agregar, editar y descartar.
      await pagina.locator("[data-sugerencia='beneficios-0']").getByRole("button", { name: "Agregar al brief" }).click();
      ok((await pagina.getByRole("textbox", { name: "Beneficio 1" }).inputValue()) === "Ayuda a mantener la espalda recta durante la jornada", `@${ancho} agregar lleva el beneficio a la lista`);
      await pagina.locator("[data-sugerencia='beneficios-1']").getByRole("button", { name: "Agregar al brief" }).click();
      ok((await pagina.getByRole("textbox", { name: "Beneficio 2" }).inputValue()) === "Dura [COMPLETAR] horas con una carga completa", `@${ancho} la cifra entra como [COMPLETAR]`);
      const objecion = pagina.locator("[data-sugerencia='objeciones-0']");
      await objecion.getByRole("button", { name: "Editar" }).click();
      await objecion.getByLabel("Editar sugerencia").fill("Puede incomodar al sentarse");
      await objecion.getByRole("button", { name: "Agregar al brief" }).click();
      ok((await pagina.getByRole("textbox", { name: "Objeción 1" }).inputValue()) === "Puede incomodar al sentarse", `@${ancho} editar y agregar una objeción`);
      await pagina.locator("[data-sugerencia='preguntas-0']").getByRole("button", { name: "Descartar" }).click();
      ok((await pagina.locator("[data-sugerencia='preguntas-0']").count()) === 0, `@${ancho} descartar quita la tarjeta`);
      ok(errores.length === 0, `@${ancho} sin errores de página ${errores.join(" | ")}`);
      await contexto.close();

      // Sin clave (503).
      const sinClave = await navegador.newContext({ viewport: { width: ancho, height: alto } });
      const p2 = await sinClave.newPage();
      await p2.route("**/api/investigar", (r) => r.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Falta SERPAPI_API_KEY." }) }));
      await llenar(p2);
      await p2.getByRole("button", { name: "Investigar el producto" }).click();
      await p2.locator("[data-sin-clave]").waitFor();
      ok(((await p2.locator("[data-sin-clave]").textContent()) ?? "").includes("La investigación es opcional"), `@${ancho} aviso sin clave`);
      ok(await p2.getByLabel("Problema que resuelve").isEnabled(), `@${ancho} el resto del paso 1 sigue igual`);
      await p2.locator("[data-panel-investigar]").screenshot({ path: join(SALIDA, `sin-clave-${ancho}.png`) });
      await sinClave.close();
    }
  } finally {
    await navegador.close();
  }
  console.log(fallas ? `${fallas} fallas` : "Investigar el producto: OK");
  if (fallas) process.exit(1);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
