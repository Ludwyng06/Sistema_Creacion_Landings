import { describe, expect, it } from "vitest";
import type { EventoDuelo } from "@/lib/ia/duelo";
import { DUELO_INICIAL, puntajeDe, reducirDuelo, type EventoFinalDuelo } from "@/componentes/crear/duelo";
import { crearParserNdjson } from "@/componentes/crear/ndjson";

const tarea = (lado: "a" | "b", estado: "en-curso" | "ok", extra = {}): EventoDuelo =>
  ({ tipo: "tarea", tarea: "landing", estado, lado, ...extra }) as EventoDuelo;

describe("reducer del duelo", () => {
  it("las tareas de cada lado avanzan por separado y a la vez", () => {
    let s = reducirDuelo(DUELO_INICIAL, { tipo: "iniciar" });
    expect(s.fase).toBe("corriendo");
    s = reducirDuelo(s, { tipo: "evento", evento: tarea("a", "en-curso") });
    s = reducirDuelo(s, { tipo: "evento", evento: tarea("b", "en-curso") });
    s = reducirDuelo(s, { tipo: "evento", evento: tarea("b", "ok", { proveedor: "groq", ms: 900 }) });
    expect(s.a.filas).toEqual([expect.objectContaining({ tarea: "landing", estado: "en-curso" })]);
    expect(s.b.filas).toEqual([expect.objectContaining({ estado: "ok", proveedor: "groq", ms: 900 })]);
  });

  it("un error con lado queda en ese lado; uno sin lado detiene el duelo", () => {
    let s = reducirDuelo(DUELO_INICIAL, { tipo: "iniciar" });
    s = reducirDuelo(s, { tipo: "evento", evento: { tipo: "error", mensaje: "Lado A sin cuota", lado: "a" } });
    expect(s.a.error).toBe("Lado A sin cuota");
    expect(s.fase).toBe("corriendo");
    s = reducirDuelo(s, { tipo: "evento", evento: { tipo: "error", mensaje: "Fallaron los dos" } as EventoDuelo });
    expect(s.fase).toBe("error");
    expect(s.error).toBe("Fallaron los dos");
  });

  it("el evento duelo cierra el flujo y da el puntaje de cada lado", () => {
    const critica = (puntaje: number) => ({ puntaje, porCriterio: [], problemas: [], correcciones: [] });
    const final: EventoFinalDuelo = {
      tipo: "duelo",
      a: null,
      b: null,
      juez: { a: critica(6.1), b: critica(9), ganador: "b", razon: "B es más clara" },
      ganador: "b",
      proveedores: { a: "gemini", b: "groq" },
      avisos: [],
    };
    const s = reducirDuelo(reducirDuelo(DUELO_INICIAL, { tipo: "iniciar" }), { tipo: "evento", evento: final });
    expect(s.fase).toBe("terminado");
    expect(puntajeDe(s.final!, "a")).toBe(6.1);
    expect(puntajeDe(s.final!, "b")).toBe(9);
    expect(puntajeDe({ ...final, juez: null }, "a")).toBeNull();
  });

  it("iniciar limpia el duelo anterior", () => {
    let s = reducirDuelo(DUELO_INICIAL, { tipo: "evento", evento: tarea("a", "ok") });
    s = reducirDuelo(s, { tipo: "iniciar" });
    expect(s.a.filas).toEqual([]);
    expect(s.avisos).toEqual([]);
  });
});

describe("parser NDJSON del duelo", () => {
  it("acepta eventos con lado y el evento final duelo, aunque lleguen partidos", () => {
    const eventos: unknown[] = [];
    const avisos: string[] = [];
    const parser = crearParserNdjson((e) => eventos.push(e), (a) => avisos.push(a));
    const lineaA = JSON.stringify({ tipo: "tarea", tarea: "landing", estado: "ok", lado: "a" });
    const lineaB = JSON.stringify({ tipo: "resultado", lado: "b", doc: {}, salud: [], vueltasCritico: 0, proveedores: {}, avisos: [] });
    const final = JSON.stringify({ tipo: "duelo", a: null, b: null, juez: null, ganador: "empate", proveedores: { a: "x", b: "y" }, avisos: [] });
    parser.empujar(lineaA + "\n" + lineaB.slice(0, 20));
    parser.empujar(lineaB.slice(20) + "\n" + final);
    parser.cerrar();
    expect(eventos).toHaveLength(3);
    expect((eventos[0] as { lado: string }).lado).toBe("a");
    expect((eventos[1] as { lado: string }).lado).toBe("b");
    expect((eventos[2] as { tipo: string }).tipo).toBe("duelo");
    expect(avisos).toEqual([]);
  });
});
