import { expect, test, type APIRequestContext } from "playwright/test";
import { EJEMPLOS } from "../src/datos/ejemplos";
import { combinar } from "../src/lib/tecnicas/combinador";
import { landingEjemplo } from "../tests/fixtures/landing-ejemplo";

// Flujos de punta a punta con el modo manual: sin claves de IA, el asistente pide pegar el JSON.
// `landingEjemplo` es el LandingDoc de prueba que se pega en el panel manual.

const DOC = JSON.stringify(landingEjemplo);

/** Crea una landing por la API (para los flujos que no son el asistente). */
async function crearPorApi(request: APIRequestContext, slug: string) {
  const brief = EJEMPLOS[0].brief;
  const doc = { ...landingEjemplo, meta: { ...landingEjemplo.meta, slug } };
  const res = await request.post("/api/landings", { data: { brief, tecnicas: [], prompt: combinar(brief, []), doc, proveedor: "manual" } });
  expect(res.status()).toBe(201);
  return (await res.json()) as { id: string; slug: string };
}

test.describe("1 · /crear con modo manual", () => {
  test("del brief a la landing guardada", async ({ page, request }) => {
    await page.goto("/crear?modo=experto");
    await page.getByRole("button", { name: "Rellenar ejemplo" }).click();
    await page.getByRole("button", { name: "Continuar" }).click(); // → técnicas
    await page.getByRole("button", { name: "Continuar" }).click(); // → prompt
    await expect(page.getByText("### ROL").or(page.getByText("Rol").first())).toBeVisible();
    await page.getByRole("button", { name: "Construir", exact: true }).click(); // → construir

    // Con la IA sin claves, tras el intento aparece el panel manual con el prompt para copiar.
    const iniciar = page.getByRole("button", { name: /^Construir( de nuevo)?$/ });
    if (await iniciar.isEnabled().catch(() => false)) await iniciar.click();
    const panel = page.locator("[data-panel-manual]");
    await expect(panel).toBeVisible({ timeout: 60_000 });
    await expect(panel.getByText("Ningún proveedor respondió: sigue a mano")).toBeVisible();

    await panel.getByPlaceholder("Pega aquí el JSON").fill(DOC);
    await panel.getByRole("button", { name: "Validar y ver la landing" }).click();
    await expect(page.locator("[data-salud]")).toBeVisible();

    await page.getByRole("button", { name: "Guardar y abrir en el editor" }).click();
    await expect(page).toHaveURL(/\/editor\/[a-z0-9]+/);

    const { landings } = await (await request.get("/api/landings")).json();
    expect(landings.some((l: { proveedor: string }) => l.proveedor === "manual")).toBe(true);
  });
});

test.describe("2 · leads", () => {
  test("API: un lead válido se guarda y el CSV sale con BOM", async ({ request }) => {
    const { id, slug } = await crearPorApi(request, "lead-api");
    const malo = await request.post("/api/leads", { data: { landingId: id, datos: { nombre: "Ana", correo: "no-es-correo", telefono: "3001234567" } } });
    expect(malo.status()).toBe(400);
    const ok = await request.post("/api/leads", { data: { landingId: id, datos: { nombre: "Ana Pérez", correo: "ana@correo.co", telefono: "300 123 4567" } } });
    expect(ok.status()).toBe(201);

    const { leads } = await (await request.get(`/api/landings/${id}/leads`)).json();
    expect(leads).toHaveLength(1);
    const csv = await request.get(`/api/landings/${id}/leads.csv`);
    expect(csv.headers()["content-disposition"]).toContain(`leads-${slug}-`);
    const cuerpo = await csv.body();
    expect([...cuerpo.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(cuerpo.toString("utf8")).toContain("Ana Pérez");
  });

  test("interfaz: formulario en /l/<slug> y fila en /l/<slug>/leads", async ({ page, request }) => {
    const { slug } = await crearPorApi(request, "lead-ui");
    const existe = (await request.get(`/l/${slug}`)).status() !== 404;
    test.fixme(!existe, "La ruta /l/[slug] es de B (día 4 y 7): completar cuando exista.");

    await page.goto(`/l/${slug}`);
    await page.getByLabel(/nombre/i).fill("Luis Gómez");
    await page.getByLabel(/correo/i).fill("luis@correo.co");
    await page.getByLabel(/tel[eé]fono/i).fill("3109876543");
    await page.getByRole("button", { name: /Quiero el mío/ }).click();
    await expect(page.getByText(/Gracias/)).toBeVisible();

    await page.goto(`/l/${slug}/leads`);
    await expect(page.getByText("luis@correo.co")).toBeVisible();
    const descarga = page.waitForEvent("download");
    await page.getByRole("link", { name: /CSV/i }).click();
    expect((await descarga).suggestedFilename()).toMatch(/^leads-lead-ui-.*\.csv$/);
  });
});

test.describe("3 · /ajustes", () => {
  test("carga, muestra la ayuda sin claves y «Probar todos» responde", async ({ page }) => {
    await page.goto("/ajustes");
    await expect(page.getByRole("heading", { name: "Ajustes de la IA", level: 1 })).toBeVisible();
    await expect(page.getByText("Todavía no hay ninguna clave")).toBeVisible();
    await expect(page.locator("[data-proveedor]")).toHaveCount(5);
    await expect(page.locator('[data-proveedor="gemini"]').getByText("Sin clave")).toBeVisible();

    const respuesta = page.waitForResponse((r) => r.url().endsWith("/api/ajustes/probar") && r.request().method() === "POST");
    await page.getByRole("button", { name: "Probar todos" }).click();
    expect((await respuesta).status()).toBe(200);
    await expect(page.getByRole("button", { name: "Probar todos" })).toBeEnabled();

    // El modo y la tabla de tareas se guardan.
    await page.getByRole("radio", { name: /Simultáneo/ }).check();
    await page.getByRole("button", { name: "Guardar modo" }).click();
    await expect(page.getByText(/Guardado: modo simultaneo/)).toBeVisible();
    await page.getByRole("button", { name: "Guardar tabla" }).click();
    await expect(page.getByText("Tabla guardada.")).toBeVisible();
    // Nunca aparece un campo para escribir claves.
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
  });
});

test.describe("4 · /tecnicas", () => {
  test("renderiza las 8 técnicas y el ejemplo del combinador", async ({ page }) => {
    await page.goto("/tecnicas");
    await expect(page.getByRole("heading", { name: "Las 8 técnicas", level: 1 })).toBeVisible();
    await expect(page.locator("[data-tecnica]")).toHaveCount(8);
    await expect(page.locator("[data-bloque]")).toHaveCount(4);
    const combinador = page.getByTestId("ejemplo-combinador");
    await expect(combinador.getByTestId("aportes")).toBeVisible();
    await combinador.getByRole("checkbox", { name: /Crítico con subagentes/ }).check();
    await expect(combinador.getByTestId("aportes").getByText("Crítico con subagentes").first()).toBeVisible();
  });
});

test.describe("5 · /banco", () => {
  test("muestra las 5 sembradas, filtra, voltea una tarjeta y abre el detalle", async ({ page }) => {
    await page.goto("/banco");
    await expect(page.getByRole("heading", { name: "Banco de landings", level: 1 })).toBeVisible();
    await expect(page.locator("[data-tarjeta]")).toHaveCount(5);
    await expect(page.getByText("Mostrando 5 de 5 landings")).toBeVisible();

    await page.getByLabel("Buscar").fill("colageno");
    await expect(page.locator("[data-tarjeta]")).toHaveCount(1);
    await page.getByRole("button", { name: "Limpiar filtros" }).click();
    await expect(page.locator("[data-tarjeta]")).toHaveCount(5);

    // Volteo con el teclado: Enter sobre el botón de la tarjeta.
    const primera = page.locator("[data-tarjeta]").first();
    await primera.getByRole("button", { name: /Ver el prompt de/ }).focus();
    await page.keyboard.press("Enter");
    await expect(primera).toHaveAttribute("data-volteada", "true");
    await expect(primera.locator("[data-bloque]")).toHaveCount(4);
    await primera.getByRole("link", { name: "Abrir" }).last().click();

    await expect(page).toHaveURL(/\/banco\/[a-z0-9]+$/);
    await expect(page.locator("[data-landing] iframe")).toBeVisible();
    await expect(page.locator("[data-prompt] [data-bloque]")).toHaveCount(4);
    await expect(page.getByRole("heading", { name: "Versiones" })).toBeVisible();
  });

  test("en móvil el detalle usa pestañas «Landing» y «Prompt»", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/banco");
    await page.locator("[data-tarjeta]").first().getByRole("link", { name: "Abrir" }).first().click();
    await expect(page.getByRole("tab", { name: "Landing" })).toBeVisible();
    await expect(page.locator("[data-landing] iframe")).toBeVisible();
    await expect(page.locator("[data-panel=prompt]")).toBeHidden();
    await page.getByRole("tab", { name: "Prompt" }).click();
    await expect(page.locator("[data-panel=prompt]")).toBeVisible();
    await expect(page.locator("[data-panel=landing]")).toBeHidden();
  });

  test("sin errores de consola en /banco ni en /banco/<id> (incluida la landing del iframe)", async ({ page }) => {
    const errores: string[] = [];
    // `console.error` de cualquier marco (también el iframe de la landing) y las excepciones sin capturar.
    page.on("console", (m) => {
      if (m.type() === "error") errores.push(`consola: ${m.text().slice(0, 300)}`);
    });
    page.on("pageerror", (e) => errores.push(`excepción: ${e.message.slice(0, 300)}`));
    await page.goto("/banco", { waitUntil: "networkidle" });
    await expect(page.locator("[data-tarjeta]")).toHaveCount(5);
    await page.locator("[data-tarjeta]").first().getByRole("link", { name: "Abrir" }).first().click();
    await expect(page.locator("[data-landing] iframe")).toBeVisible();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500); // deja que el iframe hidrate y salgan los avisos tardíos
    // Estos errores son los que hacen aparecer el indicador «Issue» de Next en desarrollo; también se mira el propio indicador.
    const indicador = await page.evaluate(
      () => (document.querySelector("nextjs-portal")?.shadowRoot?.textContent ?? "").match(/\d+ Issues?/g)?.[0] ?? null,
    );
    expect(indicador).toBeNull();
    expect(errores).toEqual([]);
  });

  test("duplicar como nueva abre la copia en el editor", async ({ page }) => {
    await page.goto("/banco");
    await page.locator("[data-tarjeta]").first().getByRole("link", { name: "Abrir" }).first().click();
    await page.getByRole("button", { name: "Duplicar como nueva" }).click();
    await expect(page).toHaveURL(/\/editor\/[a-z0-9]+/);
  });
});

test.describe("flujos de B (pendientes)", () => {
  test.fixme("editor: /editor/<id> permite editar un texto, autoguarda y regenera una sección", async () => {
    // Pasos esperados: abrir /editor/<id> → cambiar el titular del héroe → ver «Guardado» →
    // «Regenerar sección» respeta el texto editado → «Guardar en banco».
  });
});
