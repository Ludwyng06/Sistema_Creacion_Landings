"use client";

import { CATALOGO_EFECTOS, EFECTOS_ID, MAX_EFECTOS_NIVEL_3, type EfectoId, type LandingDoc, type Seccion } from "@/lib/contratos";
import { EFECTOS_IMPLEMENTADOS } from "@/efectos/aplicables";
import { registro } from "@/secciones/registro";
import { CLASE_CONTROL } from "../crear/estilos";
import { contarNivel3, marcaDeTiempo, type AccionEditor } from "./estado-editor";

interface Props {
  doc: LandingDoc;
  seccion: Seccion | null;
  onAccion: (a: AccionEditor) => void;
}

const NIVELES: { valor: 1 | 2 | 3; nombre: string }[] = [
  { valor: 1, nombre: "Sobria" },
  { valor: 2, nombre: "Audaz" },
  { valor: 3, nombre: "De otro mundo" },
];

const nivelDe = (id: EfectoId): number => CATALOGO_EFECTOS[id].nivel;

/** Efectos del catálogo que admite esta sección (los `global` valen para cualquiera). */
export function efectosPermitidos(seccion: Seccion): EfectoId[] {
  return EFECTOS_ID.filter((id) => {
    const def = CATALOGO_EFECTOS[id];
    const secciones = def.secciones as readonly string[];
    if (!secciones.includes("global") && !secciones.includes(seccion.tipo)) return false;
    if (seccion.tipo === "heroe" && def.variantesHeroe && !(def.variantesHeroe as readonly string[]).includes(seccion.variante ?? "")) return false;
    return true;
  });
}

/** Un efecto de nivel 3 sin marcar no se puede activar si ya hay 3 en la landing. */
export function puedeActivarEfecto(doc: LandingDoc, seccion: Seccion, id: EfectoId): boolean {
  if ((seccion.efectos ?? []).includes(id)) return true;
  if (nivelDe(id) === 3 && contarNivel3(doc, nivelDe) >= MAX_EFECTOS_NIVEL_3) return false;
  return true;
}

export function PanelEfectos({ doc, seccion, onAccion }: Props) {
  const usados = contarNivel3(doc, nivelDe);
  const intensidad = doc.tokens.intensidad;
  const etiqueta = seccion ? (registro[seccion.tipo]?.etiqueta ?? seccion.tipo) : "";

  return (
    <section aria-labelledby="titulo-efectos" className="flex flex-col gap-4" data-panel-efectos>
      <h2 id="titulo-efectos" className="font-editorial text-lg font-semibold">
        Efectos
      </h2>

      <div>
        <label htmlFor="efectos-intensidad" className="mb-1 block text-sm font-medium">
          Intensidad de la landing
        </label>
        <select id="efectos-intensidad" className={CLASE_CONTROL} value={intensidad} onChange={(e) => onAccion({ tipo: "editar-tokens", tokens: { ...doc.tokens, intensidad: Number(e.target.value) as 1 | 2 | 3 }, clave: "intensidad", t: marcaDeTiempo() })}>
          {NIVELES.map((n) => (
            <option key={n.valor} value={n.valor}>
              {n.valor} · {n.nombre}
            </option>
          ))}
        </select>
      </div>

      <p role="status" aria-live="polite" className="text-sm" data-contador-nivel3>
        Efectos fuertes (nivel 3): <strong>{usados} de {MAX_EFECTOS_NIVEL_3}</strong>
      </p>

      {seccion ? (
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-sm font-medium">Efectos de «{etiqueta}»</legend>
          {efectosPermitidos(seccion).map((id) => {
            const activo = (seccion.efectos ?? []).includes(id);
            const def = CATALOGO_EFECTOS[id];
            const sobreIntensidad = def.nivel > intensidad;
            const lleno = !puedeActivarEfecto(doc, seccion, id);
            const inerte = !EFECTOS_IMPLEMENTADOS.includes(id);
            const motivo = lleno ? `Ya hay ${MAX_EFECTOS_NIVEL_3} efectos de nivel 3.` : sobreIntensidad ? `Pide intensidad ${def.nivel} o más.` : inerte ? "Se anima desde el día 5." : "";
            return (
              <label key={id} className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-md px-2 py-1 hover:bg-papel-hondo has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-marca ${lleno ? "cursor-not-allowed opacity-50" : ""}`}>
                <input
                  type="checkbox"
                  className="mt-1 size-4 accent-marca"
                  checked={activo}
                  disabled={lleno}
                  onChange={() => !lleno && onAccion({ tipo: "editar-efectos", id: seccion.id, efectos: activo ? (seccion.efectos ?? []).filter((e) => e !== id) : [...(seccion.efectos ?? []), id] })}
                />
                <span className="min-w-0 text-sm">
                  <span className="font-medium">{id}</span> <span className="text-tinta-suave">· nivel {def.nivel}</span>
                  {motivo && <span className="block text-xs text-tinta-suave">{motivo}</span>}
                </span>
              </label>
            );
          })}
        </fieldset>
      ) : (
        <p className="text-sm text-tinta-suave">Elige una sección para ver sus efectos.</p>
      )}
    </section>
  );
}
