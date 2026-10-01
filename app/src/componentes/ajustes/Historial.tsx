"use client";

import { useEffect, useState } from "react";
import { TITULO_SECCION } from "@/componentes/crear/estilos";
import { leerUso, type UsoResumen } from "./api";
import { NOMBRE_PROVEEDOR } from "./textos";

const nombre = (id: string) => NOMBRE_PROVEEDOR[id as keyof typeof NOMBRE_PROVEEDOR] ?? id;

export function Historial() {
  const [uso, setUso] = useState<UsoResumen | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    leerUso(7)
      .then(setUso)
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudo leer el historial."));
  }, []);

  const maximo = Math.max(1, ...(uso?.porDiaProveedor.map((f) => f.total) ?? [1]));

  return (
    <section aria-labelledby="titulo-historial" className="flex flex-col gap-5">
      <div>
        <h2 id="titulo-historial" className={TITULO_SECCION}>
          Historial de uso
        </h2>
        <p className="text-tinta-suave">Llamadas de los últimos 7 días, por día y proveedor.</p>
      </div>
      {error && (
        <p role="alert" className="rounded-md border border-error p-4 text-error">
          {error}
        </p>
      )}
      {!uso && !error && <p role="status">Cargando el historial…</p>}
      {uso?.avisos.map((a) => (
        <p key={a} role="status" className="rounded-md border border-tarea bg-tarea-suave p-3 text-sm">
          {a}
        </p>
      ))}
      {uso && uso.porDiaProveedor.length === 0 && <p className="rounded-md border border-linea p-4 text-tinta-suave">Todavía no hay llamadas registradas.</p>}
      {uso && uso.porDiaProveedor.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-linea">
          <table className="w-full min-w-[32rem] text-left text-sm" data-testid="tabla-uso">
            <caption className="sr-only">Uso de la IA por día y proveedor</caption>
            <thead className="bg-papel-hondo">
              <tr>
                <th scope="col" className="p-3">
                  Día
                </th>
                <th scope="col" className="p-3">
                  Proveedor
                </th>
                <th scope="col" className="p-3">
                  Llamadas
                </th>
                <th scope="col" className="p-3">
                  Errores
                </th>
                <th scope="col" className="p-3">
                  ms promedio
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-linea">
              {uso.porDiaProveedor.map((f) => (
                <tr key={`${f.fecha}-${f.proveedor}`}>
                  <td className="p-3">{f.fecha}</td>
                  <td className="p-3">{nombre(f.proveedor)}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="w-8 tabular-nums">{f.total}</span>
                      <span aria-hidden="true" className="h-2 rounded-full bg-marca" style={{ width: `${Math.max(4, (f.total / maximo) * 100)}px` }} />
                    </div>
                  </td>
                  <td className={`p-3 tabular-nums ${f.errores > 0 ? "font-medium text-error" : ""}`}>{f.errores}</td>
                  <td className="p-3 tabular-nums">{f.msPromedio}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {uso && uso.errores.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="font-editorial text-xl font-semibold">Errores frecuentes</h3>
          <ul className="flex flex-col gap-1 text-sm">
            {uso.errores.slice(0, 5).map((e) => (
              <li key={`${e.proveedor}-${e.tipo}`}>
                <strong>{nombre(e.proveedor)}</strong> · {e.tipo} · {e.cantidad} {e.cantidad === 1 ? "vez" : "veces"}: {e.ultimo}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
