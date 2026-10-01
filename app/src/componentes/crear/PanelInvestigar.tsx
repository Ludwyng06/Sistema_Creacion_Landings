"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ErrorApi, investigarProducto } from "./api";
import { MAX_BENEFICIOS, MIN_BENEFICIOS, type BorradorBrief } from "./borrador";
import { BOTON_PEQUENO, BOTON_SECUNDARIO, CLASE_CONTROL, ESTILO_SALUD } from "./estilos";
import { textoParaBrief, tieneNumero, usoDelMes, type GrupoSugerencia, type RespuestaInvestigar, type Sugerencia } from "./investigar";

interface Props {
  brief: BorradorBrief;
  onCambio: (cambios: Partial<BorradorBrief>) => void;
}

type Tarjeta = Sugerencia & { id: string; grupo: GrupoSugerencia; agregada: boolean; editando: boolean; borrador: string };

const GRUPOS: { grupo: GrupoSugerencia; titulo: string; ayuda: string }[] = [
  { grupo: "beneficios", titulo: "Beneficios", ayuda: "Lo que otras personas dicen que ganan con este tipo de producto." },
  { grupo: "objeciones", titulo: "Objeciones", ayuda: "Dudas que frenan la compra." },
  { grupo: "preguntas", titulo: "Preguntas frecuentes", ayuda: "Van a tus objeciones, escritas como pregunta." },
];

function aTarjetas(r: RespuestaInvestigar): Tarjeta[] {
  return GRUPOS.flatMap(({ grupo }) =>
    (r.sugerencias?.[grupo] ?? []).map((s, i) => ({
      ...s,
      tieneCifra: s.tieneCifra || tieneNumero(s.texto),
      id: `${grupo}-${i}`,
      grupo,
      agregada: false,
      editando: false,
      borrador: s.texto,
    })),
  );
}

/** «Investigar el producto»: sugerencias con fuente que la persona agrega, edita o descarta una por una. */
export function PanelInvestigar({ brief, onCambio }: Props) {
  const [cargando, setCargando] = useState(false);
  const [tarjetas, setTarjetas] = useState<Tarjeta[] | null>(null);
  const [consultas, setConsultas] = useState<string[]>([]);
  const [uso, setUso] = useState<{ usadas: number; limite: number } | null>(null);
  const [sinClave, setSinClave] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<Record<string, string>>({});
  const [anuncio, setAnuncio] = useState("");
  const control = useRef<AbortController | null>(null);

  const nombre = brief.nombre.trim();
  const listo = nombre !== "" && brief.categoria !== "";
  const consultasEnCurso = [`${nombre} beneficios`, `${nombre} problemas y opiniones`, `${nombre} preguntas frecuentes`];

  async function investigar() {
    control.current?.abort();
    control.current = new AbortController();
    setCargando(true);
    setError(null);
    setSinClave(false);
    setAviso({});
    setAnuncio(`Buscando: ${consultasEnCurso.join(", ")}.`);
    try {
      const r = await investigarProducto({ nombre, categoria: brief.categoria }, control.current.signal);
      setTarjetas(aTarjetas(r));
      setConsultas(r.consultas ?? []);
      setUso(usoDelMes(r.cuota));
      setAnuncio("Terminó la búsqueda. Revisa las sugerencias.");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setTarjetas(null);
      if (e instanceof ErrorApi && e.estado === 503) setSinClave(true);
      else setError(e instanceof Error ? e.message : "No pudimos investigar el producto.");
      setAnuncio("");
    } finally {
      setCargando(false);
    }
  }

  const cambiar = (id: string, cambios: Partial<Tarjeta>) => setTarjetas((ts) => ts?.map((t) => (t.id === id ? { ...t, ...cambios } : t)) ?? null);
  const descartar = (id: string) => {
    setTarjetas((ts) => ts?.filter((t) => t.id !== id) ?? null);
    setAnuncio("Sugerencia descartada.");
  };

  function agregar(t: Tarjeta) {
    const texto = textoParaBrief(t.borrador, t.tieneCifra);
    if (t.grupo === "beneficios") {
      const llenos = brief.beneficios.filter((b) => b.trim() !== "");
      if (llenos.length >= MAX_BENEFICIOS) {
        setAviso((a) => ({ ...a, [t.id]: `Ya tienes ${MAX_BENEFICIOS} beneficios. Quita uno de la lista de Beneficios para agregar este.` }));
        return;
      }
      const nuevos = [...llenos, texto];
      while (nuevos.length < MIN_BENEFICIOS) nuevos.push("");
      onCambio({ beneficios: nuevos });
    } else {
      const actuales = brief.objeciones.filter((o) => o.trim() !== "");
      onCambio({ objeciones: actuales.includes(texto) ? actuales : [...actuales, texto] });
    }
    setAviso((a) => ({ ...a, [t.id]: "" }));
    cambiar(t.id, { agregada: true, editando: false });
    setAnuncio(t.tieneCifra ? "Agregada al brief. El número quedó como [COMPLETAR]." : "Agregada al brief.");
  }

  return (
    <div className="rounded-md border border-linea p-4" data-panel-investigar>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={BOTON_SECUNDARIO} disabled={!listo || cargando} onClick={investigar} aria-describedby="investigar-ayuda">
          {cargando ? "Buscando…" : "Investigar el producto"}
        </button>
        <p id="investigar-ayuda" className="min-w-0 flex-1 basis-56 text-sm text-tinta-suave">
          {listo ? "Buscamos qué dicen otras personas. Tú decides qué entra al brief." : "Escribe el nombre y elige la categoría para buscar."}
        </p>
      </div>

      <p role="status" aria-live="polite" className="mt-3 text-sm text-tinta-suave">
        {anuncio}
      </p>
      {cargando && (
        <ul className="mt-1 list-disc pl-5 text-sm text-tinta-suave" data-consultas-en-curso>
          {consultasEnCurso.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      )}

      {sinClave && (
        <p className={`mt-3 rounded-md border p-3 text-sm ${ESTILO_SALUD.pendiente}`} data-sin-clave>
          La investigación es opcional. Agrega <code className="font-mono">SERPAPI_API_KEY</code> en <code className="font-mono">app/.env.local</code> para usarla.{" "}
          <Link href="/ajustes" className="font-medium text-marca underline">
            Ir a Ajustes
          </Link>
          . El resto del paso sigue igual.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-error">
          {error}
        </p>
      )}

      {tarjetas && (
        <div className="mt-4 flex flex-col gap-6" data-resultados-investigacion>
          {uso && (
            <p className="text-sm text-tinta-suave" data-uso-mes>
              {uso.usadas} de {uso.limite} búsquedas este mes
              {consultas.length > 0 && <> · Consultas: {consultas.join("; ")}</>}
            </p>
          )}
          {GRUPOS.map(({ grupo, titulo, ayuda }) => {
            const lista = tarjetas.filter((t) => t.grupo === grupo);
            return (
              <section key={grupo} aria-labelledby={`inv-${grupo}`}>
                <h3 id={`inv-${grupo}`} className="font-editorial text-lg font-semibold">
                  {titulo}
                </h3>
                <p className="mb-2 text-sm text-tinta-suave">{ayuda}</p>
                {lista.length === 0 ? (
                  <p className="text-sm text-tinta-suave">Sin sugerencias en este grupo.</p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {lista.map((t) => (
                      <li key={t.id} data-sugerencia={t.id} className="rounded-md border border-linea bg-papel p-3">
                        {t.editando ? (
                          <div>
                            <label htmlFor={`inv-edit-${t.id}`} className="mb-1 block text-sm font-medium">
                              Editar sugerencia
                            </label>
                            <textarea id={`inv-edit-${t.id}`} rows={3} className={CLASE_CONTROL} value={t.borrador} onChange={(e) => cambiar(t.id, { borrador: e.target.value })} />
                          </div>
                        ) : (
                          <p className="text-base">{t.borrador}</p>
                        )}
                        <p className="mt-2 text-sm text-tinta-suave">
                          Fuente:{" "}
                          {t.fuentes.length === 0 && "sin enlace"}
                          {t.fuentes.map((f, i) => (
                            <span key={f.url}>
                              {i > 0 && ", "}
                              <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-marca underline">
                                {f.sitio}
                              </a>
                            </span>
                          ))}
                        </p>
                        {t.tieneCifra && (
                          <p className={`mt-2 rounded-md border px-3 py-2 text-sm ${ESTILO_SALUD.amarillo}`} data-marca-cifra>
                            Tiene una cifra: verifícala con tu proveedor. Al agregarla, el número entra como [COMPLETAR].
                          </p>
                        )}
                        {aviso[t.id] && (
                          <p role="alert" className="mt-2 text-sm text-error">
                            {aviso[t.id]}
                          </p>
                        )}
                        {t.agregada ? (
                          <p className="mt-3 text-sm font-medium text-contexto">Agregada al brief</p>
                        ) : (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button type="button" className={BOTON_PEQUENO} onClick={() => agregar(t)}>
                              Agregar al brief
                            </button>
                            {t.editando ? (
                              <button type="button" className={BOTON_PEQUENO} onClick={() => cambiar(t.id, { editando: false })}>
                                Listo
                              </button>
                            ) : (
                              <button type="button" className={BOTON_PEQUENO} onClick={() => cambiar(t.id, { editando: true })}>
                                Editar
                              </button>
                            )}
                            <button type="button" className={BOTON_PEQUENO} onClick={() => descartar(t.id)}>
                              Descartar
                            </button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
