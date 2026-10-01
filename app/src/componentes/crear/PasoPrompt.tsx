"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { BloquePrompt, PromptEstructurado, TecnicaId } from "@/lib/contratos";
import { modulos } from "@/lib/tecnicas/modulos";
import { aTexto } from "@/lib/tecnicas/plantillas";
import { aBrief, type BorradorBrief } from "./borrador";
import { pedirMejora, pedirPrompt } from "./api";
import { BLOQUES, diffPrompt, partirResaltado } from "./diff";
import { BOTON_PRIMARIO, BOTON_SECUNDARIO, TITULO_SECCION } from "./estilos";
import type { RespuestaPrompt } from "./estado";

const ESTILO_BLOQUE: Record<BloquePrompt, { nombre: string; caja: string; titulo: string; marca: string }> = {
  rol: { nombre: "Rol", caja: "border-rol bg-rol-suave", titulo: "text-rol", marca: "bg-rol text-marca-texto" },
  tarea: { nombre: "Tarea", caja: "border-tarea bg-tarea-suave", titulo: "text-tarea", marca: "bg-tarea text-marca-texto" },
  contexto: { nombre: "Contexto", caja: "border-contexto bg-contexto-suave", titulo: "text-contexto", marca: "bg-contexto text-marca-texto" },
  formato: { nombre: "Formato", caja: "border-formato bg-formato-suave", titulo: "text-formato", marca: "bg-formato text-marca-texto" },
};

interface Props {
  brief: BorradorBrief;
  tecnicas: TecnicaId[];
  numeroSemilla?: number;
  respuesta: RespuestaPrompt | null;
  mejorado: PromptEstructurado | null;
  onPrompt: (r: RespuestaPrompt) => void;
  onOtraSemilla: (numero: number) => void;
  onUsarMejorado: (p: PromptEstructurado) => void;
  onDescartarMejorado: () => void;
  onConstruir: () => void;
}

const nombreTecnica = (id: string) => modulos.find((m) => m.id === id)?.nombre ?? id;

export function PasoPrompt({
  brief,
  tecnicas,
  numeroSemilla,
  respuesta,
  mejorado,
  onPrompt,
  onOtraSemilla,
  onUsarMejorado,
  onDescartarMejorado,
  onConstruir,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [reintento, setReintento] = useState(0);
  const [resaltado, setResaltado] = useState<{ bloque: BloquePrompt; texto: string } | null>(null);
  const [copiado, setCopiado] = useState<"reposo" | "ok" | "error">("reposo");
  const [mejora, setMejora] = useState<{ prompt: PromptEstructurado; cambios: string[] } | null>(null);
  const [mejorando, setMejorando] = useState(false);
  const [errorMejora, setErrorMejora] = useState<string | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pide el prompt cuando falta (primera vez, o tras cambiar brief, técnicas o semilla).
  useEffect(() => {
    if (respuesta) return;
    let base;
    try {
      base = aBrief(brief);
    } catch {
      return;
    }
    const control = new AbortController();
    pedirPrompt({ brief: base, tecnicas, numeroSemilla }, control.signal)
      .then((r) => {
        setError(null);
        onPrompt(r);
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError(e instanceof Error ? e.message : "No pudimos armar el prompt.");
      });
    return () => control.abort();
    // `brief`, `tecnicas` y `numeroSemilla` invalidan `respuesta` en el reducer; solo se pide cuando falta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [respuesta, reintento]);

  useEffect(
    () => () => {
      if (temporizador.current) clearTimeout(temporizador.current);
    },
    [],
  );

  const cargando = !respuesta && !error;
  const efectivo = mejorado ?? respuesta?.prompt ?? null;
  const texto = efectivo ? aTexto(efectivo) : "";
  const diff = useMemo(() => (mejora && efectivo ? diffPrompt(efectivo, mejora.prompt) : []), [mejora, efectivo]);

  async function copiar() {
    let siguiente: "ok" | "error" = "ok";
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      siguiente = "error";
    }
    setCopiado(siguiente);
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setCopiado("reposo"), 2200);
  }

  async function mejorar() {
    if (!efectivo) return;
    setMejorando(true);
    setErrorMejora(null);
    try {
      setMejora(await pedirMejora(efectivo));
    } catch (e) {
      setErrorMejora(e instanceof Error ? e.message : "No pudimos mejorar el prompt.");
    } finally {
      setMejorando(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="max-w-2xl">
        <h2 className={TITULO_SECCION}>Tu prompt</h2>
        <p className="mt-2 text-tinta-suave">
          Cuatro bloques, cada uno con su color. Revísalo, mejóralo si quieres y construye la landing.
        </p>
      </header>

      <div aria-live="polite">
        {cargando && <p role="status">Armando el prompt con tus técnicas…</p>}
        {error && (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-md border border-error p-4 text-error">
            <p>{error}</p>
            <button type="button" className={BOTON_SECUNDARIO} onClick={() => {
                setError(null);
                setReintento((n) => n + 1);
              }}>
              Reintentar
            </button>
          </div>
        )}
      </div>

      {respuesta && efectivo && (
        <>
          <div className="flex flex-wrap items-center gap-3" data-semilla>
            <span className="rounded-full border border-linea px-4 py-1.5 text-sm">
              Semilla: <strong>{respuesta.semilla.estilo}</strong> × {respuesta.semilla.industria}
            </span>
            <ul className="flex overflow-hidden rounded-md border border-linea" aria-label="Paleta de la semilla">
              {Object.entries(respuesta.tokens.colores).map(([nombre, color]) => (
                <li key={nombre} title={nombre} className="size-7" style={{ backgroundColor: color }}>
                  <span className="sr-only">{nombre}</span>
                </li>
              ))}
            </ul>
            <button type="button" className={BOTON_SECUNDARIO} onClick={() => onOtraSemilla(Math.floor(Math.random() * 1_000_000))}>
              Otra semilla
            </button>
            {mejorado && <span className="rounded-full bg-marca px-3 py-1 text-xs text-marca-texto">Prompt mejorado en uso</span>}
          </div>

          <div className="grid gap-4 lg:grid-cols-2" data-bloques>
            {BLOQUES.map((b) => {
              const e = ESTILO_BLOQUE[b];
              const partes = partirResaltado(efectivo[b], resaltado?.bloque === b ? resaltado.texto : "");
              const sinFragmento = resaltado?.bloque === b && !partes.some((p) => p.resaltado);
              return (
                <section
                  key={b}
                  data-bloque={b}
                  aria-labelledby={`bloque-${b}`}
                  className={`rounded-md border-l-4 p-4 ${e.caja} ${sinFragmento ? "outline-2 outline-offset-2 outline-tinta" : ""}`}
                >
                  <h3 id={`bloque-${b}`} className={`mb-2 font-editorial text-lg font-semibold ${e.titulo}`}>
                    {e.nombre}
                  </h3>
                  <p
                    tabIndex={0}
                    aria-label={`Texto del bloque ${e.nombre}`}
                    className="max-h-80 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca"
                  >
                    {partes.map((p, i) =>
                      p.resaltado ? (
                        <mark key={i} className={`rounded-sm px-0.5 ${e.marca}`}>
                          {p.texto}
                        </mark>
                      ) : (
                        <span key={i}>{p.texto}</span>
                      ),
                    )}
                  </p>
                </section>
              );
            })}
          </div>

          <section aria-labelledby="aportes-titulo">
            <h3 id="aportes-titulo" className="mb-3 font-editorial text-lg font-semibold">
              Qué aportó cada técnica
            </h3>
            <div className="overflow-x-auto rounded-md border border-linea">
              <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
                <thead className="bg-papel-hondo">
                  <tr>
                    <th scope="col" className="p-3 font-medium">Técnica</th>
                    <th scope="col" className="p-3 font-medium">Qué aportó</th>
                    <th scope="col" className="p-3 font-medium">Bloque</th>
                  </tr>
                </thead>
                <tbody>
                  {efectivo.aportes.map((a, i) => (
                    <tr
                      key={i}
                      tabIndex={0}
                      data-aporte
                      className="border-t border-linea align-top hover:bg-papel-hondo focus-visible:bg-papel-hondo focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-marca"
                      onMouseEnter={() => setResaltado({ bloque: a.bloque, texto: a.texto })}
                      onMouseLeave={() => setResaltado(null)}
                      onFocus={() => setResaltado({ bloque: a.bloque, texto: a.texto })}
                      onBlur={() => setResaltado(null)}
                    >
                      <th scope="row" className="p-3 font-medium">{nombreTecnica(a.tecnica)}</th>
                      <td className="p-3 text-tinta-suave">{a.texto}</td>
                      <td className="p-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs ${ESTILO_BLOQUE[a.bloque].marca}`}>
                          {ESTILO_BLOQUE[a.bloque].nombre}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {mejora && (
            <section aria-labelledby="mejora-titulo" className="rounded-md border border-marca p-4">
              <h3 id="mejora-titulo" className="font-editorial text-lg font-semibold">
                Prompt mejorado
              </h3>
              {mejora.cambios.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-sm">
                  {mejora.cambios.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              )}
              {diff.length === 0 && <p className="mt-3 text-sm text-tinta-suave">La versión mejorada no cambia el texto de los bloques.</p>}
              {diff.map(({ bloque, lineas }) => (
                <div key={bloque} className="mt-4" data-diff={bloque}>
                  <p className={`text-sm font-medium ${ESTILO_BLOQUE[bloque].titulo}`}>{ESTILO_BLOQUE[bloque].nombre}</p>
                  <ul className="mt-1 flex flex-col gap-1 font-mono text-xs">
                    {lineas.map((l, i) => (
                      <li
                        key={i}
                        className={`rounded-sm px-2 py-1 ${l.tipo === "agrega" ? "bg-contexto-suave" : l.tipo === "quita" ? "bg-tarea-suave line-through" : ""}`}
                      >
                        <span aria-hidden="true">{l.tipo === "agrega" ? "+ " : l.tipo === "quita" ? "− " : "  "}</span>
                        <span className="sr-only">{l.tipo === "agrega" ? "Agregado: " : l.tipo === "quita" ? "Quitado: " : "Sin cambio: "}</span>
                        {l.texto}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  className={BOTON_PRIMARIO}
                  onClick={() => {
                    onUsarMejorado(mejora.prompt);
                    setMejora(null);
                  }}
                >
                  Usar mejorado
                </button>
                <button type="button" className={BOTON_SECUNDARIO} onClick={() => setMejora(null)}>
                  Descartar
                </button>
              </div>
            </section>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className={BOTON_SECUNDARIO} onClick={copiar}>
              {copiado === "ok" ? "Prompt copiado" : "Copiar prompt"}
            </button>
            <button type="button" className={BOTON_SECUNDARIO} disabled={mejorando} onClick={mejorar}>
              {mejorando ? "Mejorando…" : "Mejorar"}
            </button>
            {mejorado && (
              <button type="button" className={BOTON_SECUNDARIO} onClick={onDescartarMejorado}>
                Volver al prompt original
              </button>
            )}
            <button type="button" className={BOTON_PRIMARIO} onClick={onConstruir}>
              Construir
            </button>
            <span role="status" aria-live="polite" className="text-sm text-tinta-suave">
              {copiado === "ok" && "Copiado al portapapeles."}
              {copiado === "error" && "No se pudo copiar: selecciona el texto a mano."}
            </span>
          </div>
          {errorMejora && (
            <p role="alert" className="text-sm text-error">
              {errorMejora}
            </p>
          )}
        </>
      )}
    </div>
  );
}
