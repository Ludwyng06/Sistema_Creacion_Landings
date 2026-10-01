"use client";

import { useEffect, useState } from "react";
import type { Brief, PromptEstructurado, TecnicaId } from "@/lib/contratos";

interface TecnicaLigera {
  id: TecnicaId;
  numero: number;
  nombre: string;
}

const COLOR_BLOQUE: Record<string, { nombre: string; clase: string }> = {
  rol: { nombre: "Rol", clase: "bg-rol text-marca-texto" },
  tarea: { nombre: "Tarea", clase: "bg-tarea text-marca-texto" },
  contexto: { nombre: "Contexto", clase: "bg-contexto text-marca-texto" },
  formato: { nombre: "Formato", clase: "bg-formato text-marca-texto" },
};

const MAXIMO = 3;
const recortar = (t: string, n = 130) => (t.length > n ? `${t.slice(0, n).trimEnd()}…` : t);

/** Ejemplo pequeño: elige de 2 a 3 técnicas y mira qué aporta cada una al prompt combinado (llama a `/api/prompt`). */
export function EjemploCombinador({ tecnicas, brief }: { tecnicas: TecnicaLigera[]; brief: Brief }) {
  const [elegidas, setElegidas] = useState<TecnicaId[]>(["semilla", "ambicioso"]);
  const [respuesta, setRespuesta] = useState<{ clave: string; prompt?: PromptEstructurado; error?: string } | null>(null);
  const clave = [...elegidas].sort().join(",");

  useEffect(() => {
    const control = new AbortController();
    fetch("/api/prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brief, tecnicas: elegidas, numeroSemilla: 42 }),
      signal: control.signal,
    })
      .then(async (res) => {
        const cuerpo = (await res.json()) as { prompt?: PromptEstructurado; error?: string };
        if (!res.ok || !cuerpo.prompt) throw new Error(cuerpo.error ?? "No se pudo armar el prompt.");
        setRespuesta({ clave, prompt: cuerpo.prompt });
      })
      .catch((e: unknown) => {
        if (control.signal.aborted) return;
        setRespuesta({ clave, error: e instanceof Error ? e.message : "No se pudo armar el prompt." });
      });
    return () => control.abort();
    // `elegidas` y `clave` cambian juntas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, brief]);

  const listo = respuesta?.clave === clave ? respuesta : null;
  const nombre = (id: string) => tecnicas.find((t) => t.id === id)?.nombre ?? id;

  return (
    <div className="flex flex-col gap-5 rounded-md border border-linea p-5" data-testid="ejemplo-combinador">
      <fieldset className="flex flex-col gap-2">
        <legend className="font-medium">Elige hasta {MAXIMO} técnicas</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {tecnicas.map((t) => {
            const marcada = elegidas.includes(t.id);
            return (
              <label key={t.id} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 ${marcada ? "border-marca bg-papel-hondo" : "border-linea"}`}>
                <input
                  type="checkbox"
                  checked={marcada}
                  disabled={!marcada && elegidas.length >= MAXIMO}
                  onChange={() => setElegidas((e) => (marcada ? e.filter((x) => x !== t.id) : [...e, t.id]))}
                  className="size-5 accent-marca"
                />
                <span>
                  {t.numero} · {t.nombre}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div aria-live="polite" className="flex flex-col gap-4">
        {!listo && <p role="status">Armando el prompt…</p>}
        {listo?.error && (
          <p role="alert" className="text-error">
            {listo.error}
          </p>
        )}
        {listo?.prompt && (
          <>
            <p className="text-sm text-tinta-suave">
              {elegidas.length === 0
                ? "Sin técnicas elegidas, el sistema usa el perfil Esencial (2 + 6 + 7)."
                : "La técnica 7 se suma siempre, aunque no la marques."}{" "}
              Los aportes salen en el orden de aplicación.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[30rem] text-left text-sm" data-testid="aportes">
                <caption className="sr-only">Técnica, qué aportó y en qué bloque</caption>
                <thead>
                  <tr className="border-b border-linea">
                    <th scope="col" className="py-2 pr-3">Técnica</th>
                    <th scope="col" className="py-2 pr-3">Qué aportó</th>
                    <th scope="col" className="py-2">Bloque</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-linea">
                  {listo.prompt.aportes
                    .filter((a) => a.tecnica !== "negativas" || a.bloque !== "contexto")
                    .map((a, i) => (
                      <tr key={i}>
                        <td className="py-2 pr-3 align-top font-medium">{nombre(a.tecnica)}</td>
                        <td className="py-2 pr-3 align-top">{recortar(a.texto)}</td>
                        <td className="py-2 align-top">
                          <span className={`inline-block rounded-sm px-2 py-0.5 text-xs font-medium ${COLOR_BLOQUE[a.bloque].clase}`}>{COLOR_BLOQUE[a.bloque].nombre}</span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <div>
              <h4 className="font-medium">Rol combinado</h4>
              <p className="rounded-md border border-rol bg-rol-suave p-3 text-sm">{listo.prompt.rol}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
