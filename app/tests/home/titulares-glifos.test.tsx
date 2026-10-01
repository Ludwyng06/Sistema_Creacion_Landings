// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { TitularCinetico } from "@/app/(home)/TitularCinetico";
import { Titular } from "@/componentes/Titular";
import { ProveedorEfectos } from "@/efectos/contexto-efectos";
import { simularMedia } from "../secciones/ayudas";

afterEach(cleanup);

// jsdom no calcula layout: aquí se vigila el contrato de estilos. La medición real de cada glifo contra su máscara
// (p, q, g, tildes) la hace `tests/e2e/dia8-glifos.ts` en el navegador, y falla si una letra sale de su máscara.
describe("titulares con máscara no cortan letras", () => {
  it("cada máscara de palabra es más alta que su línea y compensa el relleno con margen negativo", () => {
    const restaurar = simularMedia({ reducir: false, punteroFino: true });
    const { container } = render(<TitularCinetico texto="Píldoras que ayudan yogur" />);
    const mascaras = container.querySelectorAll("h1 > span.overflow-hidden");
    expect(mascaras.length).toBe(4);
    for (const m of mascaras) {
      expect(m.className).toMatch(/py-\[0\.2\d*em\]/);
      expect(m.className).toMatch(/-my-\[0\.2\d*em\]/);
      expect(m.className).toMatch(/px-\[/);
    }
    restaurar();
  });

  it("el titular por letras del catálogo no usa máscaras que recorten", () => {
    const restaurar = simularMedia({ reducir: false, punteroFino: true });
    const { container } = render(
      <ProveedorEfectos value={["titular-cinetico"]}>
        <Titular>Píldoras que ayudan yogur</Titular>
      </ProveedorEfectos>,
    );
    expect(container.querySelector("[data-efecto='titular-cinetico']")).not.toBeNull();
    expect(container.querySelector(".overflow-hidden")).toBeNull();
    restaurar();
  });
});
