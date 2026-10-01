"use client";

import { Suspense, lazy, useEffect, useRef, useState, type ReactNode } from "react";
import type { TarjetaBanco } from "./banco-tarjetas";
import { useMovimiento } from "@/efectos/movimiento";
import { CAPITULOS, type IdCapitulo } from "./capitulos";

/**
 * Carga diferida de un capítulo que está debajo del pliegue: su código se descarga y se monta cuando la persona se
 * acerca (una pantalla y media antes). El hueco ya tiene el alto que tendrá el capítulo, así que no hay saltos de diseño.
 */
export function Diferido({ id, children }: { id: IdCapitulo; children: ReactNode }) {
  const capitulo = CAPITULOS.find((c) => c.id === id)!;
  const { reducido } = useMovimiento();
  const [listo, setListo] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      const cuadro = requestAnimationFrame(() => setListo(true));
      return () => cancelAnimationFrame(cuadro);
    }
    const observador = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setListo(true);
          observador.disconnect();
        }
      },
      { rootMargin: "150% 0px" },
    );
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  return (
    <div ref={caja} data-capitulo={capitulo.numero} data-diferido={listo ? "cargado" : "pendiente"} style={{ minHeight: reducido ? "50svh" : `${capitulo.alto}svh` }}>
      {listo && <Suspense fallback={null}>{children}</Suspense>}
    </div>
  );
}

const Tecnicas = lazy(() => import("./capitulos/Tecnicas").then((m) => ({ default: m.Tecnicas })));
const Ensamblaje = lazy(() => import("./capitulos/Ensamblaje").then((m) => ({ default: m.Ensamblaje })));
const Semilla = lazy(() => import("./capitulos/Semilla").then((m) => ({ default: m.Semilla })));
const Critico = lazy(() => import("./capitulos/Critico").then((m) => ({ default: m.Critico })));
const Banco = lazy(() => import("./capitulos/Banco").then((m) => ({ default: m.Banco })));
const Cierre = lazy(() => import("./capitulos/Estaticos").then((m) => ({ default: m.Cierre })));

export const TecnicasDiferido = () => (
  <Diferido id="tecnicas">
    <Tecnicas />
  </Diferido>
);
export const EnsamblajeDiferido = () => (
  <Diferido id="ensamblaje">
    <Ensamblaje />
  </Diferido>
);
export const SemillaDiferido = () => (
  <Diferido id="semilla">
    <Semilla />
  </Diferido>
);
export const CriticoDiferido = () => (
  <Diferido id="critico">
    <Critico />
  </Diferido>
);
export const BancoDiferido = ({ tarjetas }: { tarjetas: TarjetaBanco[] }) => (
  <Diferido id="banco">
    <Banco tarjetas={tarjetas} />
  </Diferido>
);
export const CierreDiferido = () => (
  <Diferido id="cierre">
    <Cierre />
  </Diferido>
);
