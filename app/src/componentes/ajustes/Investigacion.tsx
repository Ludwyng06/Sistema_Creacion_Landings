"use client";

import { useCallback, useEffect, useState } from "react";
import { BOTON_SECUNDARIO, TITULO_SECCION } from "@/componentes/crear/estilos";

type Estado =
  | { estado: "sin-clave" }
  | { estado: "conectado"; plan?: string; usadasMes: number; limiteMes: number }
  | { estado: "error"; error: string };

async function consultar(metodo: "GET" | "POST"): Promise<Estado> {
  const res = await fetch("/api/ajustes/investigacion", { method: metodo });
  const cuerpo = (await res.json().catch(() => ({}))) as Estado & { error?: string };
  if (!res.ok) return { estado: "error", error: cuerpo.error ?? `La consulta falló (${res.status}).` };
  return cuerpo;
}

const errorDeRed = (): Estado => ({ estado: "error", error: "No se pudo conectar con la app. Revisa que el servidor siga en marcha." });

/** Tarjeta «Investigación (SerpAPI)»: opcional; muestra el estado y las búsquedas del mes contra el plan. */
export function Investigacion() {
  const [datos, setDatos] = useState<Estado | null>(null);
  const [cargando, setCargando] = useState(false);

  const probar = useCallback(async () => {
    setCargando(true);
    setDatos(await consultar("POST").catch(errorDeRed));
    setCargando(false);
  }, []);

  useEffect(() => {
    let vivo = true;
    consultar("GET")
      .catch(errorDeRed)
      .then((d) => vivo && setDatos(d));
    return () => {
      vivo = false;
    };
  }, []);

  const porcentaje = datos?.estado === "conectado" && datos.limiteMes > 0 ? Math.min(100, Math.round((datos.usadasMes / datos.limiteMes) * 100)) : 0;

  return (
    <section aria-labelledby="titulo-investigacion" className="flex flex-col gap-4">
      <h2 id="titulo-investigacion" className={TITULO_SECCION}>
        Investigación (SerpAPI)
      </h2>
      <div className="flex flex-col gap-3 rounded-lg border border-tinta-suave/30 p-4" data-estado={datos?.estado ?? "cargando"}>
        {!datos && <p className="text-sm text-tinta-suave">Consultando…</p>}
        {datos?.estado === "sin-clave" && (
          <>
            <p className="text-sm font-medium">Sin clave (opcional)</p>
            <p className="text-sm text-tinta-suave">
              La investigación del producto es opcional: el sistema funciona igual sin ella. Para usarla, agrega <code>SERPAPI_API_KEY</code> en{" "}
              <code>app/.env.local</code> (serpapi.com/manage-api-key).
            </p>
          </>
        )}
        {datos?.estado === "conectado" && (
          <>
            <p className="text-sm font-medium">Conectado{datos.plan ? ` · plan ${datos.plan}` : ""}</p>
            <div
              role="progressbar"
              aria-label="Búsquedas del mes"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={porcentaje}
              className="h-2 w-full overflow-hidden rounded-full bg-papel-hondo"
            >
              <div className={`h-full ${porcentaje >= 80 ? "bg-tarea" : "bg-marca"}`} style={{ width: `${porcentaje}%` }} />
            </div>
            <p className="text-sm text-tinta-suave">
              Este mes: {datos.usadasMes} de {datos.limiteMes} búsquedas. Cada investigación gasta hasta 3, y repetir el mismo producto en 7 días sale gratis de la caché.
            </p>
          </>
        )}
        {datos?.estado === "error" && (
          <p role="alert" className="text-sm font-medium text-error">
            Con error: {datos.error}
          </p>
        )}
        <div>
          <button type="button" className={BOTON_SECUNDARIO} disabled={cargando} onClick={() => void probar()}>
            {cargando ? "Probando…" : "Probar"}
          </button>
        </div>
      </div>
    </section>
  );
}
