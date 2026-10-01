"use client";

import { useEffect, useState } from "react";
import { TITULO_SECCION } from "@/componentes/crear/estilos";
import { NOMBRE_PROVEEDOR } from "./textos";

/**
 * Forma que se espera de `GET /api/ia/uso` (24-A): lo gastado hoy por proveedor y, si hay presupuesto diario, cuánto va.
 * Todo salvo `proveedor` es opcional: la tabla muestra lo que llegue.
 */
export interface FilaUsoHoy {
  proveedor: string;
  modelo?: string;
  llamadas?: number;
  tokensEntrada?: number;
  tokensSalida?: number;
  /** Costo estimado en USD. */
  usd?: number;
  /** Presupuesto diario en USD (OpenAI). */
  presupuestoUsd?: number | null;
}
export interface UsoHoy {
  fecha?: string;
  proveedores: FilaUsoHoy[];
  totalUsd?: number;
}

const nombre = (id: string) => NOMBRE_PROVEEDOR[id as keyof typeof NOMBRE_PROVEEDOR] ?? id;
const entero = (n: number | undefined) => (n === undefined ? "—" : new Intl.NumberFormat("es-CO").format(n));
const dolares = (n: number | undefined) => (n === undefined ? "—" : `USD ${n.toFixed(n < 1 ? 3 : 2).replace(".", ",")}`);

/** Lee la respuesta con tolerancia: acepta `{ proveedores }` o una lista suelta. */
export function leerUsoHoy(dato: unknown): UsoHoy | null {
  const lista = Array.isArray(dato) ? dato : (dato as { proveedores?: unknown } | null)?.proveedores;
  if (!Array.isArray(lista)) return null;
  const proveedores = lista.filter((f): f is FilaUsoHoy => !!f && typeof (f as FilaUsoHoy).proveedor === "string");
  const total = (dato as { totalUsd?: unknown } | null)?.totalUsd;
  const suma = proveedores.reduce((n, f) => n + (f.usd ?? 0), 0);
  return { fecha: (dato as { fecha?: string } | null)?.fecha, proveedores, totalUsd: typeof total === "number" ? total : suma };
}

export function UsoHoy() {
  const [uso, setUso] = useState<UsoHoy | null>(null);
  const [estado, setEstado] = useState<"cargando" | "listo" | "no-disponible" | "error">("cargando");

  useEffect(() => {
    let vigente = true;
    fetch("/api/ia/uso")
      .then(async (r) => {
        if (!vigente) return;
        if (r.status === 404) return setEstado("no-disponible");
        if (!r.ok) return setEstado("error");
        const leido = leerUsoHoy(await r.json());
        if (!leido) return setEstado("error");
        setUso(leido);
        setEstado("listo");
      })
      .catch(() => vigente && setEstado("error"));
    return () => {
      vigente = false;
    };
  }, []);

  // Mientras el motor no exponga la ruta no hay nada que enseñar: el panel no aparece.
  if (estado === "no-disponible") return null;

  return (
    <section aria-labelledby="titulo-uso-hoy" className="flex flex-col gap-5" data-uso-hoy>
      <div>
        <h2 id="titulo-uso-hoy" className={TITULO_SECCION}>
          Uso de IA de hoy
        </h2>
        <p className="text-tinta-suave">Tokens y costo estimado por proveedor. Al llegar al presupuesto diario, el sistema pasa solo a otro proveedor.</p>
      </div>
      {estado === "cargando" && <p role="status">Cargando el uso de hoy…</p>}
      {estado === "error" && (
        <p role="alert" className="rounded-md border border-error p-4 text-error">
          No pudimos leer el uso de hoy. Inténtalo de nuevo en unos minutos.
        </p>
      )}
      {uso && uso.proveedores.length === 0 && <p className="rounded-md border border-linea p-4 text-tinta-suave">Hoy todavía no se ha usado la IA.</p>}
      {uso && uso.proveedores.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-linea">
          <table className="w-full min-w-[34rem] text-left text-sm" data-testid="tabla-uso-hoy">
            <caption className="sr-only">Tokens y costo estimado de hoy por proveedor</caption>
            <thead className="bg-papel-hondo">
              <tr>
                <th scope="col" className="p-3">Proveedor</th>
                <th scope="col" className="p-3 text-right">Llamadas</th>
                <th scope="col" className="p-3 text-right">Tokens de entrada</th>
                <th scope="col" className="p-3 text-right">Tokens de salida</th>
                <th scope="col" className="p-3 text-right">Costo estimado</th>
              </tr>
            </thead>
            <tbody>
              {uso.proveedores.map((f) => {
                const pct = f.presupuestoUsd && f.usd !== undefined ? Math.min(100, Math.round((f.usd / f.presupuestoUsd) * 100)) : null;
                return (
                  <tr key={f.proveedor} className="border-t border-linea">
                    <th scope="row" className="p-3 font-medium">
                      {nombre(f.proveedor)}
                      {f.modelo && <span className="block text-xs font-normal text-tinta-suave">{f.modelo}</span>}
                    </th>
                    <td className="p-3 text-right tabular-nums">{entero(f.llamadas)}</td>
                    <td className="p-3 text-right tabular-nums">{entero(f.tokensEntrada)}</td>
                    <td className="p-3 text-right tabular-nums">{entero(f.tokensSalida)}</td>
                    <td className="p-3 text-right tabular-nums">
                      {dolares(f.usd)}
                      {pct !== null && <span className="block text-xs text-tinta-suave">{pct} % de {dolares(f.presupuestoUsd ?? undefined)} al día</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t border-linea bg-papel-hondo">
              <tr>
                <th scope="row" className="p-3" colSpan={4}>Total de hoy</th>
                <td className="p-3 text-right font-medium tabular-nums">{dolares(uso.totalUsd)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
