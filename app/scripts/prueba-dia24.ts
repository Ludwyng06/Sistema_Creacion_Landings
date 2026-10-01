// npm run prueba:dia24 -- "<descripcion>" [--modo low|none-0.7] [--tipo producto]
// Genera UNA landing real con el pipeline (OpenAI) y muestra: crítico, tiempo, costo, huella, candidatas por fuente y slot, alt.
import "./_env";
import { join } from "node:path";
import { contadorCompartido } from "../src/lib/ia/gasto";
import { crearManejadorGenerar } from "../src/lib/generar/http";
import { huellaDeDoc, distanciaHuellas } from "../src/lib/generar/diversidad";
import { listarLandings, obtenerLanding } from "../src/lib/landings";
import { almacenCheckpointAjuste } from "../src/lib/generar/checkpoint";

async function main() {
  const args = process.argv.slice(2);
  const flag = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
  const descripcion = args.find((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")));
  if (!descripcion) throw new Error("Falta la descripción.");
  const modo = flag("--modo");
  if (modo) process.env.GENERAR_MODO_TEXTO = modo;
  const tipo = flag("--tipo");
  const antes = JSON.parse(JSON.stringify(await contadorCompartido("openai").hoy())) as Awaited<ReturnType<ReturnType<typeof contadorCompartido>["hoy"]>>;
  const t0 = Date.now();
  const res = await crearManejadorGenerar()(new Request("http://x/api/generar", { method: "POST", body: JSON.stringify({ descripcion, ...(tipo && { tipo }) }) }));
  let id = "";
  const texto = await res.text();
  for (const l of texto.split("\n").filter(Boolean)) {
    const e = JSON.parse(l);
    if (e.tipo === "listo") { id = e.id; if (e.avisos) console.log("avisos:", e.avisos); }
    if (e.tipo === "error") throw new Error(e.mensaje);
  }
  const seg = (Date.now() - t0) / 1000;
  const despues = await contadorCompartido("openai").hoy();
  const l = await obtenerLanding(id);
  const cp = await almacenCheckpointAjuste.leer(id);
  const lista = (await listarLandings({ conDoc: true })).filter((x) => x.id !== id).slice(0, 12);
  const h = huellaDeDoc(l.doc);
  const dist = lista.length ? Math.min(...lista.map((x) => distanciaHuellas(h, huellaDeDoc(x.doc)))) : 1;
  const salida = {
    id, slug: l.slug, modo: process.env.GENERAR_MODO_TEXTO ?? "low", segundos: Math.round(seg), usd: +(despues.usd - antes.usd).toFixed(4),
    porModelo: Object.fromEntries(Object.entries(despues.porModelo).map(([m, v]) => [m, { usd: +(v.usd - (antes.porModelo[m]?.usd ?? 0)).toFixed(4), peticiones: v.peticiones - (antes.porModelo[m]?.peticiones ?? 0), entrada: v.entrada - (antes.porModelo[m]?.entrada ?? 0), salida: v.salida - (antes.porModelo[m]?.salida ?? 0) }])),
    critico: l.doc.critica?.puntaje ?? null, distanciaMin: +dist.toFixed(2), tiempos: cp?.tiempos, fuentes: cp?.imagenes?.fuentes,
    slots: Object.fromEntries(Object.entries(cp?.imagenes?.notas ?? {}).map(([k, v]) => [k, { criterio: v.criterio, nota: v.nota, porFuente: v.porFuente, candidatas: v.candidatas }])),
    alts: l.doc.assets.map((a) => ({ slot: a.slot, fuente: a.fuente, alt: a.alt, palabras: a.alt.trim().split(/\s+/).length })),
    estilo: l.doc.meta.semilla.estilo, huella: h,
  };
  console.log(JSON.stringify(salida, null, 1));
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
