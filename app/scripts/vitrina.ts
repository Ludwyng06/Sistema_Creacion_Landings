// npm run vitrina [-- --solo <slug>] [-- --forzar] [-- --reanudar] [-- --umbral 9.5] [-- --espera <minutos>] [-- --intentos 4] [-- --vueltas 3] [-- --lista]
// Construye las 8 landings completas de la vitrina (docs/bitacora/plan-v2.md) y las deja en el banco:
//   1. investiga con las fuentes que le tocan a cada producto,
//   2. construye con IA real con un plan de 12 a 16 secciones,
//   3. asigna medios de los bancos (npm run bancos debe haberse corrido antes),
//   4. arma la sección de créditos con los Asset usados,
//   5. guarda en el banco (en-banco) y en datos/vitrina/<slug>.json, para sembrar sin claves (npm run db:semilla -- --vitrina),
//   6. mide: validadores, lista negra y puntaje del crítico; si el crítico da menos de 8,0 o hay un rojo, regenera una vez.
// Si se agota la cuota de la IA, espera y sigue (--espera, 2 minutos por defecto); no baja el criterio. Es idempotente:
// una landing que ya está en el banco se salta (usa --forzar para rehacerla).
import "./_env";
import { join, resolve } from "node:path";
import curiosos from "../src/datos/datos-curiosos.json";
import { VITRINA } from "../src/datos/vitrina";
import { DatoCurioso } from "../src/lib/contratos";
import { proveedoresDisponibles } from "../src/lib/ia/registro";
import { guardarEnBanco, obtenerPorSlug, upsertLandingPorSlug } from "../src/lib/landings";
import { rutasReferenciadas } from "../src/lib/vitrina/referencias";
import { existsSync, readFileSync } from "node:fs";
import { pesoVitrina, TOPE_BYTES_VITRINA } from "../src/lib/vitrina/medios";
import { construirEntrada, ErrorVitrina, escribirArchivo, type ResultadoVitrina } from "../src/lib/vitrina/construir";
import type { EntradaVitrina } from "../src/lib/vitrina/tipos";
import { explicarError } from "./_env";

const args = process.argv.slice(2);
const valor = (flag: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};
const tiene = (flag: string) => args.includes(flag);

const dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const DIR_DATOS = resolve(process.cwd(), "datos", "vitrina");
const DIR_MEDIA = join(process.cwd(), "public", "media");

interface Fila {
  slug: string;
  estado: "en-banco" | "omitida" | "pendiente" | "error";
  r?: ResultadoVitrina;
  detalle?: string;
}

async function construirConEspera(e: EntradaVitrina, frasesUsadas: Set<string>, esperaMs: number, umbral: number): Promise<ResultadoVitrina> {
  const datos = DatoCurioso.array().parse(curiosos);
  for (let intento = 1; ; intento++) {
    try {
      return await construirEntrada(e, { dirMedia: DIR_MEDIA, curiosos: datos, frasesUsadas, log: (l) => console.log(l), esperaCuotaMs: esperaMs, maxPausas: 24, umbral, protegidas: await rutasReferenciadas(DIR_DATOS), ...(valor("--intentos") ? { maxIntentos: Number(valor("--intentos")) } : {}), ...(valor("--vueltas") ? { maxVueltas: Number(valor("--vueltas")) } : {}) });
    } catch (err) {
      if (!(err instanceof ErrorVitrina) || err.tipo !== "cuota" || intento >= 4) throw err;
      console.log(`  ${e.slug}: ${err.message}. Pausa de ${Math.round(esperaMs / 60000)} min y se sigue (intento ${intento} de 3)…`);
      await dormir(esperaMs);
    }
  }
}

/** ¿El JSON de la corrida anterior ya cumple el umbral sin rojos? */
function yaCumple(slug: string, umbral: number): boolean {
  const ruta = join(DIR_DATOS, `${slug}.json`);
  if (!existsSync(ruta)) return false;
  try {
    const i = (JSON.parse(readFileSync(ruta, "utf8")) as { informe?: { puntaje: number | null; rojos: number } }).informe;
    return !!i && (i.puntaje ?? 0) >= umbral && i.rojos === 0;
  } catch {
    return false;
  }
}

async function main() {
  if (tiene("--lista")) {
    for (const e of VITRINA) console.log(`${e.numero} · ${e.slug} · ${e.tematica}`);
    return;
  }
  if (proveedoresDisponibles(process.env).length === 0) {
    console.log("No hay claves de IA configuradas, así que no se construyó nada.");
    console.log("Falta al menos una de: GEMINI_API_KEY, GROQ_API_KEY, CEREBRAS_API_KEY, OPENROUTER_API_KEY en app/.env.local.");
    console.log("Alternativa sin claves: npm run db:semilla -- --vitrina  (siembra desde datos/vitrina/*.json).");
    return;
  }
  const solo = valor("--solo");
  const lista = VITRINA.filter((e) => !solo || e.slug === solo);
  if (solo && lista.length === 0) throw new Error(`No existe «${solo}». Los válidos: ${VITRINA.map((e) => e.slug).join(", ")}.`);
  const esperaMs = Number(valor("--espera") ?? 2) * 60_000;
  const umbral = Number((valor("--umbral") ?? "9.5").replace(",", "."));

  const filas: Fila[] = [];
  const frasesUsadas = new Set<string>();
  for (const e of lista) {
    console.log(`\n${e.numero}/8 · ${e.slug} (${e.tematica})`);
    try {
      const existente = await obtenerPorSlug(e.slug);
      if (existente && !tiene("--forzar")) {
        filas.push({ slug: e.slug, estado: "omitida", detalle: "ya está en el banco (usa --forzar para rehacerla)" });
        continue;
      }
      // Reanudar: lo que ya llegó al umbral en una corrida anterior se salta y conserva su progreso.
      if (tiene("--reanudar") && existente && yaCumple(e.slug, umbral)) {
        filas.push({ slug: e.slug, estado: "omitida", detalle: "ya cumple el umbral (reanudar)" });
        continue;
      }
      const r = await construirConEspera(e, frasesUsadas, esperaMs, umbral);
      // Upsert por slug: la base, el JSON y las imágenes quedan sincronizados sin borrar la landing (conserva id y leads).
      const creada = await upsertLandingPorSlug({ brief: r.brief, tecnicas: e.tecnicas, prompt: r.prompt, doc: r.doc, proveedor: r.proveedor });
      const banco = await guardarEnBanco(creada.id);
      await escribirArchivo(join(DIR_DATOS, `${e.slug}.json`), r);
      const estado: Fila["estado"] = !banco.ok ? "error" : r.pendiente ? "pendiente" : "en-banco";
      filas.push({ slug: e.slug, estado, r, detalle: banco.ok ? undefined : `no entró al banco: ${banco.motivos.map((m) => `${m.validador} ${m.ruta} ${m.mensaje}`).join("; ")}` });
    } catch (err) {
      filas.push({ slug: e.slug, estado: "error", detalle: err instanceof Error ? err.message : String(err) });
    }
  }

  console.log("\nslug · nota · intentos · secciones · imágenes reales/generadas/marcadores · efectos (nivel 3) · segundos · estado");
  for (const f of filas) {
    const r = f.r;
    console.log(
      [
        f.slug,
        r?.puntaje?.toFixed(2) ?? "-",
        r?.intentos ?? "-",
        r ? r.doc.secciones.length : "-",
        r ? `${r.imagenes.reales}/${r.imagenes.generadas}/${r.imagenes.marcadores}` : "-",
        r ? `${r.efectos.length} (${r.nivel3})` : "-",
        r?.segundos ?? "-",
        f.estado,
      ].join(" · "),
    );
    if (f.detalle) console.log(`   ${f.detalle}`);
    for (const n of r?.notas ?? []) console.log(`   intento ${n.intento} vuelta ${n.vuelta}: ${n.puntaje.toFixed(2)} · ${n.criterios.map((c) => `${c.criterio.split(" ")[0]} ${c.puntaje}`).join(", ")}`);
    for (const a of r?.avisos ?? []) console.log(`   aviso: ${a}`);
  }
  console.log("\nNota por criterio (la mejor vuelta de cada landing):");
  const crit = (r: ResultadoVitrina) => [...r.notas].sort((a, b) => b.puntaje - a.puntaje)[0]?.criterios ?? [];
  for (const f of filas) if (f.r) console.log(`${f.slug}: ${crit(f.r).map((c) => `${c.criterio.split(" ")[0]} ${c.puntaje}`).join(" · ") || "sin crítico"}`);
  const mb = pesoVitrina(DIR_MEDIA) / (1024 * 1024);
  console.log(`\nPeso de public/media/vitrina: ${mb.toFixed(1)} MB (tope ${TOPE_BYTES_VITRINA / (1024 * 1024)} MB).`);
  if (pesoVitrina(DIR_MEDIA) > TOPE_BYTES_VITRINA) throw new Error("La vitrina pasa el tope de 25 MB: reduce la calidad o los medios.");
  const malas = filas.filter((f) => f.estado === "error" || f.estado === "pendiente");
  console.log(`\nEn el banco: ${filas.filter((f) => f.estado === "en-banco").length} · Omitidas: ${filas.filter((f) => f.estado === "omitida").length} · Pendientes o con error: ${malas.length}`);
  if (malas.length) process.exitCode = 1;
}

main().then(
  () => process.exit(process.exitCode ?? 0),
  (e) => {
    console.error(explicarError(e));
    process.exit(1);
  },
);
