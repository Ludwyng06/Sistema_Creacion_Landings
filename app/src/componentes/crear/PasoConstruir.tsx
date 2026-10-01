"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { PromptEstructurado, TecnicaId } from "@/lib/contratos";
import { aBrief, type BorradorBrief } from "./borrador";
import type { Lado } from "@/lib/ia/duelo";
import { construir, construirDuelo, enviarManual, guardarLanding } from "./api";
import {
  CONSTRUCCION_INICIAL,
  NOMBRE_ESTADO_TAREA,
  NOMBRE_SALUD,
  NOMBRE_TAREA,
  NOMBRE_VALIDADOR,
  reducirConstruccion,
  type EstadoConstruccion,
} from "./construccion";
import { DUELO_INICIAL, reducirDuelo } from "./duelo";
import { PanelDuelo } from "./PanelDuelo";
import { BOTON_PRIMARIO, BOTON_SECUNDARIO, CLASE_CONTROL, ESTILO_SALUD, MARCA_SALUD, TITULO_SECCION } from "./estilos";
import { MarcoVistaPrevia } from "./VistaPreviaLanding";

const MARCA_TAREA = { "en-curso": "…", ok: "✓", error: "✕", omitida: "–" } as const;

interface Props {
  brief: BorradorBrief;
  tecnicas: TecnicaId[];
  numeroSemilla?: number;
  prompt: PromptEstructurado | null;
  /** Empieza a construir al mostrarse (cuando se llega desde «Construir» del paso 3). */
  autoIniciar: boolean;
  onAbrirEditor: (id: string) => void;
}

async function copiar(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}

function Resultado({
  estado,
  onGuardar,
  guardando,
  errorGuardar,
}: {
  estado: EstadoConstruccion;
  onGuardar: () => void;
  guardando: boolean;
  errorGuardar: string | null;
}) {
  const r = estado.resultado!;
  const puntaje = r.doc.critica?.puntaje;
  const avisos = [...r.avisos, ...estado.avisos];
  return (
    <section aria-labelledby="resultado-titulo" className="flex flex-col gap-6">
      <div>
        <h3 id="resultado-titulo" className="font-editorial text-xl font-semibold">
          Tu landing está lista
        </h3>
        <p className="mt-1 text-sm text-tinta-suave">
          {r.doc.meta.nombre}
          {r.vueltasCritico > 0 && ` · el crítico la revisó en ${r.vueltasCritico} ${r.vueltasCritico === 1 ? "vuelta" : "vueltas"}`}
        </p>
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <ul aria-label="Salud de la landing" className="flex flex-1 flex-wrap gap-2" data-salud>
          {r.salud.map((v) => (
            <li
              key={v.id}
              data-validador={v.id}
              data-estado={v.estado}
              title={v.problemas.map((p) => p.mensaje).join("\n") || undefined}
              className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${ESTILO_SALUD[v.estado]}`}
            >
              <span aria-hidden="true">{MARCA_SALUD[v.estado]}</span>
              {NOMBRE_VALIDADOR[v.id]}
              <span className="sr-only">: </span>
              <span className="text-xs">{NOMBRE_SALUD[v.estado]}</span>
            </li>
          ))}
        </ul>
        {puntaje !== undefined && (
          <p className="rounded-md border border-linea px-4 py-2 text-sm" data-puntaje>
            Puntaje del crítico <strong className="font-editorial text-2xl">{puntaje.toString().replace(".", ",")}</strong>
            <span className="text-tinta-suave"> / 10</span>
          </p>
        )}
      </div>

      {r.salud.some((v) => v.problemas.length > 0) && (
        <details className="rounded-md border border-linea p-4">
          <summary className="min-h-11 cursor-pointer font-medium">Ver los detalles de la salud</summary>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {r.salud.flatMap((v) =>
              v.problemas.map((p, i) => (
                <li key={`${v.id}-${i}`}>
                  <strong>{NOMBRE_VALIDADOR[v.id]}</strong> · <code>{p.ruta}</code>: {p.mensaje}
                </li>
              )),
            )}
          </ul>
        </details>
      )}

      {avisos.length > 0 && (
        <ul className="list-disc pl-5 text-sm text-tinta-suave" data-avisos>
          {avisos.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
      )}

      <MarcoVistaPrevia doc={r.doc} medirAntiSplit />

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={BOTON_PRIMARIO} onClick={onGuardar} disabled={guardando}>
          {guardando ? "Guardando…" : "Guardar y abrir en el editor"}
        </button>
        {errorGuardar && (
          <p role="alert" className="text-sm text-error">
            {errorGuardar}
          </p>
        )}
      </div>
    </section>
  );
}

function PanelManual({
  estado,
  brief,
  onResultado,
  onCopiar,
}: {
  estado: EstadoConstruccion;
  brief: BorradorBrief;
  onResultado: (r: NonNullable<EstadoConstruccion["resultado"]>) => void;
  onCopiar: (texto: string) => Promise<boolean>;
}) {
  const manual = estado.manual!;
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  async function copiarParte(clave: string, contenido: string) {
    setCopiado((await onCopiar(contenido)) ? clave : "error");
  }

  async function validar() {
    setError(null);
    let base;
    try {
      base = aBrief(brief);
    } catch {
      setError("Vuelve al paso 1: el brief ya no es válido.");
      return;
    }
    setEnviando(true);
    try {
      const { doc, salud } = await enviarManual(texto, base);
      onResultado({ doc, salud, vueltasCritico: 0, proveedores: {}, avisos: ["Landing pegada a mano: pasó por los mismos validadores."] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos validar el JSON.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section aria-labelledby="manual-titulo" className="flex flex-col gap-6 rounded-md border border-marca p-4 md:p-6" data-panel-manual>
      <div>
        <h3 id="manual-titulo" className="font-editorial text-xl font-semibold">
          Ningún proveedor respondió: sigue a mano
        </h3>
        <p className="mt-1 text-sm text-tinta-suave">
          Copia el prompt en el chat de tu IA favorita, pide el JSON del <code>LandingDoc</code> y pégalo abajo.
        </p>
      </div>

      {manual.intentos.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-medium">Intentos fallidos</h4>
          <ul className="flex flex-col gap-1 text-sm" data-intentos>
            {manual.intentos.map((i, n) => (
              <li key={n}>
                <strong>{i.proveedor}</strong> · {i.tipo}: {i.mensaje}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {(
          [
            ["sistema", "Prompt de sistema", manual.prompt.sistema],
            ["usuario", "Prompt de usuario", manual.prompt.usuario],
          ] as const
        ).map(([clave, titulo, contenido]) => (
          <div key={clave}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h4 className="text-sm font-medium">{titulo}</h4>
              <button
                type="button"
                className={BOTON_SECUNDARIO}
                aria-label={`Copiar ${titulo.toLowerCase()}`}
                onClick={() => copiarParte(clave, contenido)}
              >
                {copiado === clave ? "Copiado" : "Copiar"}
              </button>
            </div>
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-linea bg-papel-hondo p-3 text-xs">{contenido}</pre>
          </div>
        ))}
      </div>
      <p role="status" aria-live="polite" className="-mt-3 text-sm text-tinta-suave">
        {copiado === "error" && "No se pudo copiar: selecciona el texto a mano."}
      </p>

      <div>
        <label htmlFor="manual-json" className="mb-1 block text-sm font-medium">
          JSON de la respuesta
        </label>
        <textarea
          id="manual-json"
          rows={8}
          className={`${CLASE_CONTROL} font-mono text-xs`}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "manual-error" : undefined}
          placeholder="Pega aquí el JSON"
        />
        {error && (
          <pre id="manual-error" role="alert" className="mt-2 whitespace-pre-wrap text-sm text-error">
            {error}
          </pre>
        )}
        <button type="button" className={`${BOTON_PRIMARIO} mt-3`} disabled={enviando || texto.trim() === ""} onClick={validar}>
          {enviando ? "Validando…" : "Validar y ver la landing"}
        </button>
      </div>
    </section>
  );
}

export function PasoConstruir({ brief, tecnicas, numeroSemilla, prompt, autoIniciar, onAbrirEditor }: Props) {
  const [estado, despachar] = useReducer(reducirConstruccion, CONSTRUCCION_INICIAL);
  const [guardando, setGuardando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null);
  const [duelo, despacharDuelo] = useReducer(reducirDuelo, DUELO_INICIAL);
  const [guardandoLado, setGuardandoLado] = useState<Lado | null>(null);
  const [errorGuardarLado, setErrorGuardarLado] = useState<string | null>(null);
  const control = useRef<AbortController | null>(null);

  const iniciarDuelo = useCallback(async () => {
    let base;
    try {
      base = aBrief(brief);
    } catch {
      despacharDuelo({ tipo: "fallo", mensaje: "El brief ya no es válido. Vuelve al paso 1 para corregirlo." });
      return;
    }
    control.current?.abort();
    const c = new AbortController();
    control.current = c;
    despachar({ tipo: "reiniciar" });
    setErrorGuardarLado(null);
    despacharDuelo({ tipo: "iniciar" });
    try {
      await construirDuelo(
        { brief: base, tecnicas, numeroSemilla, prompt: prompt ?? undefined },
        (evento) => despacharDuelo({ tipo: "evento", evento }),
        { senal: c.signal, alAviso: (aviso) => despacharDuelo({ tipo: "aviso", aviso }) },
      );
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      despacharDuelo({ tipo: "fallo", mensaje: e instanceof Error ? e.message : "No pudimos armar el duelo." });
    }
  }, [brief, tecnicas, numeroSemilla, prompt]);

  async function guardarLado(lado: Lado) {
    const doc = (duelo.final?.[lado] ?? duelo[lado].resultado)?.doc;
    if (!doc || !prompt) return;
    setGuardandoLado(lado);
    setErrorGuardarLado(null);
    try {
      const { id } = await guardarLanding({ brief: aBrief(brief), tecnicas, prompt, doc, proveedor: "duelo" });
      onAbrirEditor(id);
    } catch (e) {
      setErrorGuardarLado(e instanceof Error ? e.message : "No pudimos guardar la landing.");
    } finally {
      setGuardandoLado(null);
    }
  }

  const iniciar = useCallback(async () => {
    despacharDuelo({ tipo: "reiniciar" });
    let base;
    try {
      base = aBrief(brief);
    } catch {
      despachar({ tipo: "fallo", mensaje: "El brief ya no es válido. Vuelve al paso 1 para corregirlo." });
      return;
    }
    control.current?.abort();
    const c = new AbortController();
    control.current = c;
    despachar({ tipo: "iniciar" });
    try {
      await construir(
        { brief: base, tecnicas: tecnicas, numeroSemilla, prompt: prompt ?? undefined },
        (evento) => despachar({ tipo: "evento", evento }),
        { senal: c.signal, alAviso: (aviso) => despachar({ tipo: "aviso", aviso }) },
      );
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      despachar({ tipo: "fallo", mensaje: e instanceof Error ? e.message : "No pudimos construir la landing." });
    }
  }, [brief, tecnicas, numeroSemilla, prompt]);

  // Arranca solo al llegar desde «Construir». El cleanup cancela la petición en curso; en modo
  // estricto de React (desarrollo) el efecto se monta dos veces y así la segunda pasada la reinicia.
  useEffect(() => {
    if (autoIniciar) void iniciar();
    return () => control.current?.abort();
  }, [autoIniciar, iniciar]);

  async function guardar() {
    const r = estado.resultado;
    if (!r || !prompt) return;
    setGuardando(true);
    setErrorGuardar(null);
    try {
      const { id } = await guardarLanding({
        brief: aBrief(brief),
        tecnicas,
        prompt,
        doc: r.doc,
        // Sin proveedor (landing pegada a mano) se guarda como «manual».
        proveedor: r.proveedores.landing ?? "manual",
      });
      onAbrirEditor(id);
    } catch (e) {
      setErrorGuardar(e instanceof Error ? e.message : "No pudimos guardar la landing.");
    } finally {
      setGuardando(false);
    }
  }

  const construyendo = estado.fase === "construyendo" || duelo.fase === "corriendo";

  return (
    <div className="flex flex-col gap-8">
      <header className="max-w-2xl">
        <h2 className={TITULO_SECCION}>Construimos tu landing</h2>
        <p className="mt-2 text-tinta-suave">Cada tarea de la IA aparece aquí mientras avanza. Las que son independientes corren a la vez.</p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={BOTON_PRIMARIO} disabled={construyendo} onClick={() => void iniciar()}>
          {estado.fase === "reposo" ? "Construir" : construyendo ? "Construyendo…" : "Construir de nuevo"}
        </button>
        <button type="button" className={BOTON_SECUNDARIO} disabled={construyendo} aria-describedby="duelo-nota" onClick={() => void iniciarDuelo()}>
          {duelo.fase === "corriendo" ? "Duelo en marcha…" : "Construir en duelo"}
        </button>
        <span id="duelo-nota" className="text-sm text-tinta-suave">
          Dos proveedores, un juez: tarda un poco más
        </span>
      </div>

      <div aria-live="polite" aria-label="Progreso de la construcción">
        {estado.filas.length > 0 && (
          <ul className="flex flex-col gap-2" data-progreso>
            {estado.filas.map((f) => (
              <li
                key={f.tarea}
                data-tarea={f.tarea}
                data-estado={f.estado}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-linea px-4 py-3"
              >
                <span
                  aria-hidden="true"
                  className={`grid size-6 place-items-center rounded-full text-xs ${
                    f.estado === "ok" ? "bg-contexto text-marca-texto" : f.estado === "error" ? "bg-error text-marca-texto" : "border border-tinta"
                  } ${f.estado === "en-curso" ? "animate-pulse" : ""}`}
                >
                  {MARCA_TAREA[f.estado]}
                </span>
                <span className="font-medium">{NOMBRE_TAREA[f.tarea]}</span>
                <span className="text-sm">{NOMBRE_ESTADO_TAREA[f.estado]}</span>
                {f.proveedor && <span className="text-sm text-tinta-suave">{f.proveedor}</span>}
                {f.ms !== undefined && <span className="text-sm text-tinta-suave">{(f.ms / 1000).toFixed(1).replace(".", ",")} s</span>}
                {f.mensaje && <span className="basis-full text-sm text-tinta-suave">{f.mensaje}</span>}
              </li>
            ))}
          </ul>
        )}
        {construyendo && estado.filas.length === 0 && <p role="status">Conectando con los proveedores…</p>}
      </div>

      {estado.fase === "error" && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-md border border-error p-4 text-error" data-error-construccion>
          <p>{estado.error}</p>
          <button type="button" className={BOTON_SECUNDARIO} onClick={() => void iniciar()}>
            Reintentar
          </button>
        </div>
      )}

      {estado.fase === "manual" && (
        <PanelManual
          estado={estado}
          brief={brief}
          onCopiar={copiar}
          onResultado={(resultado) => despachar({ tipo: "resultado-manual", resultado })}
        />
      )}

      {duelo.fase === "error" && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-md border border-error p-4 text-error" data-error-duelo>
          <p>{duelo.error}</p>
          <button type="button" className={BOTON_SECUNDARIO} onClick={() => void iniciarDuelo()}>
            Reintentar el duelo
          </button>
        </div>
      )}

      {(duelo.fase === "corriendo" || duelo.fase === "terminado" || (duelo.fase === "error" && (duelo.a.filas.length > 0 || duelo.b.filas.length > 0))) && (
        <PanelDuelo estado={duelo} onGuardar={(lado) => void guardarLado(lado)} guardando={guardandoLado} errorGuardar={errorGuardarLado} />
      )}

      {estado.fase === "resultado" && estado.resultado && (
        <Resultado estado={estado} onGuardar={guardar} guardando={guardando} errorGuardar={errorGuardar} />
      )}
    </div>
  );
}
