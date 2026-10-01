"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ResumenVersion } from "@/lib/landings";
import { BOTON_PRIMARIO, BOTON_SECUNDARIO, CLASE_CONTROL } from "../crear/estilos";

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  cargar: () => Promise<ResumenVersion[]>;
  guardar: (nota: string) => Promise<void>;
  restaurar: (versionId: string) => Promise<void>;
}

const formatoFecha = (iso: string) =>
  new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

/** Cajón de versiones: lista, «Guardar versión» con nota y «Restaurar» con confirmación. */
export function Versiones({ abierto, onCerrar, cargar, guardar, restaurar }: Props) {
  const [versiones, setVersiones] = useState<ResumenVersion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nota, setNota] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const cerrar = useRef<HTMLButtonElement>(null);

  const recargar = useCallback(async () => {
    try {
      setVersiones(await cargar());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos cargar las versiones.");
    }
  }, [cargar]);

  useEffect(() => {
    if (!abierto) return;
    let vigente = true;
    cargar()
      .then((lista) => vigente && (setVersiones(lista), setError(null)))
      .catch((e: unknown) => vigente && setError(e instanceof Error ? e.message : "No pudimos cargar las versiones."));
    cerrar.current?.focus();
    const alTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", alTecla);
    return () => {
      vigente = false;
      window.removeEventListener("keydown", alTecla);
    };
  }, [abierto, onCerrar, cargar]);

  if (!abierto) return null;

  async function ejecutar(accion: () => Promise<void>) {
    setOcupado(true);
    setError(null);
    try {
      await accion();
      await recargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos completar la acción.");
    } finally {
      setOcupado(false);
      setConfirmando(null);
    }
  }

  return (
    <aside role="dialog" aria-label="Versiones" className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col gap-4 overflow-y-auto border-l border-linea bg-papel p-4 shadow-xl" data-cajon-versiones>
      <div className="flex items-center justify-between">
        <h2 className="font-editorial text-xl font-semibold">Versiones</h2>
        <button ref={cerrar} type="button" className={BOTON_SECUNDARIO} onClick={onCerrar}>
          Cerrar
        </button>
      </div>

      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void ejecutar(async () => {
            await guardar(nota.trim());
            setNota("");
          });
        }}
      >
        <label htmlFor="nota-version" className="text-sm font-medium">
          Nota de la versión <span className="font-normal text-tinta-suave">(opcional)</span>
        </label>
        <input id="nota-version" className={CLASE_CONTROL} maxLength={200} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Por ejemplo: antes de cambiar el héroe" />
        <button type="submit" className={`${BOTON_PRIMARIO} self-start`} disabled={ocupado}>
          Guardar versión
        </button>
      </form>

      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}

      {versiones === null ? (
        <p role="status" className="text-sm text-tinta-suave">
          Cargando versiones…
        </p>
      ) : versiones.length === 0 ? (
        <p className="text-sm text-tinta-suave">Todavía no hay versiones guardadas.</p>
      ) : (
        <ul className="flex flex-col gap-2" data-lista-versiones>
          {versiones.map((v) => (
            <li key={v.id} className="rounded-md border border-linea p-3" data-version={v.id}>
              <p className="text-sm font-medium">{v.nota ?? "Sin nota"}</p>
              <p className="text-xs text-tinta-suave">{formatoFecha(v.creadoEn)}</p>
              {confirmando === v.id ? (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm" role="group" aria-label="Confirmar restaurar">
                  <span>Vas a reemplazar lo que ves ahora. ¿Restaurar?</span>
                  <button type="button" className={BOTON_PRIMARIO} disabled={ocupado} onClick={() => void ejecutar(() => restaurar(v.id))}>
                    Sí, restaurar
                  </button>
                  <button type="button" className={BOTON_SECUNDARIO} onClick={() => setConfirmando(null)}>
                    No
                  </button>
                </div>
              ) : (
                <button type="button" className={`${BOTON_SECUNDARIO} mt-2`} disabled={ocupado} onClick={() => setConfirmando(v.id)}>
                  Restaurar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
