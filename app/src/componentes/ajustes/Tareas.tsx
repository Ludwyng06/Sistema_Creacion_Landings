"use client";

import { useEffect, useState } from "react";
import { BOTON_PRIMARIO, CLASE_CONTROL, TITULO_SECCION } from "@/componentes/crear/estilos";
import type { ProveedorId, TareaIA } from "@/lib/contratos";
import { guardarTareas, leerTareas } from "./api";
import { NOMBRE_PROVEEDOR, PROVEEDORES_EDITABLES, TAREAS } from "./textos";

type Tabla = Record<TareaIA, Exclude<ProveedorId, "manual">>;

export function Tareas() {
  const [tabla, setTabla] = useState<Tabla | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    leerTareas()
      .then(setTabla)
      .catch((e) => setMensaje({ tipo: "error", texto: e instanceof Error ? e.message : "No se pudo leer la tabla." }));
  }, []);

  async function guardar() {
    if (!tabla) return;
    setGuardando(true);
    setMensaje(null);
    try {
      setTabla(await guardarTareas(tabla));
      setMensaje({ tipo: "ok", texto: "Tabla guardada." });
    } catch (e) {
      setMensaje({ tipo: "error", texto: e instanceof Error ? e.message : "No se pudo guardar." });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section aria-labelledby="titulo-tareas" className="flex flex-col gap-5">
      <div>
        <h2 id="titulo-tareas" className={TITULO_SECCION}>
          Tarea y proveedor
        </h2>
        <p className="text-tinta-suave">En el modo simultáneo cada tarea empieza por su proveedor preferido. Debajo de cada una verás por qué se eligió.</p>
      </div>
      {!tabla && !mensaje && <p role="status">Cargando la tabla…</p>}
      {tabla && (
        <ul className="flex flex-col divide-y divide-linea rounded-md border border-linea" data-testid="tabla-tareas">
          {TAREAS.map((t) => (
            <li key={t.id} className="grid gap-2 p-4 sm:grid-cols-[1fr_14rem] sm:items-start sm:gap-6">
              <div>
                <label htmlFor={`tarea-${t.id}`} className="font-medium">
                  {t.nombre}
                </label>
                <p className="text-sm text-tinta-suave">{t.motivo}</p>
              </div>
              <select
                id={`tarea-${t.id}`}
                value={tabla[t.id]}
                onChange={(e) => setTabla({ ...tabla, [t.id]: e.target.value as Tabla[TareaIA] })}
                className={CLASE_CONTROL}
              >
                {PROVEEDORES_EDITABLES.map((p) => (
                  <option key={p} value={p}>
                    {NOMBRE_PROVEEDOR[p]}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <button type="button" onClick={guardar} disabled={!tabla || guardando} className={BOTON_PRIMARIO}>
          {guardando ? "Guardando…" : "Guardar tabla"}
        </button>
        {mensaje && (
          <p role={mensaje.tipo === "error" ? "alert" : "status"} className={`text-sm ${mensaje.tipo === "error" ? "text-error" : "text-contexto"}`}>
            {mensaje.texto}
          </p>
        )}
      </div>
    </section>
  );
}
