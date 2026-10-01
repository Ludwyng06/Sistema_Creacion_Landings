import "../ayudas-db";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DatoEnVivo, WIDGETS_VIVO } from "@/lib/contratos";
import { almacenMemoria } from "@/lib/fuentes/cache";
import { crearFuentes } from "@/lib/fuentes/registro";
import { fechaEn, obtenerDatoVivo, TTL_WIDGET_SEGUNDOS } from "@/lib/vivo";
import { GET } from "@/app/api/vivo/[widget]/route";

const fixture = (n: string): unknown => JSON.parse(readFileSync(join(__dirname, "fixtures", "api", n), "utf8"));

const RUTAS: [RegExp, string][] = [
  [/noaa-planetary-k-index/, "noaa-kp.json"],
  [/rstt\/oneday/, "usno-dia.json"],
  [/moon\/phases\/date/, "usno-fases.json"],
  [/wheretheiss/, "iss.json"],
  [/launches\/upcoming/, "lanzamientos.json"],
  [/neo\/rest/, "neows.json"],
];

const fetchOk = (async (url: string | URL | Request) => {
  const r = RUTAS.find(([re]) => re.test(String(url)));
  return r ? new Response(JSON.stringify(fixture(r[1]))) : new Response("no", { status: 404 });
}) as typeof fetch;
const fetchCaido = (async () => new Response("caído", { status: 503 })) as typeof fetch;

const AHORA = new Date("2026-09-30T15:00:00Z");
const op = (fetchFn: typeof fetch) => ({ fuentes: crearFuentes({ fetchFn, esperaReintentoMs: 0, env: {} }), almacen: almacenMemoria(), ahora: () => AHORA });

describe("obtenerDatoVivo", () => {
  it("cada widget entrega un DatoEnVivo válido y con su discriminante", async () => {
    for (const w of WIDGETS_VIVO) {
      const dato = await obtenerDatoVivo(w, op(fetchOk));
      expect(dato, w).not.toBeNull();
      expect(DatoEnVivo.safeParse(dato).success, w).toBe(true);
      expect(dato!.widget).toBe(w);
      expect(dato!.actualizadoEn).toMatch(/^\d{4}-\d\d-\d\dT/);
    }
  });

  it("los valores salen de las fuentes", async () => {
    const o = op(fetchOk);
    expect(await obtenerDatoVivo("fase-lunar", o)).toMatchObject({ fase: "Gibosa menguante", iluminacion: 81, proximaLlena: "2026-10-26" });
    expect(await obtenerDatoVivo("lanzamiento", o)).toMatchObject({ mision: "Crew-13", cohete: "Falcon 9 Block 5", proveedor: "SpaceX", fechaLanzamiento: "2026-10-01T15:10:06Z" });
    expect(await obtenerDatoVivo("asteroides", o)).toMatchObject({ cantidad: 5, fecha: "2026-09-30" });
    expect(await obtenerDatoVivo("iss", o)).toMatchObject({ widget: "iss" });
  });

  it("si la fuente falla devuelve null en todos los widgets", async () => {
    for (const w of WIDGETS_VIVO) expect(await obtenerDatoVivo(w, op(fetchCaido)), w).toBeNull();
  });

  it("sin lanzamientos futuros no hay dato", async () => {
    const o = { ...op(fetchOk), ahora: () => new Date("2027-01-01T00:00:00Z") };
    expect(await obtenerDatoVivo("lanzamiento", o)).toBeNull();
  });

  it("sirve desde la caché sin volver a la red dentro del TTL", async () => {
    let llamadas = 0;
    const contando = (async (u: string | URL | Request) => (llamadas++, fetchOk(u))) as typeof fetch;
    const o = op(contando);
    await obtenerDatoVivo("auroras", o);
    await obtenerDatoVivo("auroras", o);
    expect(llamadas).toBe(1);
  });

  it("los TTL son los del plan: 15 min, 6 h, 30 s, 1 h y 12 h", () => {
    expect(TTL_WIDGET_SEGUNDOS).toEqual({ auroras: 900, "fase-lunar": 21600, iss: 30, lanzamiento: 3600, asteroides: 43200 });
    const f = crearFuentes();
    expect([f.noaaKp.ttl, f.usnoLuna.ttl, f.iss.ttl, f.lanzamientos.ttl, f.neows.ttl]).toEqual([900, 21600, 30, 3600, 43200]);
  });

  it("la fecha de la luna es la de Bogotá (UTC-5)", () => {
    expect(fechaEn(new Date("2026-10-01T03:00:00Z"), -5)).toBe("2026-09-30");
    expect(fechaEn(new Date("2026-10-01T03:00:00Z"), 0)).toBe("2026-10-01");
  });
});

describe("GET /api/vivo/[widget]", () => {
  const ctx = (widget: string) => ({ params: Promise.resolve({ widget }) });

  it("404 con un widget que no existe", async () => {
    const r = await GET(new Request("http://x/api/vivo/planetas"), ctx("planetas"));
    expect(r.status).toBe(404);
  });

  it("204 sin cuerpo cuando la fuente no responde (sin red en el test), nunca un error", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = fetchCaido;
    try {
      const r = await GET(new Request("http://x/api/vivo/iss"), ctx("iss"));
      expect(r.status).toBe(204);
      expect(await r.text()).toBe("");
    } finally {
      globalThis.fetch = original;
    }
  });
});
