import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { crearAutoguardador, ESPERA_AUTOGUARDADO_MS, ESPERA_REINTENTO_MS, type EstadoGuardado } from "@/componentes/editor/autoguardado";
import { landingEjemplo } from "../fixtures/landing-ejemplo";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const docN = (n: number) => ({ ...landingEjemplo, meta: { ...landingEjemplo.meta, nombre: `v${n}` } });

describe("autoguardado", () => {
  it("varias ediciones seguidas generan 1 PATCH con la última", async () => {
    const fetchSim = vi.fn<(url: string, init: { method: string; body: string }) => Promise<Response>>(async () => new Response("{}", { status: 200 }));
    const estados: EstadoGuardado[] = [];
    const a = crearAutoguardador({
      guardar: async (doc) => {
        const r = await fetchSim("/api/landings/x", { method: "PATCH", body: JSON.stringify({ doc }) });
        if (!r.ok) throw new Error("fallo");
      },
      alEstado: (e) => estados.push(e),
    });
    a.programar(docN(1));
    await vi.advanceTimersByTimeAsync(300);
    a.programar(docN(2));
    await vi.advanceTimersByTimeAsync(300);
    a.programar(docN(3));
    await vi.advanceTimersByTimeAsync(ESPERA_AUTOGUARDADO_MS + 10);
    expect(fetchSim).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchSim.mock.calls[0][1].body).doc.meta.nombre).toBe("v3");
    expect(estados.at(-1)).toBe("guardado");
    expect(estados).toContain("pendiente");
    expect(estados).toContain("guardando");
  });

  it("si el servidor falla, avisa y reintenta hasta guardar", async () => {
    let intento = 0;
    const guardar = vi.fn(async () => {
      intento += 1;
      if (intento === 1) throw new Error("Servidor caído");
    });
    const estados: { e: EstadoGuardado; d?: string }[] = [];
    const a = crearAutoguardador({ guardar, alEstado: (e, d) => estados.push({ e, d }) });
    a.programar(docN(1));
    await vi.advanceTimersByTimeAsync(ESPERA_AUTOGUARDADO_MS + 10);
    expect(estados.some((x) => x.e === "error" && /Reintentando/.test(x.d ?? ""))).toBe(true);
    await vi.advanceTimersByTimeAsync(ESPERA_REINTENTO_MS + 10);
    expect(guardar).toHaveBeenCalledTimes(2);
    expect(estados.at(-1)?.e).toBe("guardado");
  });

  it("vaciar guarda de inmediato lo pendiente", async () => {
    const guardar = vi.fn(async () => {});
    const a = crearAutoguardador({ guardar, alEstado: () => {} });
    a.programar(docN(1));
    await a.vaciar();
    expect(guardar).toHaveBeenCalledTimes(1);
  });
});
