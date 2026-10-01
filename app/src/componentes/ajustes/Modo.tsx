"use client";

import { useEffect, useState } from "react";
import { BOTON_PEQUENO, BOTON_PRIMARIO, TITULO_SECCION } from "@/componentes/crear/estilos";
import type { ModoIA } from "@/lib/contratos";
import { guardarModo, leerModo, type ModoCascada } from "./api";
import { MODOS, NOMBRE_PROVEEDOR, PROVEEDORES_EDITABLES } from "./textos";

type Id = (typeof PROVEEDORES_EDITABLES)[number];

export function Modo() {
  const [modo, setModo] = useState<ModoIA>("cascada");
  const [orden, setOrden] = useState<Id[]>([...PROVEEDORES_EDITABLES]);
  const [activos, setActivos] = useState<Set<Id>>(new Set(PROVEEDORES_EDITABLES));
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    leerModo()
      .then((m) => {
        setModo(m.modo);
        // La cascada guardada va primero y en su orden; los demás proveedores quedan al final, sin marcar.
        setOrden([...m.cascada, ...PROVEEDORES_EDITABLES.filter((p) => !m.cascada.includes(p))]);
        setActivos(new Set(m.cascada));
      })
      .catch((e) => setMensaje({ tipo: "error", texto: e instanceof Error ? e.message : "No se pudo leer el modo." }));
  }, []);

  function mover(i: number, delta: -1 | 1) {
    const j = i + delta;
    if (j < 0 || j >= orden.length) return;
    const copia = [...orden];
    [copia[i], copia[j]] = [copia[j], copia[i]];
    setOrden(copia);
  }

  async function guardar() {
    setGuardando(true);
    setMensaje(null);
    try {
      const cascada = orden.filter((p) => activos.has(p));
      const r: ModoCascada = await guardarModo({ modo, cascada });
      setMensaje({ tipo: "ok", texto: `Guardado: modo ${r.modo} con ${r.cascada.map((p) => NOMBRE_PROVEEDOR[p]).join(", ")}.` });
    } catch (e) {
      setMensaje({ tipo: "error", texto: e instanceof Error ? e.message : "No se pudo guardar." });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section aria-labelledby="titulo-modo" className="flex flex-col gap-5">
      <div>
        <h2 id="titulo-modo" className={TITULO_SECCION}>
          Modo de trabajo
        </h2>
        <p className="text-tinta-suave">
          Lo que guardes aquí manda sobre lo que diga el archivo <code>.env.local</code>.
        </p>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="sr-only">Modo de la IA</legend>
        {MODOS.map((m) => (
          <label key={m.id} className={`flex cursor-pointer gap-3 rounded-md border p-4 ${modo === m.id ? "border-marca bg-papel-hondo" : "border-linea"}`}>
            <input type="radio" name="modo" value={m.id} checked={modo === m.id} onChange={() => setModo(m.id)} className="mt-1 size-5 accent-marca" />
            <span>
              <span className="block font-medium">{m.nombre}</span>
              <span className="block text-sm text-tinta-suave">{m.explicacion}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="flex flex-col gap-2">
        <h3 className="font-editorial text-xl font-semibold">Orden de la cascada</h3>
        <p className="text-sm text-tinta-suave">Se prueba de arriba abajo. Desmarca un proveedor para dejarlo fuera.</p>
        <ol className="flex flex-col gap-2" data-testid="orden-cascada">
          {orden.map((id, i) => (
            <li key={id} className="flex items-center gap-3 rounded-md border border-linea p-2 pl-3">
              <span aria-hidden="true" className="w-5 text-center font-editorial text-lg font-semibold">
                {i + 1}
              </span>
              <label className="flex flex-1 cursor-pointer items-center gap-2 py-2">
                <input
                  type="checkbox"
                  checked={activos.has(id)}
                  onChange={() =>
                    setActivos((a) => {
                      const n = new Set(a);
                      if (n.has(id)) n.delete(id);
                      else n.add(id);
                      return n;
                    })
                  }
                  className="size-5 accent-marca"
                />
                {NOMBRE_PROVEEDOR[id]}
              </label>
              <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} aria-label={`Subir ${NOMBRE_PROVEEDOR[id]}`} className={BOTON_PEQUENO}>
                ↑
              </button>
              <button type="button" onClick={() => mover(i, 1)} disabled={i === orden.length - 1} aria-label={`Bajar ${NOMBRE_PROVEEDOR[id]}`} className={BOTON_PEQUENO}>
                ↓
              </button>
            </li>
          ))}
        </ol>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button type="button" onClick={guardar} disabled={guardando || activos.size === 0} className={BOTON_PRIMARIO}>
          {guardando ? "Guardando…" : "Guardar modo"}
        </button>
        {activos.size === 0 && <span className="text-sm text-error">Deja al menos un proveedor en la cascada.</span>}
        {mensaje && (
          <p role={mensaje.tipo === "error" ? "alert" : "status"} className={`text-sm ${mensaje.tipo === "error" ? "text-error" : "text-contexto"}`}>
            {mensaje.texto}
          </p>
        )}
      </div>
    </section>
  );
}
