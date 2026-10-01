// npm run fuentes [-- --desde <api.json>]
// Consulta la API de Google Fonts (necesita GOOGLE_FONTS_API_KEY en app/.env.local) y regenera `src/datos/fuentes.json`
// con las 200 mejores tipografías para español. La app NO llama a la API en ejecución: usa ese JSON versionado.
// Con `--desde <archivo>` lee una respuesta ya grabada de la API (sin clave y sin red).
import "./_env";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { CATEGORIAS, seleccionarFuentes, type FamiliaApi } from "@/lib/fuentes/seleccionar";

const URL_API = "https://www.googleapis.com/webfonts/v1/webfonts";
const SALIDA = resolve(process.cwd(), "src", "datos", "fuentes.json");

async function leerApi(): Promise<FamiliaApi[]> {
  const i = process.argv.indexOf("--desde");
  if (i > 0 && process.argv[i + 1]) return ((JSON.parse(await readFile(process.argv[i + 1], "utf8")) as { items: FamiliaApi[] }).items);
  const clave = process.env.GOOGLE_FONTS_API_KEY?.trim();
  if (!clave) throw new Error("Falta GOOGLE_FONTS_API_KEY en app/.env.local (console.cloud.google.com → API «Web Fonts Developer»).");
  const params = new URLSearchParams({ key: clave, sort: "popularity" });
  params.append("capability", "WOFF2");
  params.append("capability", "VF");
  let res: Response;
  try {
    res = await fetch(`${URL_API}?${params}`, { signal: AbortSignal.timeout(30_000) });
  } catch (e) {
    throw new Error(`No se pudo conectar con la API de Google Fonts: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!res.ok) throw new Error(`La API de Google Fonts respondió ${res.status}. Revisa la clave y que la API «Web Fonts Developer» esté activa.`);
  return ((await res.json()) as { items: FamiliaApi[] }).items;
}

async function main() {
  const items = await leerApi();
  const r = seleccionarFuentes(items);
  const contenido = {
    generado: new Date().toISOString().slice(0, 10),
    origen: "Google Fonts Developer API (sort=popularity, capability=WOFF2+VF)",
    total: r.fuentes.length,
    fuentes: r.fuentes,
  };
  await writeFile(SALIDA, `${JSON.stringify(contenido, null, 1)}\n`, "utf8");
  const por = (c: string) => r.fuentes.filter((f) => f.categoria === c).length;
  console.log(`Familias en la API: ${items.length}. Candidatas: ${r.candidatas}. Descartadas: ${JSON.stringify(r.descartadas)}.`);
  console.log(`Catálogo: ${r.fuentes.length} → ${CATEGORIAS.map((c) => `${c} ${por(c)}`).join(" · ")}`);
  console.log(`Escrito en ${SALIDA}`);
}

main().catch((e) => {
  console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
