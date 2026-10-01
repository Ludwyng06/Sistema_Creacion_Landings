// npm run critico:visual [-- --solo <slug>] [-- --url http://localhost:3000]
// Crítico multimodal de la vitrina: captura el primer viewport de cada /l/<slug> (escritorio 1280 y móvil 390), se lo muestra a Gemini
// junto al JSON (misma rúbrica y umbral) y guarda la nota en la landing y en datos/vitrina/<slug>.json. Sin visión, degrada a solo JSON.
import "./_env";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { VITRINA } from "../src/datos/vitrina";
import { actualizarDoc, obtenerPorSlug } from "../src/lib/landings";
import { textoBrief } from "../src/lib/ia/prompts/contexto";
import { componerCaptura, criticarConCaptura } from "../src/lib/vitrina/critico-visual";
import { abrirNavegador, levantarServidor } from "./capturas";
import { explicarError } from "./_env";

async function main() {
  const args = process.argv.slice(2);
  const solo = args.includes("--solo") ? args[args.indexOf("--solo") + 1] : undefined;
  const iUrl = args.indexOf("--url");
  const servidor = iUrl !== -1 ? null : await levantarServidor();
  const url = iUrl !== -1 ? args[iUrl + 1] : servidor!.url;
  const navegador = await abrirNavegador();
  try {
    for (const e of VITRINA.filter((x) => !solo || x.slug === solo)) {
      const l = await obtenerPorSlug(e.slug);
      if (!l) {
        console.log(`${e.slug}: no está en la base.`);
        continue;
      }
      let captura: Buffer | null = null;
      try {
        const vistas: Buffer[] = [];
        for (const ancho of [1280, 390]) {
          const p = await navegador.newPage({ viewport: { width: ancho, height: ancho === 1280 ? 720 : 844 } });
          await p.goto(`${url}/l/${e.slug}`, { waitUntil: "networkidle", timeout: 60_000 });
          await p.waitForTimeout(1200);
          vistas.push(await p.screenshot());
          await p.close();
        }
        captura = await componerCaptura(vistas[0], vistas[1]);
      } catch (err) {
        console.log(`${e.slug}: no se pudo capturar (${err instanceof Error ? err.message.split("\n")[0] : err}); se usa solo JSON.`);
      }
      const r = await criticarConCaptura(l.doc, textoBrief(l.brief), captura);
      console.log(`${e.slug}: ${r.critica.puntaje.toFixed(2)} (${r.proveedor}, ${r.vio ? "con captura" : `solo JSON: ${r.motivoDegradado}`}) · ${r.critica.porCriterio.map((c) => `${c.criterio.split(" ")[0]} ${c.puntaje}`).join(", ")}`);
      await actualizarDoc(l.id, { ...l.doc, critica: r.critica });
      const ruta = join(process.cwd(), "datos", "vitrina", `${e.slug}.json`);
      if (existsSync(ruta)) {
        const j = JSON.parse(await readFile(ruta, "utf8"));
        j.doc.critica = r.critica;
        j.informe = { ...j.informe, puntaje: r.critica.puntaje, criticoVisual: r.vio };
        await writeFile(ruta, `${JSON.stringify(j, null, 2)}\n`, "utf8");
      }
    }
  } finally {
    await navegador.close();
    servidor?.proceso.kill();
  }
}

main().then(() => process.exit(0), (e) => {
  console.error(explicarError(e));
  process.exit(1);
});
