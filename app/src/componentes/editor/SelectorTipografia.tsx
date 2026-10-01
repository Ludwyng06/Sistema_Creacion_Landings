"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { BOTON_PEQUENO, CLASE_CONTROL } from "../crear/estilos";
import { CATALOGO, filtrarFuentes } from "../fuentes/catalogo";
import { NOMBRE_CATEGORIA, type CategoriaFuente } from "../fuentes/tipos";
import { cargarFuente } from "../fuentes/cargar-fuente";

export const FRASE_PRUEBA = "Ñandú, ¿qué tal?, ¡sí! Canción y él también.";

interface Props {
  rol: "titulos" | "cuerpo";
  /** Familia actual del token. */
  valor: string;
  /** Titular real de la landing, para ver cómo queda. */
  titular: string;
  onElegir: (familia: string) => void;
}

const CATEGORIAS: (CategoriaFuente | "todas")[] = ["todas", "sans-serif", "serif", "display", "handwriting", "monospace"];
/** Fila de la lista: pide su tipografía cuando entra en pantalla, para que cada opción se vea con su propia letra. */
function FilaLi({ familia, children }: { familia: string; children: ReactNode }) {
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observador = new IntersectionObserver((entradas) => {
      if (entradas.some((e) => e.isIntersecting)) {
        cargarFuente(familia);
        observador.disconnect();
      }
    });
    observador.observe(el);
    return () => observador.disconnect();
  }, [familia]);
  return <li ref={ref}>{children}</li>;
}

const estiloFamilia = (familia: string) => ({ fontFamily: `"${familia}", ui-sans-serif, system-ui, sans-serif` });

/**
 * Selector de una tipografía (Títulos o Cuerpo): búsqueda, filtros por categoría y vista previa en vivo con el titular real.
 * Cada familia se pide a Google Fonts solo cuando su fila entra en pantalla, al pasar por encima, al enfocar o al elegir.
 */
export function SelectorTipografia({ rol, valor, titular, onElegir }: Props) {
  const id = useId();
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState<CategoriaFuente | "todas">("todas");
  const [candidata, setCandidata] = useState<string | null>(null);
  const nombre = rol === "titulos" ? "Títulos" : "Cuerpo";

  const lista = useMemo(() => filtrarFuentes(CATALOGO, busqueda, categoria), [busqueda, categoria]);
  const mostrada = candidata ?? valor;

  const explorar = (familia: string) => {
    cargarFuente(familia);
    setCandidata(familia);
  };

  return (
    <div data-selector-tipografia={rol} className="rounded-md border border-linea p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">{nombre}</p>
          <p className="truncate text-lg" style={estiloFamilia(valor)} data-familia-actual={rol}>
            {valor}
          </p>
        </div>
        <button
          type="button"
          className={BOTON_PEQUENO}
          aria-expanded={abierto}
          aria-controls={`${id}-panel`}
          onClick={() => {
            setAbierto((a) => !a);
            cargarFuente(valor);
          }}
        >
          {abierto ? "Cerrar" : "Cambiar"}
          <span className="sr-only"> tipografía de {nombre.toLowerCase()}</span>
        </button>
      </div>

      {abierto && (
        <div id={`${id}-panel`} className="mt-3 flex flex-col gap-3">
          <div>
            <label htmlFor={`${id}-buscar`} className="mb-1 block text-sm font-medium">
              Buscar por nombre
            </label>
            <input id={`${id}-buscar`} type="search" className={CLASE_CONTROL} value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Por ejemplo: Lora" />
          </div>

          <div role="group" aria-label="Filtrar por categoría" className="flex flex-wrap gap-2">
            {CATEGORIAS.map((c) => (
              <button
                key={c}
                type="button"
                className={`${BOTON_PEQUENO} aria-pressed:border-marca aria-pressed:bg-marca aria-pressed:text-marca-texto`}
                aria-pressed={categoria === c}
                onClick={() => setCategoria(c)}
              >
                {c === "todas" ? "Todas" : NOMBRE_CATEGORIA[c]}
              </button>
            ))}
          </div>

          <div className="rounded-md bg-papel-hondo p-3" data-vista-tipografia aria-live="polite">
            <p className="text-xs text-tinta-suave">
              Vista previa · <span data-vista-familia>{mostrada}</span>
            </p>
            <p className="mt-1 break-words text-2xl leading-tight" style={estiloFamilia(mostrada)}>
              {titular}
            </p>
            <p className="mt-2 break-words text-base" style={estiloFamilia(mostrada)}>
              {FRASE_PRUEBA}
            </p>
          </div>

          <p className="text-sm text-tinta-suave" role="status">
            {lista.length === 0 ? "Ninguna tipografía coincide. Prueba con otro nombre o categoría." : `${lista.length} tipografías`}
          </p>
          <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto" aria-label={`Tipografías para ${nombre.toLowerCase()}`} onPointerLeave={() => setCandidata(null)}>
            {lista.map((x) => {
              const elegida = x.familia === valor;
              const noRecomendada = x.usoSugerido !== "ambos" && x.usoSugerido !== rol;
              return (
                <FilaLi key={x.familia} familia={x.familia}>
                  <button
                    type="button"
                    aria-pressed={elegida}
                    data-fuente={x.familia}
                    className="flex min-h-11 w-full items-center justify-between gap-2 rounded-md border border-linea px-3 py-1 text-left hover:bg-papel-hondo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca aria-pressed:border-marca aria-pressed:bg-papel-hondo"
                    onPointerEnter={() => explorar(x.familia)}
                    onFocus={() => explorar(x.familia)}
                    onBlur={() => setCandidata(null)}
                    onClick={() => {
                      cargarFuente(x.familia);
                      onElegir(x.familia);
                    }}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-lg" style={estiloFamilia(x.familia)}>
                        {x.familia}
                      </span>
                      <span className="block text-xs text-tinta-suave">
                        {NOMBRE_CATEGORIA[x.categoria]}
                        {noRecomendada && ` · mejor para ${x.usoSugerido === "titulos" ? "títulos" : "cuerpo"}`}
                      </span>
                    </span>
                    {elegida && <span aria-hidden="true">✓</span>}
                    {elegida && <span className="sr-only">Elegida</span>}
                  </button>
                </FilaLi>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
