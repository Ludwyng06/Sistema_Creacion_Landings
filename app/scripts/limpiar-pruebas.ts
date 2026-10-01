// npm run limpiar:pruebas [-- --si] [-- --simular]
// Borra de la base local las landings que dejaron los e2e y las capturas (slugs de prueba), para que el banco
// muestre solo la vitrina y las del usuario. Pide confirmación (--si la salta; --simular solo lista).
import "./_env";
import { createInterface } from "node:readline/promises";
import { pathToFileURL } from "node:url";

/** Prefijos de slug de las landings que crean los e2e y los scripts de capturas. */
export const PREFIJOS_PRUEBA = ["e2e", "cap14-", "demo-12b-", "split-", "heroe-"] as const;
/** Briefs de ejemplo que usan los e2e de `/crear` (el slug sale del brief + un sufijo aleatorio). */
export const BRIEFS_PRUEBA = ["una-noche-de-observacion-de-la-lluvia-de-m", "donde-esta-la-estacion-espacial-ahora-mi"] as const;

export interface FilaPrueba {
  slug: string;
  proveedor: string;
}

/** Solo cuenta como prueba lo creado a mano (`manual`) con slug de prueba: la vitrina y las del usuario por IA no se tocan. */
export function esLandingDePrueba(f: FilaPrueba): boolean {
  if (f.proveedor !== "manual") return false;
  if (f.slug.endsWith("-vitrina")) return false;
  return PREFIJOS_PRUEBA.some((p) => f.slug.startsWith(p)) || BRIEFS_PRUEBA.some((p) => f.slug.startsWith(p));
}

async function confirmar(pregunta: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const r = await rl.question(`${pregunta} [s/N] `);
    return /^s(i|í)?$/i.test(r.trim());
  } finally {
    rl.close();
  }
}

export async function principal(args: string[]): Promise<number> {
  const { db } = await import("../src/lib/db");
  const filas = await db.landing.findMany({ select: { id: true, nombre: true, slug: true, proveedor: true, estado: true } });
  const pruebas = filas.filter(esLandingDePrueba);
  const quedan = filas.length - pruebas.length;
  if (pruebas.length === 0) {
    console.log(`No hay landings de prueba. Quedan ${filas.length} en la base.`);
    return 0;
  }
  const porNombre = new Map<string, number>();
  for (const p of pruebas) porNombre.set(p.nombre, (porNombre.get(p.nombre) ?? 0) + 1);
  console.log(`Se borrarían ${pruebas.length} landings de prueba (quedarían ${quedan}):`);
  for (const [nombre, n] of [...porNombre].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(3)} × ${nombre}`);
  const enBanco = pruebas.filter((p) => p.estado === "en-banco").length;
  if (enBanco) console.log(`  (${enBanco} de ellas están en el banco)`);
  if (args.includes("--simular")) {
    console.log("Simulación: no se borró nada.");
    return 0;
  }
  if (!args.includes("--si") && !(await confirmar("¿Borrarlas, con sus versiones y contactos?"))) {
    console.log("Cancelado: no se borró nada.");
    return 0;
  }
  const r = await db.landing.deleteMany({ where: { id: { in: pruebas.map((p) => p.id) } } });
  console.log(`Listo: ${r.count} borradas. Quedan ${quedan} en la base.`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal(process.argv.slice(2))
    .then((c) => process.exit(c))
    .catch((e) => {
      console.error(`✖ ${e instanceof Error ? e.message : String(e)}`);
      process.exit(1);
    });
}
