"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icono } from "@/componentes/Icono";
import { BOTON_PRIMARIO, BOTON_SECUNDARIO, CLASE_CONTROL } from "./estilos";
import {
  EJEMPLOS_ENCARGO,
  ESTILOS,
  ETAPAS,
  NOMBRE_ESTILO,
  NOMBRE_ETAPA,
  NOMBRE_TIPO,
  PALETAS,
  TIPOS_LANDING,
  esEnlaceWeb,
  type Encargo,
  type Etapa,
  type EstiloEncargo,
  type EventoGenerar,
  type Faltante,
  type PaletaEncargo,
  type TipoLanding,
} from "./encargo";
import { generarLanding } from "./generar";
import { aplicarEtapa } from "./progreso-etapas";
import { AvisoGeneracion } from "@/componentes/entrega/AvisoGeneracion";
import type { LandingDoc } from "@/lib/contratos";
import { SIN_SENAL, hayAvisoGeneracion, marcadoresSinFoto, senalDeListo, type SenalGeneracion } from "@/lib/entrega/generacion";

const CHIP =
  "inline-flex min-h-11 items-center gap-2 rounded-full border border-linea px-4 text-sm aria-pressed:border-marca aria-pressed:bg-marca aria-pressed:text-marca-texto hover:bg-papel-hondo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca";

const AVANZADOS: { clave: string; etiqueta: string; tipo?: string }[] = [
  { clave: "marca", etiqueta: "Nombre de marca" },
  { clave: "precio", etiqueta: "Precio" },
  { clave: "whatsapp", etiqueta: "WhatsApp", tipo: "tel" },
  { clave: "ciudad", etiqueta: "Ciudad o cobertura" },
  { clave: "fecha", etiqueta: "Fecha" },
  { clave: "lugar", etiqueta: "Lugar" },
];

/** Slots de imagen sin archivo de una landing guardada; 0 si no se pudo leer. */
async function contarMarcadores(id: string): Promise<number> {
  try {
    const r = await fetch(`/api/landings/${id}`);
    if (!r.ok) return 0;
    return marcadoresSinFoto(((await r.json()) as { doc: LandingDoc }).doc);
  } catch {
    return 0;
  }
}

const MAX_FOTOS = 3;
const MAX_BYTES = 4 * 1024 * 1024;

function leerComoDataUrl(archivo: File): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = () => resolver(String(lector.result));
    lector.onerror = () => rechazar(new Error("No pudimos leer la foto."));
    lector.readAsDataURL(archivo);
  });
}

interface Progreso {
  /** Etapas en marcha ahora: varias a la vez cuando el generador trabaja en paralelo. */
  activas: Etapa[];
  hechas: Etapa[];
  mensaje: string;
  n?: number;
  total?: number;
  faltantes: Faltante[];
  detectado?: string;
  error: string | null;
  listo: { id: string } | null;
  /** Generación a medias (sin cuota): el crítico o secciones quedaron pendientes. */
  senal: SenalGeneracion;
}

const PROGRESO_VACIO: Progreso = { activas: [], hechas: [], mensaje: "Preparando…", faltantes: [], error: null, listo: null, senal: SIN_SENAL };

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={titulo} className="flex flex-col gap-2">
      <span className="text-sm font-medium">{titulo}</span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

/**
 * `/crear` (§5.1 del v2): un solo campo, chips Tipo, Estilo y Paleta en «Auto», fotos o link opcionales y ajustes avanzados
 * plegados. Al crear narra el avance con los eventos de `POST /api/generar`, pide los faltantes como chips y abre el visor.
 */
export function CrearRapido() {
  const router = useRouter();
  const [descripcion, setDescripcion] = useState("");
  const [tipo, setTipo] = useState<TipoLanding | undefined>();
  const [estilo, setEstilo] = useState<EstiloEncargo | undefined>();
  const [paleta, setPaleta] = useState<PaletaEncargo | undefined>();
  const [masAbierto, setMasAbierto] = useState(false);
  const [fotos, setFotos] = useState<string[]>([]);
  const [errorFoto, setErrorFoto] = useState<string | null>(null);
  const [link, setLink] = useState("");
  const [avanzados, setAvanzados] = useState<Record<string, string>>({});
  const [intentado, setIntentado] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [progreso, setProgreso] = useState<Progreso>(PROGRESO_VACIO);
  const [respuestas, setRespuestas] = useState<Record<string, string>>({});
  const respuestasRef = useRef(respuestas);
  const control = useRef<AbortController | null>(null);
  const titulo = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    respuestasRef.current = respuestas;
  });
  useEffect(() => () => control.current?.abort(), []);

  const enlaceInvalido = link.trim() !== "" && !esEnlaceWeb(link);
  const falta = descripcion.trim().length < 8;

  function armarEncargo(extra: Record<string, string> = {}): Encargo {
    return { descripcion, tipo, estilo, paleta, fotos, link, datos: { ...avanzados, ...extra } };
  }

  const alEvento = useCallback(
    (e: EventoGenerar) => {
      setProgreso((p) => {
        if (e.tipo === "etapa") {
          return aplicarEtapa(p, e, ETAPAS);
        }
        if (e.tipo === "faltantes") return { ...p, faltantes: e.faltantes, detectado: e.detectado?.tipo ?? p.detectado };
        if (e.tipo === "error") return { ...p, error: e.mensaje };
        const senal = senalDeListo(e);
        return { ...p, hechas: [...ETAPAS], activas: [], mensaje: hayAvisoGeneracion(senal) ? "Tu landing quedó guardada." : "Listo. Abriendo tu landing…", listo: { id: e.id }, senal };
      });
      // Con el crítico o secciones pendientes se queda aquí para contarlo; si no, abre el visor.
      if (e.tipo === "listo" && !hayAvisoGeneracion(senalDeListo(e))) router.push(`/ver/${e.id}`);
    },
    [router],
  );

  async function crear() {
    setIntentado(true);
    if (falta || enlaceInvalido) return;
    control.current?.abort();
    control.current = new AbortController();
    const senal = control.current.signal;
    setGenerando(true);
    setProgreso(PROGRESO_VACIO);
    setRespuestas({});
    let faltantesVistos: Faltante[] = [];
    let listo: string | null = null;
    let ultimoListo: EventoGenerar | null = null;
    await generarLanding(armarEncargo(), (e) => {
      if (e.tipo === "faltantes") faltantesVistos = e.faltantes;
      // Se guarda el «listo» para decidir después si hay que rehacer con los datos que llenó la persona.
      if (e.tipo === "listo") {
        listo = e.id;
        ultimoListo = e;
        return;
      }
      alEvento(e);
    }, { senal });
    if (senal.aborted || !listo) return;
    // Si la persona llenó algún faltante mientras se generaba, se vuelve a generar una vez con esos datos.
    const llenados = Object.fromEntries(faltantesVistos.map((f) => [f.clave, respuestasRef.current[f.clave]?.trim() ?? ""]).filter(([, v]) => v !== ""));
    if (Object.keys(llenados).length > 0) {
      setProgreso((p) => ({ ...p, faltantes: [], hechas: [], activas: ["intake"], mensaje: "Aplicando tus datos…" }));
      await generarLanding(armarEncargo(llenados), alEvento, { senal });
      return;
    }
    // Las fotos que no llegaron se ven en la landing guardada: si faltan, se avisa y se ofrece «Buscar fotos».
    const fotosPendientes = await contarMarcadores(listo);
    alEvento({ ...(ultimoListo ?? { tipo: "listo", id: listo }), fotosPendientes } as EventoGenerar);
  }

  function cancelar() {
    control.current?.abort();
    setGenerando(false);
    setProgreso(PROGRESO_VACIO);
  }

  async function alElegirFotos(archivos: FileList | null) {
    setErrorFoto(null);
    const validas = [...(archivos ?? [])].filter((a) => a.type.startsWith("image/"));
    if (validas.length < (archivos?.length ?? 0)) setErrorFoto("Solo se pueden agregar imágenes.");
    const cabe = validas.filter((a) => a.size <= MAX_BYTES);
    if (cabe.length < validas.length) setErrorFoto("Cada foto puede pesar hasta 4 MB.");
    try {
      const nuevas = await Promise.all(cabe.slice(0, MAX_FOTOS - fotos.length).map(leerComoDataUrl));
      setFotos((f) => [...f, ...nuevas].slice(0, MAX_FOTOS));
    } catch (e) {
      setErrorFoto(e instanceof Error ? e.message : "No pudimos leer la foto.");
    }
  }

  if (generando) {
    const pct = progreso.total ? Math.round(((progreso.n ?? 0) / progreso.total) * 100) : 0;
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6" data-progreso>
        <h1 ref={titulo} className="font-editorial text-3xl font-semibold tracking-tight">
          Creando tu landing
        </h1>
        <p className="rounded-md border border-linea bg-papel-hondo p-3 text-tinta-suave">{descripcion.trim()}</p>
        <ol className="flex flex-col gap-2" aria-label="Etapas">
          {ETAPAS.map((etapa) => {
            const hecha = progreso.hechas.includes(etapa);
            const activa = progreso.activas.includes(etapa);
            return (
              <li key={etapa} data-etapa={etapa} data-estado={hecha ? "hecha" : activa ? "activa" : "pendiente"} className={`flex items-center gap-3 rounded-md border p-3 ${activa ? "border-marca" : "border-linea"} ${hecha || activa ? "" : "opacity-60"}`}>
                <span aria-hidden="true" className={`grid size-7 shrink-0 place-items-center rounded-full border ${hecha ? "border-marca bg-marca text-marca-texto" : "border-linea"}`}>
                  {hecha ? <Icono nombre="check" className="size-4" /> : activa ? <span className="size-4 rounded-full border-2 border-marca border-t-transparent motion-safe:animate-spin motion-reduce:border-t-marca" /> : null}
                </span>
                <span>{NOMBRE_ETAPA[etapa]}</span>
              </li>
            );
          })}
        </ol>
        <p role="status" aria-live="polite" data-mensaje className="font-medium">
          {progreso.mensaje}
        </p>
        {progreso.total ? (
          <div role="progressbar" aria-label="Secciones escritas" aria-valuemin={0} aria-valuemax={progreso.total} aria-valuenow={progreso.n ?? 0} className="h-2 overflow-hidden rounded-full bg-linea">
            <div className="h-full bg-marca transition-[width] motion-reduce:transition-none" style={{ width: `${pct}%` }} />
          </div>
        ) : null}

        {progreso.faltantes.length > 0 && !progreso.listo && (
          <section aria-labelledby="titulo-faltantes" data-faltantes className="flex flex-col gap-3 rounded-md border border-linea p-4">
            <h2 id="titulo-faltantes" className="font-editorial text-lg font-semibold">
              Para que quede completa
            </h2>
            <p className="text-sm text-tinta-suave">Puedes llenarlos ahora o ignorarlos: lo que falte queda como [COMPLETAR] y lo editas después.</p>
            <ul className="flex flex-wrap gap-3">
              {progreso.faltantes.map((f) => (
                <li key={f.clave}>
                  <label className="flex flex-wrap items-center gap-2 rounded-full border border-linea px-3 py-1 text-sm focus-within:border-marca">
                    <span>{f.pregunta}</span>
                    <input
                      data-faltante={f.clave}
                      className="min-h-9 w-40 rounded-md border border-linea bg-papel px-2 text-tinta placeholder:text-tinta-suave focus-visible:outline-2 focus-visible:outline-marca"
                      placeholder="[__]"
                      value={respuestas[f.clave] ?? ""}
                      onChange={(e) => setRespuestas((r) => ({ ...r, [f.clave]: e.target.value }))}
                    />
                  </label>
                </li>
              ))}
            </ul>
          </section>
        )}

        {progreso.listo && hayAvisoGeneracion(progreso.senal) && (
          <AvisoGeneracion landingId={progreso.listo.id} senal={progreso.senal} alReintentar={() => router.push(`/ver/${progreso.listo!.id}`)}>
            <Link href={`/ver/${progreso.listo.id}`} className={BOTON_SECUNDARIO} data-abrir-landing>
              Ver la landing
            </Link>
          </AvisoGeneracion>
        )}

        {progreso.error && (
          <div role="alert"className="flex flex-col gap-3 rounded-md border border-error p-4 text-error">
            <p>{progreso.error}</p>
            <button type="button" className={`${BOTON_SECUNDARIO} self-start`} onClick={cancelar}>
              Volver y reintentar
            </button>
          </div>
        )}
        {!progreso.error && !progreso.listo && (
          <button type="button" className={`${BOTON_SECUNDARIO} self-start`} onClick={cancelar}>
            Cancelar
          </button>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="font-editorial text-4xl font-semibold tracking-tight">Crea tu landing</h1>
        <p className="text-tinta-suave">Cuéntalo con tus palabras. El sistema deduce el tipo, busca datos e imágenes y arma la página.</p>
      </header>

      <form
        className="flex flex-col gap-6"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void crear();
        }}
      >
        <div className="flex flex-col gap-2">
          <label htmlFor="descripcion" className="font-editorial text-2xl font-semibold">
            ¿Qué landing quieres?
          </label>
          <textarea
            id="descripcion"
            rows={4}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            aria-invalid={intentado && falta ? true : undefined}
            aria-describedby={intentado && falta ? "error-descripcion" : undefined}
            placeholder="Ej.: Landing para una noche de observación de la lluvia de meteoros en Villa de Leyva"
            className={`${CLASE_CONTROL} text-lg`}
          />
          {intentado && falta && (
            <p id="error-descripcion" role="alert" className="text-sm text-error">
              Cuéntame un poco más: escribe al menos una frase.
            </p>
          )}
          <div role="group" aria-label="Ejemplos" className="flex flex-wrap gap-2" data-ejemplos>
            {EJEMPLOS_ENCARGO.map((e) => (
              <button
                key={e.id}
                type="button"
                data-ejemplo={e.id}
                className={CHIP}
                onClick={() => {
                  setDescripcion(e.texto);
                  setTipo(undefined);
                }}
              >
                {e.etiqueta}
              </button>
            ))}
          </div>
        </div>

        <Grupo titulo="Tipo">
          <button type="button" aria-pressed={!tipo} className={CHIP} onClick={() => setTipo(undefined)}>
            Auto
          </button>
          {TIPOS_LANDING.map((t) => (
            <button key={t} type="button" aria-pressed={tipo === t} className={CHIP} onClick={() => setTipo(t)}>
              {NOMBRE_TIPO[t]}
            </button>
          ))}
        </Grupo>
        <Grupo titulo="Estilo">
          <button type="button" aria-pressed={!estilo} className={CHIP} onClick={() => setEstilo(undefined)}>
            Auto
          </button>
          {ESTILOS.map((s) => (
            <button key={s} type="button" aria-pressed={estilo === s} className={CHIP} onClick={() => setEstilo(s)}>
              {NOMBRE_ESTILO[s]}
            </button>
          ))}
        </Grupo>
        <Grupo titulo="Paleta">
          <button type="button" aria-pressed={!paleta} className={CHIP} onClick={() => setPaleta(undefined)}>
            Auto
          </button>
          {PALETAS.map((p) => (
            <button key={p.id} type="button" aria-pressed={paleta === p.id} aria-label={`Paleta ${p.nombre}`} className={CHIP} onClick={() => setPaleta(p.id)}>
              <span aria-hidden="true" className={`size-4 rounded-full border border-linea ${p.muestra}`} />
              {p.nombre}
            </button>
          ))}
        </Grupo>

        <div className="flex flex-col gap-3">
          <button type="button" aria-expanded={masAbierto} aria-controls="mas-opciones" className={`${CHIP} self-start`} onClick={() => setMasAbierto((v) => !v)}>
            <Icono nombre="mas" className="size-4" />
            Fotos o link
          </button>
          {masAbierto && (
            <div id="mas-opciones" className="flex flex-col gap-4 rounded-md border border-linea p-4" data-mas>
              <div className="flex flex-col gap-2">
                <label htmlFor="link" className="text-sm font-medium">
                  Link del producto, del servicio o de tu web (opcional)
                </label>
                <input id="link" type="url" inputMode="url" value={link} onChange={(e) => setLink(e.target.value)} aria-invalid={enlaceInvalido ? true : undefined} placeholder="https://" className={CLASE_CONTROL} />
                {enlaceInvalido && (
                  <p role="alert" className="text-sm text-error">
                    Ese enlace no parece válido: empieza por https://
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">Fotos (hasta {MAX_FOTOS}, opcional)</span>
                <label className={`${BOTON_SECUNDARIO} cursor-pointer self-start has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-marca`}>
                  Elegir fotos
                  <input type="file" accept="image/*" multiple className="sr-only" disabled={fotos.length >= MAX_FOTOS} onChange={(e) => { void alElegirFotos(e.target.files); e.target.value = ""; }} />
                </label>
                {errorFoto && (
                  <p role="alert" className="text-sm text-error">
                    {errorFoto}
                  </p>
                )}
                {fotos.length > 0 && (
                  <ul className="flex flex-wrap gap-2">
                    {fotos.map((f, i) => (
                      <li key={i} className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={f} alt={`Foto ${i + 1} para la landing`} className="size-20 rounded-md border border-linea object-cover" />
                        <button type="button" aria-label={`Quitar la foto ${i + 1}`} onClick={() => setFotos((l) => l.filter((_, j) => j !== i))} className="absolute -right-2 -top-2 grid size-7 place-items-center rounded-full border border-linea bg-papel">
                          <Icono nombre="cerrar" className="size-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>

        <details className="rounded-md border border-linea" data-avanzados>
          <summary className="min-h-11 cursor-pointer list-none px-4 py-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-marca">Ajustes avanzados</summary>
          <div className="grid gap-4 border-t border-linea p-4 sm:grid-cols-2">
            {AVANZADOS.map((c) => (
              <label key={c.clave} className="flex flex-col gap-1 text-sm font-medium">
                {c.etiqueta}
                <input type={c.tipo ?? "text"} value={avanzados[c.clave] ?? ""} onChange={(e) => setAvanzados((a) => ({ ...a, [c.clave]: e.target.value }))} className={`${CLASE_CONTROL} font-normal`} />
              </label>
            ))}
            <p className="text-xs text-tinta-suave sm:col-span-2">Lo que dejes vacío, el sistema no lo inventa: queda como [COMPLETAR].</p>
          </div>
        </details>

        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" className={`${BOTON_PRIMARIO} min-h-12 px-6 text-lg`}>
            Crear mi landing
          </button>
          <Link href="/crear?modo=experto" className="text-sm text-marca underline underline-offset-4" data-modo-experto>
            Modo experto (4 pasos)
          </Link>
        </div>
      </form>
    </main>
  );
}
