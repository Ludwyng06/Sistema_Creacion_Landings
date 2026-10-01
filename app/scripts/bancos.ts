// npm run bancos [-- --banco b1,b3] [-- --n 16] [-- --sin-ia] [-- --solo-ia] [-- --curiosos] [-- --sin-curiosos]
//                 [-- --conservar <banco> <archivo,archivo,…>] [-- --quitar <banco> <archivo,archivo,…>]  (curaduría a mano: se quitan del banco y no vuelven)
// Llena los bancos de medios (docs/bitacora/tarea-12-A.md §2): por cada banco recorre sus consultas semilla, descarga y optimiza
// a WebP (máximo 1920 px) en public/media/bancos/<banco>/ y guarda el registro con su crédito y licencia. La IA describe cada
// imagen en español. Al final arma el banco b8 de datos curiosos en src/datos/datos-curiosos.json.
// Es idempotente: lo que ya está no se vuelve a bajar. Las imágenes de los bancos van en .gitignore y se regeneran con este comando.
import "./_env";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { BANCOS, BANCOS_ESPACIALES, IMAGENES_POR_BANCO, bancoPorId } from "../src/lib/bancos/definicion";
import { META_MINIMA, hechosDeLanzamientos, hechosDeNeoWs, oracionesConDatos, reescribirCuriosos, type Hecho } from "../src/lib/bancos/curiosos";
import { completarDescripciones, llenarBanco, type ResumenBanco } from "../src/lib/bancos/llenar";
import { contarBanco, textosOrigen } from "../src/lib/bancos/repositorio";
import { curarBanco } from "../src/lib/bancos/curar";
import { consultarSuave } from "../src/lib/fuentes/ejecutar";
import { crearFuentes } from "../src/lib/fuentes/registro";
import { explicarError } from "./_env";

const args = process.argv.slice(2);
const valor = (flag: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};
const tiene = (flag: string) => args.includes(flag);

const DESTINO_CURIOSOS = resolve(process.cwd(), "src", "datos", "datos-curiosos.json");

async function recolectarHechos(): Promise<Hecho[]> {
  const fuentes = crearFuentes();
  const hechos: Hecho[] = [];
  // 1. Descripciones de NASA Images: hasta 2 oraciones con datos por medio, repartidas entre los bancos.
  const textos = await textosOrigen(BANCOS_ESPACIALES);
  const porBanco = new Map<string, Hecho[]>();
  const vistos = new Set<string>();
  for (const t of textos) {
    const oraciones = oracionesConDatos(t.texto).slice(0, 3);
    if (oraciones.length > 0 && vistos.has(oraciones[0])) continue; // varias fotos de una misma serie comparten la ficha
    if (oraciones.length > 0) vistos.add(oraciones[0]);
    oraciones.forEach((o, i) => {
      const lista = porBanco.get(t.bancoId) ?? [];
      lista.push({ id: `${t.bancoId}-${t.idFuente}-${i + 1}`, texto: o, tema: t.bancoId, fuente: { nombre: `NASA · ${t.titulo}`, url: t.urlOrigen ?? undefined } });
      porBanco.set(t.bancoId, lista);
    });
  }
  const max = Math.max(0, ...[...porBanco.values()].map((l) => l.length));
  for (let i = 0; i < Math.min(max, 10); i++) for (const l of porBanco.values()) if (l[i]) hechos.push(l[i]);
  // 2. NeoWs de hoy y 3. próximos lanzamientos.
  const hoy = new Date();
  const neo = await consultarSuave(fuentes.neows, { fecha: hoy.toISOString().slice(0, 10) });
  if (neo) hechos.push(...hechosDeNeoWs(neo.datos, hoy));
  const ll = await consultarSuave(fuentes.lanzamientos, { max: 5 });
  if (ll) hechos.push(...hechosDeLanzamientos(ll.datos));
  return hechos;
}

async function armarCuriosos(): Promise<number> {
  const hechos = await recolectarHechos();
  console.log(`\nb8 · datos curiosos: ${hechos.length} datos reales para reescribir…`);
  const datos = await reescribirCuriosos(hechos, undefined, (l) => console.log(`  ${l}`));
  if (datos.length === 0) {
    console.log("  Ninguna frase salió (¿la IA no tiene cuota?). Se deja el archivo anterior. Reintenta con:  npm run bancos -- --curiosos");
    return 0;
  }
  await mkdir(dirname(DESTINO_CURIOSOS), { recursive: true });
  await writeFile(DESTINO_CURIOSOS, `${JSON.stringify(datos, null, 2)}\n`, "utf8");
  console.log(`  ${datos.length} frases con su fuente → src/datos/datos-curiosos.json${datos.length < META_MINIMA ? `  (faltan ${META_MINIMA - datos.length} para el mínimo de ${META_MINIMA}: reintenta cuando haya cuota)` : ""}`);
  return datos.length;
}

async function main() {
  const dirMedia = join(process.cwd(), "public", "media");
  const pedidos = valor("--banco")?.split(",").map((s) => s.trim()).filter(Boolean);
  const bancos = pedidos ? pedidos.map((id) => bancoPorId(id) ?? (() => { throw new Error(`No existe el banco «${id}». Los válidos: ${BANCOS.map((b) => b.id).join(", ")}.`); })()) : BANCOS;
  const n = Number(valor("--n") ?? IMAGENES_POR_BANCO);
  if (!Number.isInteger(n) || n < 1 || n > 80) throw new Error("--n debe ser un entero entre 1 y 80.");

  for (const flag of ["--conservar", "--quitar"] as const) {
    const i = args.indexOf(flag);
    if (i === -1) continue;
    const banco = args[i + 1];
    const archivos = (args[i + 2] ?? "").split(",").map((a) => a.trim()).filter(Boolean);
    if (!banco || archivos.length === 0) throw new Error(`${flag} necesita el banco y los archivos, separados por comas.`);
    const r = await curarBanco(banco, archivos, flag === "--conservar" ? "conservar" : "quitar", dirMedia);
    console.log(`${banco}: ${r.quitados} quitados, ${r.quedan} quedan.`);
    return;
  }

  if (tiene("--solo-ia")) {
    const r = await completarDescripciones(pedidos?.[0], { log: (l) => console.log(l) });
    console.log(`Descripciones completadas: ${r.hechos}; pendientes: ${r.pendientes}.`);
    return;
  }

  const filas: ResumenBanco[] = [];
  if (!tiene("--curiosos")) {
    for (const def of bancos) {
      console.log(`\n${def.id} · ${def.nombre} (${def.fuentes.join(" + ")})`);
      filas.push(await llenarBanco(def, { dirMedia, n, usarIA: !tiene("--sin-ia"), log: (l) => console.log(l) }));
    }
    console.log("\nBanco     Guardadas  Ya estaban  Descartadas  Sin describir  En el banco");
    for (const f of filas) {
      console.log(`${f.banco.padEnd(14)}${String(f.guardados).padEnd(11)}${String(f.yaEstaban).padEnd(12)}${String(f.descartados).padEnd(13)}${String(f.sinDescribir).padEnd(15)}${await contarBanco(f.banco)}`);
      if (f.consultasFallidas.length) console.log(`          consultas sin respuesta: ${f.consultasFallidas.join(", ")}`);
    }
  }
  if (!tiene("--sin-curiosos") && (!pedidos || tiene("--curiosos"))) await armarCuriosos();
  if (filas.some((f) => f.sinDescribir > 0)) console.log("\nHay medios sin descripción en español (cuota de la IA agotada). Cuando vuelva:  npm run bancos -- --solo-ia");
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(explicarError(e));
    process.exit(1);
  },
);
