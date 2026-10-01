import { describe, expect, it } from "vitest";
import type { EventoConstruccion } from "@/lib/contratos";
import { crearParserNdjson, leerFlujoNdjson } from "@/componentes/crear/ndjson";

const A: EventoConstruccion = { tipo: "tarea", tarea: "landing", estado: "en-curso" };
const B: EventoConstruccion = { tipo: "tarea", tarea: "critico", estado: "ok", proveedor: "gemini", ms: 1200 };
const E: EventoConstruccion = { tipo: "error", mensaje: "Algo falló" };

function armar() {
  const eventos: EventoConstruccion[] = [];
  const avisos: string[] = [];
  return { eventos, avisos, parser: crearParserNdjson((e) => eventos.push(e), (a) => avisos.push(a)) };
}

describe("parser NDJSON", () => {
  it("emite una línea completa por evento", () => {
    const { parser, eventos } = armar();
    parser.empujar(JSON.stringify(A) + "\n");
    expect(eventos).toEqual([A]);
  });

  it("junta una línea partida entre chunks", () => {
    const { parser, eventos } = armar();
    const linea = JSON.stringify(B) + "\n";
    parser.empujar(linea.slice(0, 15));
    expect(eventos).toHaveLength(0);
    parser.empujar(linea.slice(15, 40));
    expect(eventos).toHaveLength(0);
    parser.empujar(linea.slice(40));
    expect(eventos).toEqual([B]);
  });

  it("procesa varias líneas en un mismo chunk", () => {
    const { parser, eventos } = armar();
    parser.empujar([A, B, E].map((e) => JSON.stringify(e)).join("\n") + "\n");
    expect(eventos).toEqual([A, B, E]);
  });

  it("varias líneas y una partida al final del chunk", () => {
    const { parser, eventos } = armar();
    const b = JSON.stringify(B);
    parser.empujar(JSON.stringify(A) + "\n" + b.slice(0, 10));
    expect(eventos).toEqual([A]);
    parser.empujar(b.slice(10) + "\n");
    expect(eventos).toEqual([A, B]);
  });

  it("ignora con aviso una línea inválida y sigue con las demás", () => {
    const { parser, eventos, avisos } = armar();
    parser.empujar(JSON.stringify(A) + "\nesto no es json\n" + JSON.stringify(B) + "\n");
    expect(eventos).toEqual([A, B]);
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toMatch(/no es JSON/);
  });

  it("ignora con aviso un JSON que no es un evento conocido", () => {
    const { parser, eventos, avisos } = armar();
    parser.empujar('{"tipo":"otro"}\n{"sin":"tipo"}\n[1,2]\n');
    expect(eventos).toEqual([]);
    expect(avisos).toHaveLength(3);
  });

  it("ignora líneas en blanco (incluido \\r\\n)", () => {
    const { parser, eventos, avisos } = armar();
    parser.empujar("\n\r\n" + JSON.stringify(A) + "\r\n\n");
    expect(eventos).toEqual([A]);
    expect(avisos).toEqual([]);
  });

  it("al cerrar procesa la última línea sin salto final", () => {
    const { parser, eventos } = armar();
    parser.empujar(JSON.stringify(E));
    expect(eventos).toHaveLength(0);
    parser.cerrar();
    expect(eventos).toEqual([E]);
  });
});

describe("leerFlujoNdjson", () => {
  it("lee un ReadableStream con caracteres multibyte partidos entre chunks", async () => {
    const evento: EventoConstruccion = { tipo: "error", mensaje: "Fallé con ñ y acentos: áéíóú ✓" };
    const bytes = new TextEncoder().encode(JSON.stringify(evento) + "\n");
    // Corta en mitad de un carácter de varios bytes.
    const corte = bytes.indexOf(0xc3) + 1;
    const flujo = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(bytes.slice(0, corte));
        c.enqueue(bytes.slice(corte));
        c.close();
      },
    });
    const eventos: EventoConstruccion[] = [];
    await leerFlujoNdjson(flujo, (e) => eventos.push(e));
    expect(eventos).toEqual([evento]);
  });
});
