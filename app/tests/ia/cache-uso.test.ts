import "../ayudas-db"; // primero: base SQLite aislada
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { GET as USO } from "@/app/api/uso/route";
import { db } from "@/lib/db";
import { TTL_CACHE_MS, almacenCacheAjuste, ejecutar, hashCache, type AlmacenCache } from "@/lib/ia/enrutador";
import { LIMITES_DIARIOS, resumirUso, type FilaUso } from "@/lib/ia/uso";
import { ErrorIA, type ProveedorIA, type RegistradorUso } from "@/lib/ia/tipos";

const esquema = z.object({ ok: z.boolean() });
const base = { tarea: "objeciones" as const, sistema: "s", usuario: "u", esquema };

function proveedor(respuestas: unknown[], id: ProveedorIA["id"] = "groq") {
  let llamadas = 0;
  const p: ProveedorIA & { modelo: string } = {
    id,
    modelo: "m1",
    disponible: () => true,
    async generarJSON<T>() {
      const r = respuestas[Math.min(llamadas++, respuestas.length - 1)];
      if (r instanceof Error) throw r;
      return { datos: r as T, proveedor: id, modelo: "m1", ms: 12 };
    },
  };
  return { p, llamadas: () => llamadas };
}

function memoria(): AlmacenCache & { datos: Map<string, string> } {
  const datos = new Map<string, string>();
  return { datos, leer: async (h) => datos.get(h) ?? null, escribir: async (h, v) => void datos.set(h, v) };
}

describe("registro de UsoIA", () => {
  it("se registra cada intento, en éxito y en error, con tarea, proveedor, modelo, ms y error", async () => {
    const a = proveedor([new ErrorIA("limite", "sin cuota"), new ErrorIA("limite", "sin cuota")], "gemini");
    const b = proveedor([{ ok: true }], "groq");
    const registrarUso = vi.fn<RegistradorUso>(async () => {});
    await ejecutar(base, { proveedores: [a.p, b.p], registrarUso, modo: "cascada", espera: async () => {} });
    expect(registrarUso.mock.calls.map(([u]) => [u.tarea, u.proveedor, u.ok])).toEqual([
      ["objeciones", "gemini", false],
      ["objeciones", "gemini", false],
      ["objeciones", "groq", true],
    ]);
    expect(registrarUso.mock.calls[0][0].error).toContain("limite");
    expect(registrarUso.mock.calls[2][0]).toMatchObject({ modelo: "m1", ms: 12 });
  });

  it("un fallo del registro no rompe ni bloquea la llamada: solo va a consola", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { p } = proveedor([{ ok: true }]);
    const r = await ejecutar(base, { proveedores: [p], registrarUso: async () => Promise.reject(new Error("base caída")), modo: "cascada" });
    expect(r.datos).toEqual({ ok: true });
    expect(aviso).toHaveBeenCalledWith(expect.stringContaining("registrar el uso"), "base caída");
    aviso.mockRestore();
  });

  it("el registrador por defecto escribe en la tabla UsoIA", async () => {
    const { p } = proveedor([{ ok: true }]);
    await ejecutar(base, { proveedores: [p], modo: "cascada" });
    const filas = await db.usoIA.findMany({ where: { tarea: "objeciones" } });
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ proveedor: "groq", modelo: "m1", ok: true, ms: 12 });
  });
});

describe("caché de respuestas", () => {
  const dep = (almacen: AlmacenCache, extra: object = {}) => ({ registrarUso: async () => {}, modo: "cascada" as const, cache: almacen, ...extra });

  it("la segunda llamada idéntica no llama al proveedor", async () => {
    const a = memoria();
    const { p, llamadas } = proveedor([{ ok: true }]);
    const uno = await ejecutar(base, { proveedores: [p], ...dep(a) });
    const dos = await ejecutar(base, { proveedores: [p], ...dep(a) });
    expect(llamadas()).toBe(1);
    expect(dos.datos).toEqual(uno.datos);
    expect(dos.proveedor).toBe("groq");
    expect(a.datos.size).toBe(1);
  });

  it("con sinCache ni lee ni escribe la caché (la respuesta se valida después y una mala se repetiría)", async () => {
    const a = memoria();
    const { p, llamadas } = proveedor([{ ok: true }]);
    await ejecutar({ ...base, sinCache: true }, { proveedores: [p], ...dep(a) });
    await ejecutar({ ...base, sinCache: true }, { proveedores: [p], ...dep(a) });
    expect(llamadas()).toBe(2);
    expect(a.datos.size).toBe(0);
  });

  it("cambiar el usuario, la tarea, el proveedor o el modelo genera otra entrada", async () => {
    const h = hashCache({ sistema: "s", usuario: "u", proveedor: "groq", modelo: "m", tarea: "objeciones" });
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    for (const cambio of [{ usuario: "otro" }, { tarea: "landing" }, { proveedor: "gemini" }, { modelo: "m2" }, { sistema: "x" }]) {
      expect(hashCache({ sistema: "s", usuario: "u", proveedor: "groq", modelo: "m", tarea: "objeciones", ...cambio })).not.toBe(h);
    }
    const a = memoria();
    const { p, llamadas } = proveedor([{ ok: true }]);
    await ejecutar(base, { proveedores: [p], ...dep(a) });
    await ejecutar({ ...base, usuario: "distinto" }, { proveedores: [p], ...dep(a) });
    expect(llamadas()).toBe(2);
  });

  it("con IA_CACHE=0 sí llama al proveedor cada vez y no escribe", async () => {
    const a = memoria();
    const { p, llamadas } = proveedor([{ ok: true }]);
    const d = dep(a, { env: { IA_CACHE: "0" } });
    await ejecutar(base, { proveedores: [p], ...d });
    await ejecutar(base, { proveedores: [p], ...d });
    expect(llamadas()).toBe(2);
    expect(a.datos.size).toBe(0);
  });

  it("una respuesta inválida no se cachea", async () => {
    const a = memoria();
    const invalido = proveedor([new ErrorIA("json", "no cumple el esquema")]);
    await expect(ejecutar(base, { proveedores: [invalido.p], ...dep(a) })).rejects.toThrow();
    expect(a.datos.size).toBe(0);
    // una entrada guardada que ya no cumple el esquema tampoco se usa
    const b = memoria();
    const bueno = proveedor([{ ok: true }]);
    await ejecutar(base, { proveedores: [bueno.p], ...dep(b) });
    const [clave, valor] = [...b.datos][0];
    b.datos.set(clave, valor.replace('"ok":true', '"ok":"texto"'));
    await ejecutar(base, { proveedores: [bueno.p], ...dep(b) });
    expect(bueno.llamadas()).toBe(2);
  });

  it("vence a los 7 días", async () => {
    const a = memoria();
    const { p, llamadas } = proveedor([{ ok: true }]);
    let ahora = 1_000_000;
    const d = dep(a, { ahora: () => ahora });
    await ejecutar(base, { proveedores: [p], ...d });
    ahora += TTL_CACHE_MS - 1000;
    await ejecutar(base, { proveedores: [p], ...d });
    expect(llamadas()).toBe(1);
    ahora += 2000;
    await ejecutar(base, { proveedores: [p], ...d });
    expect(llamadas()).toBe(2);
  });

  it("si la caché falla, la llamada sigue", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    const rota: AlmacenCache = { leer: async () => Promise.reject(new Error("x")), escribir: async () => Promise.reject(new Error("y")) };
    const { p } = proveedor([{ ok: true }]);
    expect((await ejecutar(base, { proveedores: [p], ...dep(rota) })).datos).toEqual({ ok: true });
    aviso.mockRestore();
  });

  it("sin proveedores inyectados usa la tabla Ajuste con la clave cache:<hash>", async () => {
    await almacenCacheAjuste.escribir("abc", "{}");
    expect((await db.ajuste.findUnique({ where: { clave: "cache:abc" } }))?.valor).toBe("{}");
    expect(await almacenCacheAjuste.leer("abc")).toBe("{}");
    expect(await almacenCacheAjuste.leer("no-existe")).toBeNull();
  });
});

describe("resumen de uso y aviso de 80 %", () => {
  const ahora = new Date("2026-09-30T15:00:00Z");
  const fila = (proveedor: string, dias: number, ok = true, error: string | null = null, ms = 100): FilaUso => ({
    proveedor,
    ok,
    ms,
    error,
    creadoEn: new Date(ahora.getTime() - dias * 86_400_000),
  });

  it("cuenta por proveedor y por día, errores y ms promedio", () => {
    const r = resumirUso(
      [fila("groq", 0, true, null, 100), fila("groq", 0, false, "limite: 429", 300), fila("gemini", 1), fila("groq", 2), fila("groq", 30)],
      7,
      ahora,
      {},
    );
    const groq = r.porProveedor.find((p) => p.proveedor === "groq")!;
    expect(groq).toMatchObject({ total: 3, ok: 2, errores: 1, usoHoy: 2, msPromedio: 167, limiteDiario: 1000 });
    expect(r.porProveedor.map((p) => p.proveedor)).toEqual(["gemini", "groq"]);
    expect(r.porDia.map((d) => [d.fecha, d.total, d.errores])).toEqual([
      ["2026-09-28", 1, 0],
      ["2026-09-29", 1, 0],
      ["2026-09-30", 2, 1],
    ]);
    expect(r.porDia[2].proveedores).toEqual({ groq: 2 });
    expect(r.errores).toEqual([{ proveedor: "groq", tipo: "limite", cantidad: 1, ultimo: "limite: 429" }]);
    expect(r.porDiaProveedor).toEqual([
      { fecha: "2026-09-30", proveedor: "groq", total: 2, errores: 1, msPromedio: 200 },
      { fecha: "2026-09-29", proveedor: "gemini", total: 1, errores: 0, msPromedio: 100 },
      { fecha: "2026-09-28", proveedor: "groq", total: 1, errores: 0, msPromedio: 100 },
    ]);
    expect(r.desde).toBe("2026-09-24");
    expect(r.avisos).toEqual([]);
  });

  it("marca aviso80 al llegar al 80 % del límite diario de hoy", () => {
    const limite = LIMITES_DIARIOS.openrouter!;
    const filas = (n: number) => Array.from({ length: n }, () => fila("openrouter", 0));
    const justo = resumirUso(filas(limite * 0.8), 7, ahora, {});
    expect(justo.porProveedor[0]).toMatchObject({ usoHoy: 40, limiteDiario: 50, porcentajeHoy: 80, aviso80: true });
    expect(justo.avisos[0]).toContain("openrouter");
    expect(resumirUso(filas(39), 7, ahora, {}).porProveedor[0].aviso80).toBe(false);
    // el uso de días anteriores no cuenta para el aviso de hoy
    expect(resumirUso(Array.from({ length: 45 }, () => fila("openrouter", 1)), 7, ahora, {}).porProveedor[0].aviso80).toBe(false);
  });

  it("Gemini solo avisa si se define GEMINI_LIMITE_DIARIO", () => {
    const filas = Array.from({ length: 8 }, () => fila("gemini", 0));
    expect(resumirUso(filas, 7, ahora, {}).porProveedor[0]).toMatchObject({ limiteDiario: null, aviso80: false, porcentajeHoy: null });
    expect(resumirUso(filas, 7, ahora, { GEMINI_LIMITE_DIARIO: "10" }).porProveedor[0]).toMatchObject({ limiteDiario: 10, aviso80: true });
  });

  it("GET /api/uso lee UsoIA de la base y valida `dias`", async () => {
    await db.usoIA.deleteMany();
    await db.usoIA.createMany({
      data: [
        { tarea: "landing", proveedor: "groq", modelo: "m", ms: 100, ok: true },
        { tarea: "landing", proveedor: "groq", modelo: "m", ms: 200, ok: false, error: "auth: clave rechazada" },
        { tarea: "critico", proveedor: "cerebras", modelo: "m", ms: 50, ok: true },
      ],
    });
    const res = await USO(new Request("http://localhost/api/uso?dias=7"));
    expect(res.status).toBe(200);
    const r = await res.json();
    expect(r.dias).toBe(7);
    expect(r.porProveedor.find((p: { proveedor: string }) => p.proveedor === "groq")).toMatchObject({ total: 2, errores: 1, msPromedio: 150 });
    expect(r.errores[0]).toMatchObject({ proveedor: "groq", tipo: "auth", cantidad: 1 });
    expect((await (await USO(new Request("http://localhost/api/uso"))).json()).dias).toBe(7);
    expect((await USO(new Request("http://localhost/api/uso?dias=0"))).status).toBe(400);
    expect((await USO(new Request("http://localhost/api/uso?dias=abc"))).status).toBe(400);
  });
});
