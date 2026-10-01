// PUERTO=3190 npx tsx tests/e2e/dia18-media.ts [--sin-build]
// Comprueba contra `next start` (como se hará la demo) que /media/** se sirve del disco en tiempo de ejecución:
// un archivo creado DESPUÉS de arrancar responde 200 sin recompilar, con Range para video y 404 limpio ante `..`.
import { execSync, spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const puerto = Number(process.env.PUERTO ?? 3190);
const base = `http://localhost:${puerto}`;
const carpeta = join(process.cwd(), "public", "media", "e2e-dia18");
let fallos = 0;
const ok = (cond: boolean, msg: string) => {
  console.log(`${cond ? "ok  " : "FALLA"} ${msg}`);
  if (!cond) fallos++;
};

async function main() {
  if (!process.argv.includes("--sin-build")) execSync("npm run build", { stdio: "inherit" });
  const srv = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(puerto)], { stdio: "pipe", env: { ...process.env, PORT: String(puerto) } });
  try {
    for (let i = 0; i < 60; i++) {
      try {
        if ((await fetch(`${base}/`)).status < 500) break;
      } catch {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    // Se crea DESPUÉS de arrancar: no existía cuando se compiló.
    rmSync(carpeta, { recursive: true, force: true });
    mkdirSync(carpeta, { recursive: true });
    const r0 = await fetch(`${base}/media/e2e-dia18/foto.webp`);
    ok(r0.status === 404, `antes de crearlo: 404 (${r0.status})`);
    await sharp({ create: { width: 64, height: 48, channels: 3, background: "#336699" } }).webp().toFile(join(carpeta, "foto.webp"));
    writeFileSync(join(carpeta, "clip.mp4"), Buffer.from("0123456789"));
    const r1 = await fetch(`${base}/media/e2e-dia18/foto.webp`);
    ok(r1.status === 200 && r1.headers.get("content-type") === "image/webp", `archivo creado después: 200 image/webp sin recompilar (${r1.status})`);
    ok(Boolean(r1.headers.get("etag")) && Boolean(r1.headers.get("last-modified")), "trae ETag y Last-Modified");
    const r2 = await fetch(`${base}/media/e2e-dia18/foto.webp`, { headers: { "If-None-Match": r1.headers.get("etag")! } });
    ok(r2.status === 304, `If-None-Match: 304 (${r2.status})`);
    const r3 = await fetch(`${base}/media/e2e-dia18/clip.mp4`, { headers: { Range: "bytes=2-5" } });
    ok(r3.status === 206 && (await r3.text()) === "2345" && r3.headers.get("content-range") === "bytes 2-5/10", `Range de video: 206 (${r3.status})`);
    const r4 = await fetch(`${base}/media/%2e%2e/%2e%2e/package.json`);
    ok(r4.status === 404, `recorrido %2e%2e: 404 (${r4.status})`);
    const r5 = await fetch(`${base}/media/no-existe.webp`);
    ok(r5.status === 404, `inexistente: 404 limpio (${r5.status})`);
    // El optimizador de imágenes de Next también la alcanza.
    const r6 = await fetch(`${base}/_next/image?url=${encodeURIComponent("/media/e2e-dia18/foto.webp")}&w=64&q=75`);
    ok(r6.status === 200, `next/image sobre /media creado después: 200 (${r6.status})`);
  } finally {
    srv.kill();
    rmSync(carpeta, { recursive: true, force: true });
  }
  console.log(fallos === 0 ? "\nTodo bien." : `\n${fallos} comprobación(es) fallaron.`);
  process.exit(fallos === 0 ? 0 : 1);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
