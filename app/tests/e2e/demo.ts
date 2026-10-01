// Ensayo de la demo (docs/demo.md) de punta a punta, con las claves REALES de app/.env.local.
// Recorre: /ajustes → foto + nombre → borrador → aceptar todo → precio → técnicas → prompt → construir con Gemini
// → guardar → editor (texto y tipografía) → landing pública con lead → /tecnicas → /banco. Mide cada paso y el total.
//
// Uso (servidor con las claves reales; usa una base aparte para no ensuciar dev.db):
//   DATABASE_URL=file:./demo-e2e.db npx prisma db push && DATABASE_URL=file:./demo-e2e.db npm run db:semilla -- --desde-json
//   DATABASE_URL=file:./demo-e2e.db npm run dev -- -p 3120
//   PUERTO=3120 npx tsx tests/e2e/demo.ts
// La foto es sintética (se genera aquí con sharp y se borra al terminar). Gasta como máximo 3 búsquedas de SerpAPI
// (la caché de 7 días evita repetirlas). Un paso que falla no detiene el ensayo: se anota y se sigue si se puede.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright";
import sharp from "sharp";

const BASE = `http://localhost:${process.env.PUERTO ?? "3000"}`;
const SALIDA = join(process.cwd(), "..", "docs", "bitacora", "capturas", "dia11");
const NOMBRE_PRODUCTO = "Corrector de postura";
const PRECIO = "89900";

interface Fila {
  paso: string;
  ms: number;
  estado: "ok" | "FALLA" | "nota";
  detalle: string;
}
const filas: Fila[] = [];
const errores: string[] = [];
const inicio = Date.now();

/** Ejecuta un paso, mide su tiempo y lo anota; si lanza, guarda la falla con captura y devuelve `false`. */
async function paso(nombre: string, pagina: Page | null, fn: () => Promise<string | void>): Promise<boolean> {
  const t = Date.now();
  try {
    const detalle = (await fn()) ?? "";
    filas.push({ paso: nombre, ms: Date.now() - t, estado: "ok", detalle });
    console.log(`ok    · ${(((Date.now() - t) / 1000).toFixed(1) + " s").padStart(7)} · ${nombre}${detalle ? ` · ${detalle}` : ""}`);
    return true;
  } catch (e) {
    const detalle = (e instanceof Error ? e.message : String(e)).split("\n")[0].slice(0, 220);
    filas.push({ paso: nombre, ms: Date.now() - t, estado: "FALLA", detalle });
    console.log(`FALLA · ${(((Date.now() - t) / 1000).toFixed(1) + " s").padStart(7)} · ${nombre} · ${detalle}`);
    if (pagina) await pagina.screenshot({ path: join(SALIDA, `falla-${filas.length}.png`) }).catch(() => undefined);
    return false;
  }
}

const nota = (paso: string, detalle: string) => {
  filas.push({ paso, ms: 0, estado: "nota", detalle });
  console.log(`nota  ·         · ${paso} · ${detalle}`);
};

/** Producto sintético (frasco negro con tapa azul) sobre un fondo gris con degradado. Sin fotos personales. */
async function fotoSintetica(ruta: string) {
  const W = 800;
  const H = 800;
  const data = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) data.set([Math.round(130 + (x / W) * 50 + (y / H) * 30), Math.round(130 + (x / W) * 50 + (y / H) * 30), Math.round(134 + (x / W) * 50 + (y / H) * 30)], (y * W + x) * 3);
  const rect = (x0: number, y0: number, w: number, h: number, c: [number, number, number]) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) data.set(c, (y * W + x) * 3);
  };
  rect(280, 260, 240, 380, [24, 26, 32]); // cuerpo
  rect(280, 400, 240, 70, [243, 243, 245]); // franja blanca
  rect(320, 190, 160, 70, [30, 110, 200]); // tapa azul
  writeFileSync(ruta, await sharp(data, { raw: { width: W, height: H, channels: 3 } }).jpeg({ quality: 88 }).toBuffer());
}

async function main() {
  mkdirSync(SALIDA, { recursive: true });
  const foto = join(process.cwd(), "tests", "e2e", "_foto-demo.jpg");
  await fotoSintetica(foto);
  const navegador = await chromium.launch({ channel: process.env.E2E_CANAL ?? "msedge" });
  let landingId = "";
  let slug = "";
  try {
    const ctx = await navegador.newContext({ viewport: { width: 1280, height: 900 } });
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errores.push(`${p.url()} · ${e.message}`));
    p.on("console", (m) => m.type() === "error" && !/favicon|Failed to load resource/.test(m.text()) && errores.push(`${p.url()} · ${m.text().slice(0, 160)}`));

    await paso("0 · /ajustes: tarjeta de SerpAPI conectada", p, async () => {
      await p.goto(`${BASE}/ajustes`, { waitUntil: "load" });
      await p.locator("[data-estado='conectado']").first().waitFor({ timeout: 30_000 });
      const texto = await p.locator("section[aria-labelledby='titulo-investigacion']").innerText();
      return texto.match(/Este mes: [^.]*/)?.[0] ?? "conectado";
    });

    await paso("1 · /crear: foto y nombre", p, async () => {
      await p.goto(`${BASE}/crear?modo=experto`, { waitUntil: "load" });
      await p.evaluate(() => sessionStorage.clear());
      await p.reload({ waitUntil: "load" });
      await p.getByLabel("Foto del producto").setInputFiles(foto);
      await p.locator("[data-vista-foto]").waitFor();
      await p.getByLabel("¿Cómo se llama tu producto?").fill(NOMBRE_PRODUCTO);
    });

    await paso("2 · «Llenar el brief con lo que encuentre» (foto + SerpAPI + Gemini)", p, async () => {
      await p.getByRole("button", { name: "Llenar el brief con lo que encuentre" }).click();
      await p.locator("[data-sugerido='problema']").waitFor({ timeout: 120_000 });
      const sugeridos = await p.locator("[data-estado='pendiente']").count();
      const fuentes = await p.locator("ul[aria-label='Fuentes'] a[href^='http']").count();
      await p.screenshot({ path: join(SALIDA, "brief-prellenado.png"), fullPage: true });
      return `${sugeridos} campos sugeridos, ${fuentes} enlaces de fuente`;
    });

    await paso("3 · precio y reseñas quedan vacíos (los pone la persona)", p, async () => {
      if ((await p.locator("#brief-precio").inputValue()) !== "") throw new Error("el precio venía pre-llenado");
      const nota = await p.locator("[data-nota-tuyo]").count();
      return `precio vacío, ${nota} nota(s) «esto lo pones tú»`;
    });

    await paso("4 · «Aceptar todo lo sugerido»", p, async () => {
      await p.getByRole("button", { name: "Aceptar todo lo sugerido" }).click();
      if ((await p.locator("[data-estado='pendiente']").count()) !== 0) throw new Error("quedaron campos sin revisar");
    });

    await paso("5 · escribir el precio y pasar a las técnicas", p, async () => {
      await p.locator("#brief-precio").fill(PRECIO);
      const avanzar = p.getByRole("button", { name: "Elegir mis técnicas" });
      if (!(await avanzar.isEnabled())) throw new Error(`el paso 1 no deja avanzar: ${(await p.locator("#motivo-bloqueo").textContent().catch(() => null)) ?? "sin motivo visible"}`);
      await avanzar.click();
      await p.getByRole("button", { name: "Armar mi prompt" }).waitFor();
    });

    await paso("6 · /tecnicas en otra pestaña (requisitos 2 y 3)", null, async () => {
      const otra = await ctx.newPage();
      try {
        await otra.goto(`${BASE}/tecnicas`, { waitUntil: "load" });
        await otra.getByRole("heading", { name: "Las 8 técnicas", level: 1 }).waitFor();
        await otra.screenshot({ path: join(SALIDA, "tecnicas.png") });
      } finally {
        await otra.close();
      }
    });

    await paso("7 · técnicas y prompt de 4 bloques", p, async () => {
      await p.getByRole("button", { name: "Armar mi prompt" }).click();
      await p.getByRole("button", { name: "Construir", exact: true }).waitFor({ timeout: 20_000 });
      const texto = await p.locator("main").innerText();
      if (!/rol/i.test(texto)) throw new Error("no se ve el prompt con su bloque Rol");
    });

    const construida = await paso("8 · construir con Gemini real (landing, validadores, crítico)", p, async () => {
      await p.getByRole("button", { name: "Construir", exact: true }).click();
      const inicioC = Date.now();
      await Promise.race([
        p.locator("[data-salud]").waitFor({ timeout: 180_000 }),
        p.locator("[data-panel-manual]").waitFor({ timeout: 180_000 }).then(() => {
          throw new Error("la IA no respondió y salió el modo manual");
        }),
        p.locator("[data-error-construccion]").waitFor({ timeout: 180_000 }).then(async () => {
          throw new Error(`error de construcción: ${(await p.locator("[data-error-construccion]").innerText()).slice(0, 160)}`);
        }),
      ]);
      const rojos = await p.locator("[data-validador][data-estado='rojo']").count();
      const puntaje = ((await p.locator("[data-puntaje]").first().textContent().catch(() => "")) ?? "").replace(/\s+/g, " ").trim();
      await p.screenshot({ path: join(SALIDA, "construida.png") });
      return `${((Date.now() - inicioC) / 1000).toFixed(0)} s, ${rojos} validadores en rojo, ${puntaje || "sin puntaje"}`;
    });

    if (construida) {
      await paso("9 · guardar y abrir en el editor", p, async () => {
        await p.getByRole("button", { name: "Guardar y abrir en el editor" }).click();
        await p.waitForURL(/\/editor\/[a-z0-9]+/, { timeout: 30_000 });
        landingId = /\/editor\/([a-z0-9]+)/.exec(p.url())![1];
        slug = ((await (await fetch(`${BASE}/api/landings/${landingId}`)).json()) as { doc: { meta: { slug: string } } }).doc.meta.slug;
        return `id ${landingId}, slug ${slug}`;
      });
    }

    if (landingId) {
      await paso("10 · editor: cambiar un titular y ver que se guarda", p, async () => {
        await p.locator("[data-lista-secciones]").waitFor({ timeout: 30_000 });
        await p.frameLocator("iframe").locator("[data-seccion-id]").first().waitFor({ timeout: 30_000 });
        // El héroe llega ya seleccionado: su panel muestra el campo «Titular».
        const campo = p.getByLabel("Titular", { exact: true });
        await campo.waitFor({ timeout: 10_000 });
        const nuevo = `Titular del ensayo ${Date.now() % 100000}`;
        await campo.fill(nuevo);
        await p.frameLocator("iframe").getByText(nuevo).first().waitFor({ timeout: 8_000 });
        await p.locator('[data-guardado="guardado"]').waitFor({ timeout: 15_000 });
        await p.screenshot({ path: join(SALIDA, "editor.png") });
      });

      await paso("11 · editor: tipografía (panel Tema)", p, async () => {
        const buscador = p.getByLabel(/buscar tipograf/i);
        if ((await buscador.count()) > 0) {
          await buscador.first().fill("Playfair");
          nota("11 · catálogo de 200 tipografías", "el buscador del catálogo está integrado y responde");
        } else {
          nota("11 · catálogo de 200 tipografías", "aún no hay buscador de catálogo en el panel Tema (10-B de B pendiente): se cambia con el selector de pares");
          const selector = p.locator("#tema-tipografia");
          await selector.waitFor({ timeout: 10_000 });
          const opciones = await selector.locator("option").count();
          if (opciones > 1) await selector.selectOption({ index: 1 });
          await p.waitForTimeout(700);
        }
        await p.screenshot({ path: join(SALIDA, "editor-tipografia.png") });
      });

      await paso("12 · landing pública: formulario con un lead", p, async () => {
        await p.goto(`${BASE}/l/${slug}`, { waitUntil: "networkidle" });
        await p.waitForTimeout(1500); // hidratación: si se escribe antes, React borra los campos (ver reporte)
        const formulario = p.locator("form").last();
        await formulario.getByLabel("Nombre", { exact: true }).fill("Ana del Ensayo");
        await formulario.getByLabel("Correo electrónico", { exact: true }).fill("ana.ensayo@correo.co");
        await formulario.getByLabel("Teléfono", { exact: true }).fill("3001234567");
        await formulario.locator("button[type=submit]").click();
        await p.getByText(/Gracias/).first().waitFor({ timeout: 15_000 });
        const { leads } = (await (await fetch(`${BASE}/api/landings/${landingId}/leads`)).json()) as { leads: unknown[] };
        if (leads.length < 1) throw new Error("el lead no quedó guardado");
        return `${leads.length} lead guardado`;
      });
    }

    await paso("13 · /banco: tarjetas, prompt y detalle lado a lado (requisito 4)", p, async () => {
      await p.goto(`${BASE}/banco`, { waitUntil: "load" });
      await p.getByRole("heading", { name: "Banco de landings", level: 1 }).waitFor();
      const n = await p.locator("[data-tarjeta]").count();
      if (n < 5) throw new Error(`solo ${n} tarjetas en el banco`);
      await p.locator("[data-tarjeta]").first().getByRole("link", { name: "Abrir" }).first().click();
      await p.getByRole("heading", { name: "El prompt que la creó" }).waitFor({ timeout: 20_000 });
      await p.screenshot({ path: join(SALIDA, "banco-detalle.png") });
      return `${n} tarjetas`;
    });

    if (landingId) {
      await paso("14 · la landing recién creada aparece en el banco", p, async () => {
        const { landings } = (await (await fetch(`${BASE}/api/landings`)).json()) as { landings: { id: string; proveedor: string }[] };
        const la = landings.find((l) => l.id === landingId);
        if (!la) throw new Error("no está en GET /api/landings");
        return `proveedor ${la.proveedor}`;
      });
    }
    if (errores.length) nota("errores de consola o de página", `${errores.length}: ${errores.slice(0, 3).join(" | ")}`);
  } finally {
    await navegador.close();
    rmSync(foto, { force: true });
  }

  const total = (Date.now() - inicio) / 1000;
  console.log("\n| Paso | Tiempo | Estado | Detalle |\n|---|---|---|---|");
  for (const f of filas) console.log(`| ${f.paso} | ${f.ms ? `${(f.ms / 1000).toFixed(1)} s` : "—"} | ${f.estado} | ${f.detalle.replace(/\|/g, "/")} |`);
  console.log(`| **Total** | **${total.toFixed(0)} s (${Math.floor(total / 60)}:${String(Math.round(total % 60)).padStart(2, "0")})** | | |`);
  const fallas = filas.filter((f) => f.estado === "FALLA").length;
  console.log(fallas ? `\n${fallas} paso(s) con falla` : "\nEnsayo de la demo: OK");
  if (fallas) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
