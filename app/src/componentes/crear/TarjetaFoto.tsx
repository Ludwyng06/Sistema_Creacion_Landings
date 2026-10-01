"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ErrorApi, investigarProducto } from "./api";
import type { BorradorBrief } from "./borrador";
import { MAX_COLORES } from "./borrador";
import { BOTON_PEQUENO, BOTON_PRIMARIO, CLASE_CONTROL, ESTILO_SALUD } from "./estilos";
import { fotoReconocida, type RespuestaInvestigar } from "./investigar";

const MAX_BYTES = 15 * 1024 * 1024;
const TIPOS_FOTO = ["image/jpeg", "image/png", "image/webp", "image/avif"];
/** Milisegundos antes de pasar a la fase siguiente del aviso (reconocer, 3 búsquedas, armar). */
export const TIEMPOS_FASES = [0, 1800, 3600, 5400, 7200] as const;

interface Props {
  nombre: string;
  onNombre: (nombre: string) => void;
  categoria: BorradorBrief["categoria"];
  coloresActuales: string[];
  onColores: (colores: string[]) => void;
  /** Recibe la respuesta completa: el paso arma el borrador con ella. */
  onResultado: (respuesta: RespuestaInvestigar) => void;
  pendientes: number;
  onAceptarTodo: () => void;
}

function textoFase(fase: number, conFoto: boolean): string {
  if (fase === 0 && conFoto) return "Reconociendo el producto en la foto…";
  if (fase >= 1 && fase <= 3) return `Buscando en Google (${fase} de 3)…`;
  if (fase >= 4) return "Armando tu brief…";
  return "Buscando en Google (1 de 3)…";
}

/** «Empieza con una foto de tu producto»: foto + nombre → brief pre-llenado como borrador. */
export function TarjetaFoto({ nombre, onNombre, categoria, coloresActuales, onColores, onResultado, pendientes, onAceptarTodo }: Props) {
  const [foto, setFoto] = useState<File | null>(null);
  const [vista, setVista] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [errorFoto, setErrorFoto] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [fase, setFase] = useState(0);
  const [sinClave, setSinClave] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ reconocida: boolean; conFoto: boolean; colores: string[]; avisos: string[] } | null>(null);
  const selector = useRef<HTMLInputElement>(null);
  const control = useRef<AbortController | null>(null);

  useEffect(() => () => control.current?.abort(), []);

  // Libera la vista previa al cambiarla o al salir.
  useEffect(() => () => (vista ? URL.revokeObjectURL(vista) : undefined), [vista]);

  // Avisa las fases mientras se espera la respuesta.
  useEffect(() => {
    if (!cargando) return;
    const inicio = foto ? 0 : 1;
    const ids = TIEMPOS_FASES.map((t, i) => (i > inicio ? window.setTimeout(() => setFase(i), t) : 0));
    return () => ids.forEach((id) => window.clearTimeout(id));
  }, [cargando, foto]);

  function ponerFoto(archivo: File | null) {
    setFoto(archivo);
    setVista(archivo && typeof URL.createObjectURL === "function" ? URL.createObjectURL(archivo) : null);
  }

  function recibir(archivo: File | undefined) {
    if (!archivo) return;
    if (!TIPOS_FOTO.includes(archivo.type)) {
      setErrorFoto("Ese archivo no es una imagen admitida. Elige una foto en JPG, PNG, WebP o AVIF.");
      return;
    }
    if (archivo.size > MAX_BYTES) {
      setErrorFoto("La foto pesa más de 15 MB. Elige una más liviana.");
      return;
    }
    setErrorFoto(null);
    setResultado(null);
    ponerFoto(archivo);
  }

  async function llenar() {
    control.current?.abort();
    control.current = new AbortController();
    setFase(foto ? 0 : 1);
    setCargando(true);
    setError(null);
    setSinClave(false);
    setResultado(null);
    const conFoto = foto !== null;
    try {
      const r = await investigarProducto({ nombre: nombre.trim(), categoria: categoria || undefined, imagen: foto ?? undefined }, control.current.signal);
      const reconocida = !conFoto || fotoReconocida(r);
      const colores = reconocida ? (r.borrador?.coloresMarca?.valor ?? []).slice(0, MAX_COLORES) : [];
      setResultado({ reconocida, conFoto, colores, avisos: r.avisos ?? [] });
      onResultado(r);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      if (e instanceof ErrorApi && e.estado === 503) setSinClave(true);
      else setError(e instanceof Error ? e.message : "No pudimos llenar el brief.");
    } finally {
      setCargando(false);
    }
  }

  const listo = nombre.trim() !== "";
  const mensajeEstado = cargando
    ? textoFase(fase, foto !== null)
    : resultado
      ? resultado.reconocida
        ? pendientes > 0
          ? `Listo. Dejamos un borrador: revisa los ${pendientes} campos marcados como Sugerido.`
          : "Listo. Revisa el brief antes de seguir."
        : ""
      : "";

  return (
    <section className="rounded-md border border-linea bg-papel-hondo p-4 md:p-6" aria-labelledby="foto-titulo" data-tarjeta-foto>
      <h3 id="foto-titulo" className="font-editorial text-xl font-semibold">
        Empieza con una foto de tu producto
      </h3>
      <p className="mt-1 text-sm text-tinta-suave">
        Sube la foto y escribe el nombre: dejamos un borrador del brief con fuentes. Tú aceptas, editas o quitas cada campo.
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,16rem)_1fr]">
        <div>
          <div
            data-zona-foto
            onDragOver={(e) => {
              e.preventDefault();
              setArrastrando(true);
            }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={(e) => {
              e.preventDefault();
              setArrastrando(false);
              recibir(e.dataTransfer.files[0]);
            }}
            className={`flex aspect-square w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-md border-2 border-dashed p-3 text-center ${
              arrastrando ? "border-marca bg-papel" : "border-linea bg-papel"
            }`}
          >
            {vista ? (
              // eslint-disable-next-line @next/next/no-img-element -- vista previa local (blob:), no admite next/image
              <img src={vista} alt="Vista previa de la foto del producto" className="size-full object-contain" data-vista-foto />
            ) : (
              <p className="text-sm text-tinta-suave">Suelta la foto aquí o elígela desde tu equipo.</p>
            )}
          </div>
          <input
            ref={selector}
            id="foto-archivo"
            type="file"
            accept="image/*"
            className="sr-only"
            aria-label="Foto del producto"
            onChange={(e) => {
              recibir(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className={BOTON_PEQUENO} onClick={() => selector.current?.click()}>
              {foto ? "Cambiar foto" : "Elegir foto"}
            </button>
            {foto && (
              <button type="button" className={BOTON_PEQUENO} onClick={() => ponerFoto(null)}>
                Quitar foto
              </button>
            )}
          </div>
          {errorFoto && (
            <p role="alert" className="mt-2 text-sm text-error">
              {errorFoto}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <label htmlFor="foto-nombre" className="mb-1 block text-sm font-medium">
              ¿Cómo se llama tu producto?
            </label>
            <input id="foto-nombre" className={CLASE_CONTROL} value={nombre} onChange={(e) => onNombre(e.target.value)} placeholder="Por ejemplo: Corrector de postura inteligente" />
          </div>
          <div>
            <button type="button" className={BOTON_PRIMARIO} disabled={!listo || cargando} onClick={llenar}>
              {cargando ? "Trabajando…" : "Llenar el brief con lo que encuentre"}
            </button>
            {!listo && <p className="mt-2 text-sm text-tinta-suave">Escribe el nombre para empezar. La foto ayuda, pero es opcional.</p>}
          </div>

          <p role="status" aria-live="polite" className="text-sm text-tinta-suave" data-pasos-foto>
            {mensajeEstado}
          </p>

          {sinClave && (
            <p className={`rounded-md border p-3 text-sm ${ESTILO_SALUD.pendiente}`} data-sin-clave-foto>
              La investigación es opcional. Agrega <code className="font-mono">SERPAPI_API_KEY</code> en <code className="font-mono">app/.env.local</code> para usarla.{" "}
              <Link href="/ajustes" className="font-medium text-marca underline">
                Ir a Ajustes
              </Link>
              . Puedes llenar el brief a mano.
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-error">
              {error}
            </p>
          )}

          {resultado && resultado.avisos.length > 0 && (
            <ul className="list-disc pl-5 text-sm text-tinta-suave" data-avisos-investigacion>
              {resultado.avisos.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          )}

          {resultado && resultado.conFoto && !resultado.reconocida && (
            <p role="status" className={`rounded-md border p-3 text-sm ${ESTILO_SALUD.amarillo}`} data-foto-no-reconocida>
              No pudimos reconocer el producto en la foto. Seguimos solo con el nombre.
            </p>
          )}

          {pendientes > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className={BOTON_PEQUENO} onClick={onAceptarTodo}>
                Aceptar todo lo sugerido
              </button>
              <p className="text-sm text-tinta-suave" data-por-revisar>
                Faltan {pendientes} por revisar.
              </p>
            </div>
          )}

          {resultado && resultado.colores.length > 0 && (
            <div data-colores-foto>
              <p className="mb-2 text-sm font-medium">Colores que vimos en la foto</p>
              <ul className="flex flex-wrap gap-3">
                {resultado.colores.map((color) => {
                  const usado = coloresActuales.includes(color);
                  const lleno = coloresActuales.length >= MAX_COLORES;
                  return (
                    <li key={color} className="flex items-center gap-2 rounded-md border border-linea bg-papel p-2">
                      <span aria-hidden="true" className="size-8 rounded border border-linea" style={{ backgroundColor: color }} />
                      <code className="text-sm">{color}</code>
                      <button
                        type="button"
                        className={BOTON_PEQUENO}
                        disabled={usado || lleno}
                        aria-label={usado ? `Color ${color} ya agregado` : `Usar el color ${color} en tu marca`}
                        onClick={() => onColores([...coloresActuales, color])}
                      >
                        {usado ? "Agregado" : "Usar"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
