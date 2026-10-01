"use client";

import type { Lado } from "@/lib/ia/duelo";
import { NOMBRE_ESTADO_TAREA, NOMBRE_SALUD, NOMBRE_TAREA, NOMBRE_VALIDADOR } from "./construccion";
import { puntajeDe, type EstadoDuelo, type LadoEstado } from "./duelo";
import { BOTON_PRIMARIO, ESTILO_SALUD, MARCA_SALUD } from "./estilos";
import { MarcoVistaPrevia } from "./VistaPreviaLanding";

interface Props {
  estado: EstadoDuelo;
  onGuardar: (lado: Lado) => void;
  guardando: Lado | null;
  errorGuardar: string | null;
}

const NOMBRE_LADO: Record<Lado, string> = { a: "Opción A", b: "Opción B" };
const MARCA_TAREA = { "en-curso": "…", ok: "✓", error: "✕", omitida: "–" } as const;

const formatoPuntaje = (n: number) => n.toFixed(1).replace(".", ",");

function Tarjeta({
  lado,
  datos,
  puntaje,
  ganadora,
  proveedor,
  terminado,
  onGuardar,
  guardando,
}: {
  lado: Lado;
  datos: LadoEstado;
  puntaje: number | null;
  ganadora: boolean;
  proveedor?: string;
  terminado: boolean;
  onGuardar: () => void;
  guardando: boolean;
}) {
  const id = `duelo-${lado}`;
  const resultado = datos.resultado;
  return (
    <article
      aria-labelledby={`${id}-titulo`}
      data-lado={lado}
      data-ganadora={ganadora ? "true" : undefined}
      className={`flex min-w-0 flex-col gap-4 rounded-md border-2 p-4 ${ganadora ? "border-marca bg-papel-hondo" : "border-linea"}`}
    >
      <header className="flex flex-wrap items-center gap-2">
        <h4 id={`${id}-titulo`} className="font-editorial text-xl font-semibold">
          {NOMBRE_LADO[lado]}
        </h4>
        {proveedor && <span className="rounded-full border border-linea px-2 py-0.5 text-xs">{proveedor}</span>}
        {ganadora && <span className="rounded-full bg-marca px-3 py-0.5 text-xs font-medium text-marca-texto">Ganadora del juez</span>}
        {puntaje !== null && (
          <span className="ml-auto text-sm" data-puntaje-juez>
            Puntaje del juez <strong className="font-editorial text-2xl">{formatoPuntaje(puntaje)}</strong>
            <span className="text-tinta-suave"> / 10</span>
          </span>
        )}
      </header>

      {datos.filas.length > 0 && (
        <ul className="flex flex-col gap-1" data-progreso-lado={lado}>
          {datos.filas.map((f) => (
            <li key={f.tarea} data-tarea={f.tarea} data-estado={f.estado} className="flex flex-wrap items-center gap-x-3 text-sm">
              <span aria-hidden="true" className="w-4 text-center">
                {MARCA_TAREA[f.estado]}
              </span>
              <span className="font-medium">{NOMBRE_TAREA[f.tarea]}</span>
              <span>{NOMBRE_ESTADO_TAREA[f.estado]}</span>
              {f.proveedor && <span className="text-tinta-suave">{f.proveedor}</span>}
              {f.ms !== undefined && <span className="text-tinta-suave">{(f.ms / 1000).toFixed(1).replace(".", ",")} s</span>}
            </li>
          ))}
        </ul>
      )}

      {datos.error && (
        <p role="alert" className="text-sm text-error">
          Este lado no pudo construir su landing: {datos.error}
        </p>
      )}
      {datos.manual && <p className="text-sm text-tinta-suave">Este lado agotó sus proveedores y no llegó a una landing.</p>}
      {!resultado && !datos.error && !datos.manual && !terminado && (
        <p role="status" className="text-sm text-tinta-suave">
          Construyendo…
        </p>
      )}

      {resultado && (
        <>
          <ul aria-label={`Salud de la ${NOMBRE_LADO[lado].toLowerCase()}`} className="flex flex-wrap gap-1.5">
            {resultado.salud.map((v) => (
              <li key={v.id} data-estado={v.estado} title={v.problemas.map((p) => p.mensaje).join("\n") || undefined} className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${ESTILO_SALUD[v.estado]}`}>
                <span aria-hidden="true">{MARCA_SALUD[v.estado]}</span>
                {NOMBRE_VALIDADOR[v.id]}
                <span className="sr-only">: {NOMBRE_SALUD[v.estado]}</span>
              </li>
            ))}
          </ul>
          <MarcoVistaPrevia doc={resultado.doc} soloMovil />
          <button type="button" className={`${BOTON_PRIMARIO} self-start`} disabled={guardando} onClick={onGuardar}>
            {guardando ? "Guardando…" : "Guardar esta"}
            <span className="sr-only"> ({NOMBRE_LADO[lado]})</span>
          </button>
        </>
      )}
    </article>
  );
}

/** Las dos opciones del duelo, una junto a la otra como comparación (no forman un héroe). */
export function PanelDuelo({ estado, onGuardar, guardando, errorGuardar }: Props) {
  const final = estado.final;
  const terminado = estado.fase === "terminado";
  return (
    <section aria-labelledby="duelo-titulo" className="flex flex-col gap-4" data-panel-duelo>
      <div>
        <h3 id="duelo-titulo" className="font-editorial text-xl font-semibold">
          Duelo: dos proveedores, una elección
        </h3>
        <p className="mt-1 text-sm text-tinta-suave">Dos proveedores construyen la misma landing y un tercero la puntúa con la rúbrica del crítico. Tú decides cuál guardar.</p>
      </div>

      {final?.juez && (
        <p className="rounded-md border border-linea p-3 text-sm" data-razon-juez>
          <strong>{final.ganador === "empate" ? "Empate." : `Gana la ${NOMBRE_LADO[final.ganador].toLowerCase()}.`}</strong> {final.juez.razon}
          {final.proveedores.juez && <span className="text-tinta-suave"> Juez: {final.proveedores.juez}.</span>}
        </p>
      )}
      {final && !final.juez && <p className="text-sm text-tinta-suave">El juez no pudo puntuar: compara las dos opciones a ojo.</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        {(["a", "b"] as const).map((lado) => (
          <Tarjeta
            key={lado}
            lado={lado}
            datos={estado[lado]}
            puntaje={final ? puntajeDe(final, lado) : null}
            ganadora={final?.ganador === lado}
            proveedor={final?.proveedores[lado]}
            terminado={terminado}
            onGuardar={() => onGuardar(lado)}
            guardando={guardando === lado}
          />
        ))}
      </div>

      {errorGuardar && (
        <p role="alert" className="text-sm text-error">
          {errorGuardar}
        </p>
      )}
      {(final?.avisos.length ?? 0) > 0 && (
        <ul className="list-disc pl-5 text-sm text-tinta-suave">
          {final?.avisos.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
