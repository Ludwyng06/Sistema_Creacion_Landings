// Prueba los proveedores de IA con las claves de app/.env.local y, si hay alguno,
// construye una landing real con el brief del corrector, forzando cada proveedor por separado.
// Uso: npm run ia:probar [-- --solo=gemini,openrouter] [-- --ping]   (--ping solo hace la prueba corta)
import { config } from "dotenv";
import { z } from "zod";
import { type EventoConstruccion, type ProveedorId } from "../src/lib/contratos";
import { EJEMPLOS } from "../src/datos/ejemplos";
import { construir } from "../src/lib/ia/construir";
import { proveedoresDisponibles } from "../src/lib/ia/registro";
import type { ProveedorIA } from "../src/lib/ia/tipos";

config({ path: ".env.local", quiet: true });

const TODOS = ["gemini", "cerebras", "groq", "openrouter"] as const;
const Minimo = z.object({ ok: z.boolean(), palabra: z.string() });

// El mismo caso que «Rellenar ejemplo» en /crear: brief, técnicas y semilla del corrector de postura.
const ejemplo = EJEMPLOS.find((e) => e.id === "corrector-postura") ?? EJEMPLOS[0];
const briefCorrector = ejemplo.brief;

interface Fila {
  proveedor: string;
  ping: string;
  landing: string;
  segundos: string;
  puntaje: string;
  rojos: string;
  proveedores: string;
}

const uno = (m: string) => m.replace(/\s+/g, " ").slice(0, 150);

async function ping(p: ProveedorIA): Promise<string> {
  const inicio = performance.now();
  try {
    await p.generarJSON({
      sistema: "Responde solo con el JSON pedido.",
      usuario: 'Devuelve { "ok": true, "palabra": "hola" }.',
      esquema: Minimo,
      maxTokens: 200,
      temperatura: 0,
    });
    return `ok ${Math.round(performance.now() - inicio)} ms`;
  } catch (e) {
    return uno(e instanceof Error ? e.message : String(e));
  }
}

/** Construye la landing completa con `id` forzado en la tarea `landing` y resume el resultado en una fila. */
async function construirCon(id: ProveedorId, fila: Fila): Promise<void> {
  const inicio = performance.now();
  let resultado: Extract<EventoConstruccion, { tipo: "resultado" }> | undefined;
  let motivo = "";
  await construir(
    { brief: briefCorrector, tecnicas: [...ejemplo.tecnicas], numeroSemilla: ejemplo.numeroSemilla },
    (e) => {
      if (e.tipo === "tarea" && e.estado !== "en-curso")
        console.log(`  [${id}] ${e.tarea} ${e.estado}${e.proveedor ? ` · ${e.proveedor}` : ""}${e.ms ? ` · ${e.ms} ms` : ""}${e.mensaje ? ` · ${uno(e.mensaje)}` : ""}`);
      else if (e.tipo === "resultado") resultado = e;
      else if (e.tipo === "manual") motivo = e.intentos.map((i) => `${i.proveedor}/${i.tipo}: ${i.mensaje.replace(/\s+/g, " ").slice(0, 260)}`).join(" | ");
      else if (e.tipo === "error") motivo = uno(e.mensaje);
    },
    { forzarLanding: id },
  );
  fila.segundos = ((performance.now() - inicio) / 1000).toFixed(1);
  if (!resultado) {
    fila.landing = `sin landing: ${motivo || "cascada agotada"}`;
    return;
  }
  const rojos = resultado.salud.filter((s) => s.estado === "rojo").map((s) => s.id);
  fila.landing = rojos.length === 0 ? "válida" : "con rojos";
  fila.puntaje = String(resultado.doc.critica?.puntaje ?? "sin crítico");
  fila.rojos = rojos.length === 0 ? "0" : rojos.join(",");
  fila.proveedores = Object.entries(resultado.proveedores).map(([t, p]) => `${t}:${p}`).join(" ");
  if (resultado.avisos.length) console.log(`  [${id}] avisos: ${resultado.avisos.map(uno).join(" | ")}`);
}

async function main() {
  const solo = process.argv.find((a) => a.startsWith("--solo="))?.slice(7).split(",");
  const soloPing = process.argv.includes("--ping");
  const disponibles = proveedoresDisponibles(process.env);
  const filas: Fila[] = [];

  for (const id of TODOS) {
    if (solo && !solo.includes(id)) continue;
    const p = disponibles.find((x) => x.id === id);
    const fila: Fila = { proveedor: id, ping: id === "cerebras" ? "no configurado (opcional, de pago)" : "sin clave", landing: "-", segundos: "-", puntaje: "-", rojos: "-", proveedores: "" };
    filas.push(fila);
    if (!p) continue;
    fila.ping = await ping(p);
    if (soloPing) continue;
    console.log(`\nConstruyendo la landing del corrector con ${id} forzado...`);
    try {
      await construirCon(id, fila);
    } catch (e) {
      fila.landing = `error: ${uno(e instanceof Error ? e.message : String(e))}`;
    }
  }

  console.log("\nResumen por proveedor (landing forzada; meta: válida en ≤ 90 s con al menos 2 proveedores):");
  console.table(filas);

  if (disponibles.length === 0)
    console.log("\nPendiente de claves: agrega GEMINI_API_KEY, GROQ_API_KEY, CEREBRAS_API_KEY u OPENROUTER_API_KEY en app/.env.local.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
