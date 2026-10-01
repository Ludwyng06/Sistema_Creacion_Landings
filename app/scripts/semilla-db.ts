// npm run db:semilla [-- --forzar] [-- --solo <id>] [-- --desde-json [carpeta]] [-- --vitrina]
// Siembra el banco con los 5 ejemplos de src/datos/ejemplos.ts. Es idempotente: salta los ejemplos que ya existen.
// Sin claves de IA no falla: explica qué falta y ofrece --desde-json (LandingDoc pegados a mano, modo manual).
import { explicarError } from "./_env";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { EJEMPLOS, type EjemploBanco } from "../src/datos/ejemplos";
import { LandingDoc, type EventoConstruccion, type ResultadoValidador } from "../src/lib/contratos";
import { construir } from "../src/lib/ia/construir";
import type { DepsEnrutador } from "../src/lib/ia/enrutador";
import { validarPegado } from "../src/lib/ia/manual";
import { proveedoresDisponibles } from "../src/lib/ia/registro";
import { ErrorIA } from "../src/lib/ia/tipos";
import { crearLanding, eliminarLanding, guardarEnBanco, obtenerPorSlug } from "../src/lib/landings";
import { combinar } from "../src/lib/tecnicas/combinador";
import { tirarSemilla } from "../src/lib/tecnicas/semillas";
import { validarTodo } from "../src/lib/validadores";
import { sembrarVitrina } from "../src/lib/vitrina/archivo";

export interface OpcionesSemilla {
  ejemplos?: readonly EjemploBanco[];
  forzar?: boolean;
  solo?: string;
  /** Carpeta con `<id>.json` de LandingDoc pegados a mano. Activa el modo manual. */
  desdeJson?: string;
  enrutador?: DepsEnrutador;
  /** Raíz de `public/media` (para enlazar recursos). */
  mediaRaiz?: string;
  log?: (linea: string) => void;
}

export interface FilaSemilla {
  id: string;
  estado: "creada" | "omitida" | "error" | "sin-archivo";
  proveedor?: string;
  puntaje?: number | null;
  salud?: { verde: number; amarillo: number; rojo: number; pendiente: number };
  banco?: boolean;
  heroeCorregido?: string;
  recursos?: number;
  detalle?: string;
}

export interface ResultadoSemilla {
  filas: FilaSemilla[];
  /** Sin claves de IA y sin --desde-json: no se hizo nada. */
  sinClaves: boolean;
}

export const CARPETA_MANUAL = "datos/semilla-manual";

const conteo = (salud: ResultadoValidador[]) => ({
  verde: salud.filter((s) => s.estado === "verde").length,
  amarillo: salud.filter((s) => s.estado === "amarillo").length,
  rojo: salud.filter((s) => s.estado === "rojo").length,
  pendiente: salud.filter((s) => s.estado === "pendiente").length,
});

/** Forzar la variante del ejemplo: devuelve el doc y la variante que traía la IA si la cambió. */
export function forzarHeroe(doc: LandingDoc, variante: string): { doc: LandingDoc; cambio?: string } {
  const i = doc.secciones.findIndex((s) => s.tipo === "heroe");
  if (i === -1 || doc.secciones[i].variante === variante) return { doc };
  const anterior = doc.secciones[i].variante ?? "sin variante";
  return { doc: { ...doc, secciones: doc.secciones.map((s, k) => (k === i ? { ...s, variante } : s)) }, cambio: anterior };
}

/** Enlaza `assets[].ruta` con `public/media/ejemplos/<id>/<slot>.*` (prefiere .webp; un video usa su .mp4 o, si solo hay póster, el póster). */
export function enlazarRecursos(doc: LandingDoc, ejemplo: EjemploBanco, mediaRaiz: string): { doc: LandingDoc; enlazados: number } {
  const carpeta = join(mediaRaiz, "ejemplos", ejemplo.id);
  let enlazados = 0;
  const assets = doc.assets.map((a) => {
    const candidatos = a.tipo === "video" ? [`${a.slot}.mp4`, `${a.slot}-poster.webp`] : [`${a.slot}.webp`, `${a.slot}.png`, `${a.slot}.jpg`, `${a.slot}.jpeg`, `${a.slot}.avif`];
    const archivo = candidatos.find((c) => existsSync(join(carpeta, c)));
    if (!archivo) return a;
    enlazados++;
    return { ...a, ruta: `/media/ejemplos/${ejemplo.id}/${archivo}` };
  });
  return { doc: { ...doc, assets }, enlazados };
}

async function guardar(
  ejemplo: EjemploBanco,
  docCrudo: LandingDoc,
  proveedor: string,
  mediaRaiz: string,
  /** Se ejecuta con el documento ya validado, justo antes de guardar (p. ej. para borrar la versión anterior con --forzar). */
  antes?: () => Promise<void>,
): Promise<FilaSemilla> {
  const semilla = tirarSemilla(ejemplo.numeroSemilla, ejemplo.brief.intensidad).semilla;
  const prompt = combinar(ejemplo.brief, ejemplo.tecnicas, semilla);
  const forzado = forzarHeroe({ ...docCrudo, meta: { ...docCrudo.meta, slug: ejemplo.id } }, ejemplo.varianteHeroe);
  const enlazado = enlazarRecursos(forzado.doc, ejemplo, mediaRaiz);
  const { doc, salud } = validarTodo(enlazado.doc, ejemplo.brief);
  await antes?.();
  const creada = await crearLanding({ brief: ejemplo.brief, tecnicas: ejemplo.tecnicas, prompt, doc, proveedor });
  const banco = salud.every((s) => s.estado !== "rojo") ? (await guardarEnBanco(creada.id)).ok : false;
  return {
    id: ejemplo.id,
    estado: "creada",
    proveedor,
    puntaje: doc.critica?.puntaje ?? null,
    salud: conteo(salud),
    banco,
    heroeCorregido: forzado.cambio ? `${forzado.cambio} → ${ejemplo.varianteHeroe}` : undefined,
    recursos: enlazado.enlazados,
  };
}

async function desdeIA(
  ejemplo: EjemploBanco,
  enrutador: DepsEnrutador | undefined,
  mediaRaiz: string,
  antes?: () => Promise<void>,
): Promise<FilaSemilla> {
  const semilla = tirarSemilla(ejemplo.numeroSemilla, ejemplo.brief.intensidad).semilla;
  const prompt = combinar(ejemplo.brief, ejemplo.tecnicas, semilla);
  let resultado: Extract<EventoConstruccion, { tipo: "resultado" }> | undefined;
  let fallo: string | undefined;
  await construir(
    { brief: ejemplo.brief, tecnicas: ejemplo.tecnicas, numeroSemilla: ejemplo.numeroSemilla, prompt },
    (e) => {
      if (e.tipo === "resultado") resultado = e;
      else if (e.tipo === "error") fallo = e.mensaje;
      else if (e.tipo === "manual") fallo = `la cascada se agotó (${e.intentos.map((i) => `${i.proveedor}: ${i.tipo}`).join(", ")}); usa --desde-json`;
    },
    { enrutador },
  );
  if (!resultado) return { id: ejemplo.id, estado: "error", detalle: fallo ?? "sin resultado" };
  // Con --forzar la anterior se borra solo con un resultado válido, justo antes de guardar la nueva.
  const fila = await guardar(ejemplo, resultado.doc, resultado.proveedores.landing ?? "desconocido", mediaRaiz, antes);
  return { ...fila, puntaje: resultado.doc.critica?.puntaje ?? null };
}

async function desdeArchivo(ejemplo: EjemploBanco, carpeta: string, mediaRaiz: string, antes?: () => Promise<void>): Promise<FilaSemilla> {
  const ruta = join(carpeta, `${ejemplo.id}.json`);
  if (!existsSync(ruta)) return { id: ejemplo.id, estado: "sin-archivo", detalle: `no existe ${ruta}` };
  try {
    const doc = validarPegado(await readFile(ruta, "utf8"), LandingDoc);
    return await guardar(ejemplo, doc, "manual", mediaRaiz, antes);
  } catch (e) {
    const mensaje = e instanceof ErrorIA ? e.message : e instanceof Error ? e.message : String(e);
    return { id: ejemplo.id, estado: "error", detalle: `${ruta} no es un LandingDoc válido:\n${mensaje}` };
  }
}

export async function sembrar(o: OpcionesSemilla = {}): Promise<ResultadoSemilla> {
  const log = o.log ?? console.log;
  const mediaRaiz = resolve(o.mediaRaiz ?? join(process.cwd(), "public", "media"));
  const lista = (o.ejemplos ?? EJEMPLOS).filter((e) => !o.solo || e.id === o.solo);
  if (o.solo && lista.length === 0) throw new Error(`No existe el ejemplo «${o.solo}».`);

  const hayIA = (o.enrutador?.proveedores ?? proveedoresDisponibles(o.enrutador?.env ?? process.env)).length > 0;
  if (!o.desdeJson && !hayIA) {
    log("No hay claves de IA configuradas, así que no se generó nada.");
    log("Falta al menos una de: GEMINI_API_KEY, GROQ_API_KEY, CEREBRAS_API_KEY, OPENROUTER_API_KEY en app/.env.local.");
    log(`Alternativa sin claves: guarda un LandingDoc por ejemplo en ${CARPETA_MANUAL}/<id>.json y ejecuta  npm run db:semilla -- --desde-json`);
    log(`Ejemplos: ${lista.map((e) => e.id).join(", ")}`);
    return { filas: [], sinClaves: true };
  }

  const filas: FilaSemilla[] = [];
  for (const ejemplo of lista) {
    const existente = await obtenerPorSlug(ejemplo.id);
    if (existente && !o.forzar) {
      filas.push({ id: ejemplo.id, estado: "omitida", detalle: "ya existe (usa --forzar para rehacerla)" });
      continue;
    }
    if (o.desdeJson !== undefined) {
      // Con --forzar la anterior se borra solo si el archivo nuevo es válido.
      filas.push(await desdeArchivo(ejemplo, o.desdeJson, mediaRaiz, existente ? () => eliminarLanding(existente.id) : undefined));
      continue;
    }
    try {
      // Con --forzar la anterior se borra solo cuando hay un resultado válido (ver `desdeIA`).
      filas.push(await desdeIA(ejemplo, o.enrutador, mediaRaiz, existente ? () => eliminarLanding(existente.id) : undefined));
    } catch (e) {
      filas.push({ id: ejemplo.id, estado: "error", detalle: e instanceof Error ? e.message : String(e) });
    }
  }
  return { filas, sinClaves: false };
}

function imprimir(filas: FilaSemilla[], log: (l: string) => void): void {
  log("\nejemplo · estado · proveedor · puntaje · salud (v/a/r/p) · banco · héroe corregido · recursos");
  for (const f of filas) {
    const salud = f.salud ? `${f.salud.verde}/${f.salud.amarillo}/${f.salud.rojo}/${f.salud.pendiente}` : "-";
    log(
      [f.id, f.estado, f.proveedor ?? "-", f.puntaje ?? "-", salud, f.banco === undefined ? "-" : f.banco ? "sí" : "no", f.heroeCorregido ?? "-", f.recursos ?? "-"].join(" · "),
    );
    if (f.detalle) log(`   ${f.detalle}`);
  }
}

async function principalVitrina(argv: string[]): Promise<number> {
  const iSolo = argv.indexOf("--solo");
  const filas = await sembrarVitrina({ carpeta: resolve("datos", "vitrina"), forzar: argv.includes("--forzar"), solo: iSolo !== -1 ? argv[iSolo + 1] : undefined });
  if (filas.length === 0) console.log("No hay archivos en datos/vitrina/. Constrúyelos con  npm run vitrina  (necesita claves de IA).");
  for (const f of filas) console.log(`${f.slug} · ${f.estado}${f.banco === undefined ? "" : f.banco ? " · en el banco" : " · sin entrar al banco"}${f.detalle ? `
   ${f.detalle}` : ""}`);
  console.log(`
Creadas: ${filas.filter((f) => f.estado === "creada").length} · Omitidas: ${filas.filter((f) => f.estado === "omitida").length} · Con error: ${filas.filter((f) => f.estado === "error").length}`);
  return filas.some((f) => f.estado === "error") ? 1 : 0;
}

async function principal(argv: string[]): Promise<number> {
  if (argv.includes("--vitrina")) return principalVitrina(argv);
  const o: OpcionesSemilla = { forzar: argv.includes("--forzar") };
  const iSolo = argv.indexOf("--solo");
  if (iSolo !== -1) o.solo = argv[iSolo + 1];
  const iJson = argv.indexOf("--desde-json");
  if (iJson !== -1) {
    const sig = argv[iJson + 1];
    o.desdeJson = resolve(sig && !sig.startsWith("--") ? sig : CARPETA_MANUAL);
  }
  if (iSolo !== -1 && (!o.solo || o.solo.startsWith("--"))) throw new Error("--solo necesita el id de un ejemplo.");
  const r = await sembrar(o);
  if (r.sinClaves) return 0;
  imprimir(r.filas, console.log);
  const creadas = r.filas.filter((f) => f.estado === "creada").length;
  console.log(`\nCreadas: ${creadas} · Omitidas: ${r.filas.filter((f) => f.estado === "omitida").length} · Con error: ${r.filas.filter((f) => f.estado === "error").length}`);
  return r.filas.some((f) => f.estado === "error") ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal(process.argv.slice(2))
    .then((codigo) => process.exit(codigo))
    .catch((e) => {
      console.error(explicarError(e));
      process.exit(1);
    });
}
