"use client";

import { useCallback, useEffect, useState } from "react";
import { BOTON_PRIMARIO, BOTON_SECUNDARIO, TITULO_SECCION } from "@/componentes/crear/estilos";
import { leerProveedores, probar, type ProveedorAjuste, type ResultadoPrueba } from "./api";
import { ENLACES_CLAVES, ETIQUETA_ESTADO, ETIQUETA_SIN_CLAVE } from "./textos";

const PUNTO: Record<string, string> = {
  "sin-clave": "border border-tinta-suave bg-papel",
  conectado: "bg-contexto",
  limite: "bg-tarea",
  error: "bg-error",
  "sin-probar": "bg-tinta-suave",
};

function Semaforo({ estado, etiqueta }: { estado: string; etiqueta?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm font-medium" data-estado={estado}>
      <span aria-hidden="true" className={`inline-block size-3 rounded-full ${PUNTO[estado] ?? PUNTO["sin-probar"]}`} />
      {etiqueta ?? ETIQUETA_ESTADO[estado] ?? estado}
    </span>
  );
}

function BarraUso({ p }: { p: ProveedorAjuste }) {
  if (p.limiteDiario === null) {
    return <p className="text-sm text-tinta-suave">Hoy: {p.usoHoy} peticiones. Este proveedor no tiene un límite diario fijo.</p>;
  }
  const porcentaje = Math.min(100, p.porcentaje ?? 0);
  const aviso = (p.porcentaje ?? 0) >= 80;
  return (
    <div className="flex flex-col gap-1">
      <div
        role="progressbar"
        aria-label={`Uso de hoy de ${p.nombre}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(porcentaje)}
        className="h-2 w-full overflow-hidden rounded-full bg-papel-hondo"
      >
        <div className={`h-full ${aviso ? "bg-tarea" : "bg-marca"}`} style={{ width: `${porcentaje}%` }} />
      </div>
      <p className="text-sm text-tinta-suave">
        Hoy: {p.usoHoy} de {p.limiteDiario} peticiones ({p.porcentaje ?? 0} %).
      </p>
      {aviso && (
        <p role="status" className="text-sm font-medium text-tarea">
          Vas por el {p.porcentaje} % del límite de hoy: conviene dejar descansar a este proveedor.
        </p>
      )}
    </div>
  );
}

function AyudaSinClaves() {
  return (
    <section aria-labelledby="ayuda-claves" className="flex flex-col gap-3 rounded-md border border-marca bg-papel-hondo p-5">
      <h3 id="ayuda-claves" className="font-editorial text-xl font-semibold">
        Todavía no hay ninguna clave
      </h3>
      <p>Las claves viven solo en un archivo de tu computador. Esta pantalla nunca las muestra ni las pide.</p>
      <ol className="ml-5 list-decimal space-y-1">
        <li>
          Dentro de la carpeta <code>app</code>, copia <code>.env.example</code> como <code>.env.local</code>.
        </li>
        <li>Crea una clave gratuita en cada servicio y pégala junto al nombre que le corresponde en ese archivo.</li>
        <li>
          Reinicia <code>npm run dev</code> y pulsa «Probar todos».
        </li>
      </ol>
      <ul className="space-y-1 text-sm">
        {ENLACES_CLAVES.map((e) => (
          <li key={e.proveedor}>
            <strong>{e.proveedor}:</strong>{" "}
            <a href={e.url} target="_blank" rel="noreferrer" className="text-marca underline">
              {e.texto}
            </a>
          </li>
        ))}
      </ul>
      <p className="text-sm text-tinta-suave">Mientras tanto puedes trabajar en modo manual: copia el prompt, pégalo en Claude o Grok y pega la respuesta.</p>
    </section>
  );
}

export function Proveedores() {
  const [lista, setLista] = useState<ProveedorAjuste[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [probando, setProbando] = useState<string | null>(null);
  const [resultados, setResultados] = useState<Record<string, ResultadoPrueba>>({});

  const cargar = useCallback(async () => {
    try {
      setLista(await leerProveedores());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron leer los proveedores.");
    }
  }, []);

  useEffect(() => {
    let vivo = true;
    leerProveedores()
      .then((l) => vivo && setLista(l))
      .catch((e) => vivo && setError(e instanceof Error ? e.message : "No se pudieron leer los proveedores."));
    return () => {
      vivo = false;
    };
  }, []);

  async function ejecutar(id?: ProveedorAjuste["id"]) {
    setProbando(id ?? "todos");
    try {
      const r = await probar(id === "manual" ? undefined : id);
      setResultados((antes) => ({ ...antes, ...Object.fromEntries(r.map((x) => [x.id, x])) }));
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "La prueba falló.");
    } finally {
      setProbando(null);
    }
  }

  const sinClaves = lista !== null && lista.filter((p) => p.id !== "manual").every((p) => !p.tieneClave);

  return (
    <section aria-labelledby="titulo-proveedores" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="titulo-proveedores" className={TITULO_SECCION}>
            Proveedores
          </h2>
          <p className="text-tinta-suave">Cada tarjeta muestra si el proveedor responde y cuánto llevas usado hoy.</p>
        </div>
        <button type="button" onClick={() => ejecutar()} disabled={probando !== null || lista === null} className={BOTON_PRIMARIO}>
          {probando === "todos" ? "Probando…" : "Probar todos"}
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded-md border border-error p-4 text-error">
          {error}
        </p>
      )}
      {!lista && !error && <p role="status">Cargando proveedores…</p>}
      {sinClaves && <AyudaSinClaves />}

      <ul className="grid gap-4 sm:grid-cols-2">
        {lista?.map((p) => {
          const r = resultados[p.id];
          return (
            <li key={p.id} data-proveedor={p.id} className="flex flex-col gap-3 rounded-md border border-linea p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-editorial text-xl font-semibold">{p.nombre}</h3>
                  <p className="text-sm text-tinta-suave">Modelo: {p.modelo}</p>
                </div>
                <Semaforo estado={p.estado} etiqueta={p.estado === "sin-clave" ? ETIQUETA_SIN_CLAVE[p.id] : undefined} />
              </div>
              {p.id !== "manual" && <BarraUso p={p} />}
              {p.id === "manual" && <p className="text-sm text-tinta-suave">Siempre disponible: no usa claves ni llama a ningún servicio.</p>}
              {p.ultimoError && (
                <p className="rounded-sm bg-tarea-suave p-2 text-sm" data-testid="ultimo-error">
                  <span className="font-medium">Último error:</span> {p.ultimoError}
                </p>
              )}
              {r && (
                <p role="status" className={`text-sm ${r.ok ? "text-contexto" : "text-error"}`}>
                  {r.ok ? `Respondió bien en ${r.ms} ms.` : `No respondió (${r.ms} ms): ${r.error ?? "error desconocido"}`}
                </p>
              )}
              {p.id !== "manual" && (
                <button
                  type="button"
                  onClick={() => ejecutar(p.id)}
                  disabled={probando !== null || !p.tieneClave}
                  aria-label={`Probar ${p.nombre}`}
                  className={`${BOTON_SECUNDARIO} self-start`}
                >
                  {probando === p.id ? "Probando…" : "Probar"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
