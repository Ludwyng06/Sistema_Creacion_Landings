"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BOTON_PEQUENO, BOTON_PRIMARIO, CLASE_CONTROL } from "@/componentes/crear/estilos";
import {
  FILTROS_VACIOS,
  NOMBRE_INTENSIDAD,
  NOMBRE_TEMATICA,
  NOMBRE_TECNICA,
  filtrarTarjetas,
  opcionesFiltro,
  type FiltrosBanco,
  type OrdenBanco,
  type TarjetaBanco,
  type Tematica,
} from "@/lib/banco";
import type { TecnicaId } from "@/lib/contratos";
import { Tarjeta } from "./Tarjeta";

export function EstadoVacio() {
  return (
    <section aria-labelledby="banco-vacio" data-banco-vacio className="flex flex-col items-start gap-4 rounded-md border border-dashed border-linea p-6">
      <h2 id="banco-vacio" className="font-editorial text-2xl font-semibold">
        El banco está vacío
      </h2>
      <p className="max-w-2xl text-tinta-suave">
        Aquí queda cada landing junto al prompt que la creó. Crea una desde el asistente y guárdala en el banco desde el editor.
      </p>
      <Link href="/crear" className={BOTON_PRIMARIO}>
        Crear mi primera landing
      </Link>
      <div className="max-w-2xl text-sm text-tinta-suave">
        <p>
          Para llenar el banco con los 5 ejemplos, abre una terminal en la carpeta <code>app</code> y ejecuta <code>npm run db:semilla</code>. Sin claves de IA usa{" "}
          <code>npm run db:semilla -- --desde-json</code>. Luego <code>npm run capturas</code> genera las miniaturas.
        </p>
      </div>
    </section>
  );
}

export function Galeria({ tarjetas }: { tarjetas: TarjetaBanco[] }) {
  const [f, setF] = useState<FiltrosBanco>(FILTROS_VACIOS);
  const opciones = useMemo(() => opcionesFiltro(tarjetas), [tarjetas]);
  const visibles = useMemo(() => filtrarTarjetas(tarjetas, f), [tarjetas, f]);
  const hayFiltros = JSON.stringify(f) !== JSON.stringify(FILTROS_VACIOS);
  const cambiar = <K extends keyof FiltrosBanco>(k: K, v: FiltrosBanco[K]) => setF((a) => ({ ...a, [k]: v }));

  if (tarjetas.length === 0) return <EstadoVacio />;

  return (
    <div className="flex flex-col gap-6">
      <form role="search" aria-label="Filtrar el banco" onSubmit={(e) => e.preventDefault()} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-filtros>
        <label className="flex flex-col gap-1 sm:col-span-2 lg:col-span-2">
          <span className="text-sm font-medium">Buscar</span>
          <input type="search" value={f.busqueda} onChange={(e) => cambiar("busqueda", e.target.value)} placeholder="Nombre, producto o técnica" className={CLASE_CONTROL} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Técnica</span>
          <select value={f.tecnica} onChange={(e) => cambiar("tecnica", e.target.value as TecnicaId | "")} className={CLASE_CONTROL}>
            <option value="">Todas</option>
            {opciones.tecnicas.map((id) => (
              <option key={id} value={id}>
                {NOMBRE_TECNICA(id)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Temática</span>
          <select value={f.tematica} onChange={(e) => cambiar("tematica", e.target.value as Tematica | "")} className={CLASE_CONTROL}>
            <option value="">Todas</option>
            {opciones.tematicas.map((t) => (
              <option key={t} value={t}>
                {NOMBRE_TEMATICA[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Proveedor</span>
          <select value={f.proveedor} onChange={(e) => cambiar("proveedor", e.target.value)} className={CLASE_CONTROL}>
            <option value="">Todos</option>
            {opciones.proveedores.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Intensidad</span>
          <select value={f.intensidad} onChange={(e) => cambiar("intensidad", Number(e.target.value) as FiltrosBanco["intensidad"])} className={CLASE_CONTROL}>
            <option value={0}>Todas</option>
            {opciones.intensidades.map((i) => (
              <option key={i} value={i}>
                {i} · {NOMBRE_INTENSIDAD[i][0].toUpperCase() + NOMBRE_INTENSIDAD[i].slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Orden</span>
          <select value={f.orden} onChange={(e) => cambiar("orden", e.target.value as OrdenBanco)} className={CLASE_CONTROL}>
            <option value="recientes">Más recientes</option>
            <option value="puntaje">Mejor puntaje</option>
          </select>
        </label>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" aria-live="polite" data-conteo className="text-sm text-tinta-suave">
          Mostrando {visibles.length} de {tarjetas.length} {tarjetas.length === 1 ? "landing" : "landings"}
        </p>
        {hayFiltros && (
          <button type="button" onClick={() => setF(FILTROS_VACIOS)} className={BOTON_PEQUENO}>
            Limpiar filtros
          </button>
        )}
      </div>

      {visibles.length === 0 ? (
        <p data-sin-resultados className="rounded-md border border-dashed border-linea p-6 text-tinta-suave">
          Ninguna landing coincide con esos filtros. Prueba con menos condiciones o limpia los filtros.
        </p>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" data-rejilla>
          {visibles.map((t) => (
            <Tarjeta key={t.id} t={t} />
          ))}
        </ul>
      )}
    </div>
  );
}
