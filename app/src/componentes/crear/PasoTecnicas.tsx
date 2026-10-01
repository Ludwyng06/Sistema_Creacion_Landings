"use client";

import type { TecnicaId } from "@/lib/contratos";
import { modulos } from "@/lib/tecnicas/modulos";
import { PERFIL_ESENCIAL, tecnicasEfectivas } from "@/lib/tecnicas/combinador";
import { BOTON_SECUNDARIO, TITULO_SECCION } from "./estilos";

const FASES: Record<string, string> = { descubrir: "Descubrir", definir: "Definir", entregar: "Entregar" };

/** La técnica 7 (negativas) siempre se aplica: es el linter de lo que no se debe escribir. */
const SIEMPRE_ACTIVA: TecnicaId = "negativas";

interface Props {
  tecnicas: TecnicaId[];
  onCambio: (tecnicas: TecnicaId[]) => void;
}

export function PasoTecnicas({ tecnicas, onCambio }: Props) {
  const efectivas = tecnicasEfectivas(tecnicas);
  const sinSeleccion = tecnicas.filter((t) => t !== SIEMPRE_ACTIVA).length === 0;
  const esEsencial =
    PERFIL_ESENCIAL.every((t) => tecnicas.includes(t)) &&
    tecnicas.filter((t) => t !== SIEMPRE_ACTIVA).length === PERFIL_ESENCIAL.filter((t) => t !== SIEMPRE_ACTIVA).length;

  function alternar(id: TecnicaId) {
    if (id === SIEMPRE_ACTIVA) return;
    onCambio(tecnicas.includes(id) ? tecnicas.filter((t) => t !== id) : [...tecnicas, id]);
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="max-w-2xl">
        <h2 className={TITULO_SECCION}>Elige las técnicas</h2>
        <p className="mt-2 text-tinta-suave">
          Cada técnica aporta una parte del prompt. Puedes combinar las que quieras: el sistema las ordena y evita que se pisen.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={BOTON_SECUNDARIO} aria-pressed={esEsencial} onClick={() => onCambio([...PERFIL_ESENCIAL])}>
          Usar perfil Esencial
        </button>
        <button type="button" className={BOTON_SECUNDARIO} onClick={() => onCambio([])} disabled={tecnicas.length === 0}>
          Quitar selección
        </button>
        {sinSeleccion && (
          <p role="status" className="text-sm text-tinta-suave">
            No elegiste ninguna: usaremos el perfil Esencial.
          </p>
        )}
      </div>

      <ul className="grid gap-3 md:grid-cols-2">
        {modulos.map((m) => {
          const fija = m.id === SIEMPRE_ACTIVA;
          const activa = fija || tecnicas.includes(m.id);
          return (
            <li key={m.id}>
              <label
                className={`flex h-full min-h-11 cursor-pointer gap-4 rounded-md border p-4 has-[:checked]:border-marca has-[:checked]:bg-papel-hondo has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-marca ${
                  fija ? "cursor-default border-marca bg-papel-hondo" : "border-linea"
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-1 size-5 shrink-0 accent-marca"
                  checked={activa}
                  disabled={fija}
                  onChange={() => alternar(m.id)}
                />
                <span className="min-w-0">
                  <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="font-editorial text-3xl font-semibold leading-none text-marca" aria-hidden="true">
                      {m.numero}
                    </span>
                    <span className="font-medium">
                      <span className="sr-only">Técnica {m.numero}: </span>
                      {m.nombre}
                    </span>
                    <span className="rounded-full border border-linea px-2 py-0.5 text-xs text-tinta-suave">{FASES[m.fase]}</span>
                    {fija && <span className="rounded-full bg-marca px-2 py-0.5 text-xs text-marca-texto">Siempre activa</span>}
                  </span>
                  <span className="mt-2 block text-sm text-tinta-suave">{m.descripcionCorta}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <section aria-labelledby="orden-tecnicas">
        <h3 id="orden-tecnicas" className="mb-3 font-editorial text-lg font-semibold">
          Orden en que se aplican
        </h3>
        <ol className="flex flex-wrap gap-2" data-orden-tecnicas>
          {efectivas.map((id, i) => {
            const m = modulos.find((x) => x.id === id)!;
            return (
              <li key={id} className="flex items-center gap-2 rounded-full border border-linea px-3 py-1 text-sm">
                <span aria-hidden="true" className="grid size-6 place-items-center rounded-full bg-marca text-xs font-medium text-marca-texto">
                  {i + 1}
                </span>
                {m.nombre}
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
