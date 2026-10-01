import { describe, expect, it } from "vitest";
import { CATALOGO_EFECTOS, MAX_EFECTOS_NIVEL_3 } from "@/lib/contratos";
import { CATALOGO_CLIENTE, MAX_NIVEL_3_CLIENTE } from "@/efectos/catalogo-cliente";

describe("catálogo de efectos del cliente", () => {
  it("es idéntico al de contratos (evita bajar zod al navegador sin desincronizarse)", () => {
    expect(CATALOGO_CLIENTE).toEqual(CATALOGO_EFECTOS);
    expect(MAX_NIVEL_3_CLIENTE).toBe(MAX_EFECTOS_NIVEL_3);
  });
});
