import { describe, expect, it } from "vitest";
import { construirDuelo, elegirCompetidores, type EventoDuelo, type PeticionDuelo } from "@/lib/ia/duelo";
import { crearManejadorDuelo } from "@/lib/ia/duelo-http";
import { ErrorIA, type ProveedorId, type RegistradorUso } from "@/lib/ia/tipos";
import { briefCorrector, crearProveedores, critica, docBase, docConTitular, manejadorBase, type Manejador } from "../construccion/ayudas";

const registrarUso: RegistradorUso = async () => {};
type Final = Extract<EventoDuelo, { tipo: "duelo" }>;

const jueza = (ganador: "a" | "b" | "empate", pa = 9, pb = 7) => () => ({
  a: critica(pa),
  b: critica(pb),
  ganador,
  razon: "El lado A es más claro en el héroe.",
});

/** Landing propia de cada proveedor; el crítico puntúa según el titular que ve (A = gemini). */
const manejadorDuelo = (extra: Partial<Record<string, Manejador>> = {}): Manejador =>
  manejadorBase({
    landing: ({ proveedor }) => docConTitular(`Landing de ${proveedor}`),
    critico: ({ usuario }) => critica(usuario.includes("Landing de gemini") ? 9 : 8.5),
    "juez-duelo": jueza("a"),
    ...extra,
  });

async function duelo(ids: ProveedorId[], manejador: Manejador, peticion: Partial<PeticionDuelo> = {}) {
  const { proveedores, llamadas } = crearProveedores(ids, manejador);
  const eventos: EventoDuelo[] = [];
  await construirDuelo(
    { brief: briefCorrector, tecnicas: [], numeroSemilla: 42, ...peticion },
    (e) => eventos.push(e),
    { enrutador: { proveedores, registrarUso, tablaTareas: {}, espera: async () => {} } },
  );
  return { eventos, llamadas, final: eventos.find((e): e is Final => e.tipo === "duelo") };
}

describe("elegirCompetidores", () => {
  it("toma los 2 primeros distintos del juez; con pocos proveedores incluye al juez", () => {
    expect(elegirCompetidores(["gemini", "cerebras", "groq", "openrouter"], "groq")).toEqual(["gemini", "cerebras"]);
    expect(elegirCompetidores(["groq", "gemini", "cerebras"], "groq")).toEqual(["gemini", "cerebras"]);
    expect(elegirCompetidores(["gemini", "groq"], "groq")).toEqual(["gemini", "groq"]);
  });

  it("valida la elección explícita y exige al menos 2 proveedores", () => {
    expect(elegirCompetidores(["gemini", "groq", "cerebras"], "groq", ["cerebras", "gemini"])).toEqual(["cerebras", "gemini"]);
    expect(() => elegirCompetidores(["gemini", "groq"], "groq", ["gemini", "gemini"])).toThrow(/distintos/);
    expect(() => elegirCompetidores(["gemini", "groq"], "groq", ["gemini", "openrouter"])).toThrow(/openrouter/);
    expect(() => elegirCompetidores(["gemini"], "groq")).toThrow(/al menos 2/);
    expect(() => elegirCompetidores([], "groq")).toThrow(/al menos 2/);
  });
});

describe("modo duelo", () => {
  it("gana el de mayor puntaje; cada lado usa su proveedor y el juez es un tercero", async () => {
    const { final, eventos, llamadas } = await duelo(["gemini", "cerebras", "groq"], manejadorDuelo());
    expect(final).toBeDefined();
    expect(final!.ganador).toBe("a");
    expect(final!.a!.proveedorLanding).toBe("gemini");
    expect(final!.b!.proveedorLanding).toBe("cerebras");
    expect(final!.a!.doc.secciones[0].ajustes.titular).toBe("Landing de gemini");
    expect(final!.b!.doc.secciones[0].ajustes.titular).toBe("Landing de cerebras");
    expect(final!.juez).toMatchObject({ ganador: "a", razon: expect.any(String) });
    expect(final!.proveedores).toEqual({ a: "gemini", b: "cerebras", juez: "groq" });
    // la landing de cada lado solo la genera su proveedor
    const landing = llamadas.filter((l) => l.tarea === "landing");
    expect(new Set(landing.map((l) => l.proveedor))).toEqual(new Set(["gemini", "cerebras"]));
    // el juez no es ninguno de los competidores
    expect(llamadas.filter((l) => l.tarea === "juez-duelo").map((l) => l.proveedor)).toEqual(["groq"]);
    // todos los eventos de construcción llevan lado y el último es el duelo
    for (const e of eventos.filter((x) => x.tipo !== "duelo" && x.tipo !== "tarea" ? true : x.tipo === "tarea" && x.tarea !== "juez-duelo")) {
      expect(["a", "b"]).toContain((e as { lado: string }).lado);
    }
    expect(eventos.filter((e) => e.tipo === "resultado")).toHaveLength(2);
    expect(eventos.at(-1)!.tipo).toBe("duelo");
  });

  it("los eventos del juez y el error previo a elegir competidores llevan lado «juez»", async () => {
    const { eventos } = await duelo(["gemini", "cerebras", "groq"], manejadorDuelo());
    const delJuez = eventos.filter((e) => e.tipo === "tarea" && e.tarea === "juez-duelo");
    expect(delJuez.map((e) => (e as { estado: string }).estado)).toEqual(["en-curso", "ok"]);
    for (const e of delJuez) expect((e as { lado: string }).lado).toBe("juez");
    for (const e of eventos.filter((x) => x.tipo === "tarea" && x.tarea !== "juez-duelo")) expect(["a", "b"]).toContain((e as { lado: string }).lado);
    const previo = await duelo(["gemini"], manejadorDuelo());
    expect(previo.eventos[0]).toMatchObject({ tipo: "error", lado: "juez" });
    const fallaJuez = await duelo(["gemini", "cerebras", "groq"], manejadorDuelo({ "juez-duelo": () => { throw new ErrorIA("red", "x"); } }));
    expect(fallaJuez.eventos.filter((e) => e.tipo === "tarea" && e.tarea === "juez-duelo").every((e) => (e as { lado: string }).lado === "juez")).toBe(true);
  });

  it("gana B cuando el juez le da más puntaje", async () => {
    const { final } = await duelo(["gemini", "cerebras", "groq"], manejadorDuelo({ "juez-duelo": jueza("b", 6, 8.5) }));
    expect(final!.ganador).toBe("b");
    expect(final!.avisos).toEqual([]);
  });

  it("si el juez nombra un ganador que contradice sus puntajes, manda el mayor puntaje con aviso", async () => {
    const { final } = await duelo(["gemini", "cerebras", "groq"], manejadorDuelo({ "juez-duelo": jueza("b", 9, 7) }));
    expect(final!.ganador).toBe("a");
    expect(final!.avisos.some((a) => a.includes("mayor puntaje"))).toBe(true);
  });

  it("empate cuando los puntajes son iguales", async () => {
    const { final } = await duelo(["gemini", "cerebras", "groq"], manejadorDuelo({ "juez-duelo": jueza("empate", 8, 8) }));
    expect(final!.ganador).toBe("empate");
  });

  it("si un lado lanza ErrorIA, el otro gana por defecto con aviso y no hay juez", async () => {
    const { final, eventos, llamadas } = await duelo(
      ["gemini", "cerebras", "groq"],
      manejadorDuelo({
        landing: ({ proveedor }) => {
          if (proveedor === "cerebras") throw new ErrorIA("limite", "sin cuota");
          return docConTitular(`Landing de ${proveedor}`);
        },
      }),
    );
    expect(final!.ganador).toBe("a");
    expect(final!.b).toBeNull();
    expect(final!.juez).toBeNull();
    expect(final!.avisos.some((a) => a.includes("lado B") && a.includes("cerebras"))).toBe(true);
    expect(final!.avisos.some((a) => a.includes("por defecto"))).toBe(true);
    expect(llamadas.some((l) => l.tarea === "juez-duelo")).toBe(false);
    // el lado que falla no tiene respaldo: solo su proveedor intentó su landing
    expect(llamadas.filter((l) => l.tarea === "landing" && l.proveedor !== "gemini").every((l) => l.proveedor === "cerebras")).toBe(true);
    expect(eventos).toContainEqual(expect.objectContaining({ tipo: "manual", lado: "b" }));
  });

  it("también gana B si falla A", async () => {
    const { final } = await duelo(
      ["gemini", "cerebras", "groq"],
      manejadorDuelo({
        landing: ({ proveedor }) => {
          if (proveedor === "gemini") throw new ErrorIA("red", "sin red");
          return docBase();
        },
      }),
    );
    expect(final!.ganador).toBe("b");
    expect(final!.a).toBeNull();
  });

  it("si fallan los dos lados, evento error y sin duelo", async () => {
    const { final, eventos } = await duelo(
      ["gemini", "cerebras", "groq"],
      manejadorDuelo({
        landing: () => {
          throw new ErrorIA("auth", "clave inválida");
        },
      }),
    );
    expect(final).toBeUndefined();
    const error = eventos.at(-1)!;
    expect(error.tipo).toBe("error");
    expect((error as { mensaje: string }).mensaje).toContain("Fallaron los dos lados");
  });

  it("si el juez falla, decide el puntaje del crítico de cada lado", async () => {
    const { final } = await duelo(
      ["gemini", "cerebras", "groq"],
      manejadorDuelo({
        "juez-duelo": () => {
          throw new ErrorIA("limite", "sin cuota");
        },
      }),
    );
    expect(final!.juez).toBeNull();
    expect(final!.ganador).toBe("a"); // 9 contra 8,5 del crítico
    expect(final!.avisos.some((a) => a.includes("juez"))).toBe(true);
  });

  it("con solo 2 proveedores compiten los dos y el juez es uno de ellos", async () => {
    const { final } = await duelo(["gemini", "groq"], manejadorDuelo());
    expect(final!.proveedores).toMatchObject({ a: "gemini", b: "groq" });
    expect(final!.juez).not.toBeNull();
  });

  it("respeta los proveedores pedidos", async () => {
    const { final } = await duelo(["gemini", "cerebras", "groq", "openrouter"], manejadorDuelo(), { proveedores: ["openrouter", "cerebras"] });
    expect(final!.proveedores).toMatchObject({ a: "openrouter", b: "cerebras" });
    expect(final!.a!.proveedorLanding).toBe("openrouter");
  });

  it("con proveedores insuficientes o no disponibles emite un error legible", async () => {
    const uno = await duelo(["gemini"], manejadorDuelo());
    expect(uno.eventos).toEqual([expect.objectContaining({ tipo: "error", mensaje: expect.stringContaining("al menos 2") })]);
    const malos = await duelo(["gemini", "groq"], manejadorDuelo(), { proveedores: ["gemini", "cerebras"] });
    expect(malos.eventos[0]).toMatchObject({ tipo: "error", mensaje: expect.stringContaining("cerebras") });
  });
});

describe("POST /api/construir-duelo", () => {
  const { proveedores } = crearProveedores(["gemini", "cerebras", "groq"], manejadorDuelo());
  const manejador = crearManejadorDuelo({ enrutador: { proveedores, registrarUso, tablaTareas: {}, espera: async () => {} } });
  const post = (cuerpo: unknown) =>
    manejador(new Request("http://localhost/api/construir-duelo", { method: "POST", body: typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo) }));

  it("responde NDJSON con eventos etiquetados y el evento `duelo` al final", async () => {
    const res = await post({ brief: briefCorrector, tecnicas: [], numeroSemilla: 42 });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/x-ndjson");
    const eventos = (await res.text()).trim().split("\n").map((l) => JSON.parse(l) as EventoDuelo);
    expect(eventos.at(-1)).toMatchObject({ tipo: "duelo", ganador: "a" });
    expect(eventos.filter((e) => e.tipo === "resultado").map((e) => (e as { lado: string }).lado).sort()).toEqual(["a", "b"]);
  });

  it("400 con petición inválida, proveedores repetidos fuera de la lista o cuerpo no JSON", async () => {
    expect((await post({ brief: { nombre: "" }, tecnicas: [] })).status).toBe(400);
    expect((await post({ brief: briefCorrector, tecnicas: [], proveedores: ["gemini", "manual"] })).status).toBe(400);
    expect((await post({ brief: briefCorrector, tecnicas: [], proveedores: ["gemini"] })).status).toBe(400);
    expect((await post("{roto")).status).toBe(400);
  });
});
