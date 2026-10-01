"use client";

import { useEffect, useState } from "react";
import type { z } from "zod";
import type { DatoEnVivo, Seccion, Tokens } from "@/lib/contratos";
import { useLanding } from "@/componentes/contexto-landing";
import { SeccionInvalida } from "@/componentes/SeccionInvalida";
import { Titular } from "@/componentes/Titular";
import { useMovimiento } from "@/efectos/movimiento";
import { leerSeccion } from "../leer";
import { varianteDe, widgetDe } from "../variantes";
import { cuentaRegresiva, frase, horaActualizacion } from "./frases";
import type { schema } from "./schema";

type Estado = { fase: "cargando" } | { fase: "oculto" } | { fase: "listo"; dato: DatoEnVivo };

/** El ISS se mueve rápido: se vuelve a pedir cada 30 s (igual que la caché del servidor). */
const REFRESCO_MS: Partial<Record<DatoEnVivo["widget"], number>> = { iss: 30_000 };

async function pedir(widget: string, senal: AbortSignal): Promise<DatoEnVivo | null> {
  try {
    const respuesta = await fetch(`/api/vivo/${widget}`, { signal: senal });
    // 204 (la fuente falló) o cualquier error: el widget no se muestra, nunca hay un mensaje de error.
    if (respuesta.status !== 200) return null;
    const dato = (await respuesta.json()) as DatoEnVivo;
    return dato && dato.widget === widget ? dato : null;
  } catch {
    return null;
  }
}

function useDatoEnVivo(widget: DatoEnVivo["widget"], activo: boolean): Estado {
  const [estado, setEstado] = useState<Estado>({ fase: "cargando" });
  useEffect(() => {
    // En las miniaturas del editor no se pide nada: queda el esqueleto.
    if (!activo) return;
    const control = new AbortController();
    let vigente = true;
    const cargar = async () => {
      const dato = await pedir(widget, control.signal);
      if (!vigente) return;
      // Si ya había un dato y un refresco falla, se conserva el último bueno.
      setEstado((previo) => (dato ? { fase: "listo", dato } : previo.fase === "listo" ? previo : { fase: "oculto" }));
    };
    void cargar();
    const cada = REFRESCO_MS[widget];
    const reloj = cada ? setInterval(cargar, cada) : null;
    return () => {
      vigente = false;
      control.abort();
      if (reloj) clearInterval(reloj);
    };
  }, [widget, activo]);
  return estado;
}

/** Medidor de 9 pasos del índice Kp. */
function MedidorKp({ kp }: { kp: number }) {
  return (
    <div role="img" aria-label={`Índice Kp ${kp} de 9`} className="mt-5 flex gap-1">
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={`h-3 flex-1 rounded-full ${i < Math.round(kp) ? "bg-acento" : "bg-borde"}`} />
      ))}
    </div>
  );
}

/** ¿La Luna está creciendo? Por el nombre de la fase; en «Luna llena» y «Luna nueva» da igual (no se ve el terminador). */
export function esCreciente(fase: string): boolean {
  return !/menguante|disminuyente/i.test(fase);
}

/** La Luna dibujada con la parte iluminada según el porcentaje y si crece o mengua. */
export function Luna({ iluminacion, creciente }: { iluminacion: number; creciente: boolean }) {
  const f = Math.min(1, Math.max(0, iluminacion / 100));
  const r = 44;
  const rx = Math.abs(1 - 2 * f) * r;
  // Borde exterior de la parte iluminada (semicírculo) + terminador (elipse).
  const lado = creciente ? 1 : 0;
  const terminador = f > 0.5 ? lado : 1 - lado;
  const trazo = `M50 ${50 - r} A${r} ${r} 0 0 ${lado} 50 ${50 + r} A${rx} ${r} 0 0 ${terminador} 50 ${50 - r}Z`;
  return (
    <svg viewBox="0 0 100 100" role="img" aria-label={`Luna iluminada al ${Math.round(iluminacion)} %`} className="size-28 shrink-0">
      <circle cx="50" cy="50" r={r} className="fill-borde" />
      {f > 0.005 && <path d={trazo} className="fill-texto" />}
    </svg>
  );
}

/** Mapa mundial esquemático (proyección equirectangular) con un punto en la posición de la estación. */
function MiniMapa({ latitud, longitud }: { latitud: number; longitud: number }) {
  const x = ((longitud + 180) / 360) * 200;
  const y = ((90 - latitud) / 180) * 100;
  return (
    <svg viewBox="0 0 200 100" role="img" aria-label="Posición de la estación en un mapa del mundo" className="w-full max-w-sm rounded-token border border-borde bg-fondo">
      {[25, 50, 75].map((py) => (
        <line key={py} x1="0" x2="200" y1={py} y2={py} className="stroke-borde" strokeWidth="0.5" />
      ))}
      {[50, 100, 150].map((px) => (
        <line key={px} y1="0" y2="100" x1={px} x2={px} className="stroke-borde" strokeWidth="0.5" />
      ))}
      <circle cx={x} cy={y} r="7" className="fill-acento opacity-30" />
      <circle cx={x} cy={y} r="3" className="fill-acento" />
    </svg>
  );
}

const dos = (n: number) => String(n).padStart(2, "0");

function Lanzamiento({ dato }: { dato: Extract<DatoEnVivo, { widget: "lanzamiento" }> }) {
  const { reducido } = useMovimiento();
  const [ahora, setAhora] = useState<number | null>(null);
  useEffect(() => {
    const marcar = () => setAhora(Date.now());
    const inicio = setTimeout(marcar, 0);
    // Sin movimiento, la cuenta se actualiza cada minuto y sin segundos.
    const reloj = setInterval(marcar, reducido ? 60_000 : 1000);
    return () => {
      clearTimeout(inicio);
      clearInterval(reloj);
    };
  }, [reducido]);
  const partes = ahora === null ? null : cuentaRegresiva(dato.fechaLanzamiento, ahora);
  const unidades: [string, number][] = partes
    ? [["Días", partes.dias], ["Horas", partes.horas], ["Minutos", partes.minutos], ...(reducido ? [] : ([["Segundos", partes.segundos]] as [string, number][]))]
    : [];
  return (
    <div>
      <p className="font-titulos text-2xl font-semibold">{dato.mision}</p>
      <p className="mt-1 text-suave">{dato.cohete}{dato.lugar ? ` · ${dato.lugar}` : ""}</p>
      {partes ? (
        <dl className="mt-5 flex gap-3" aria-label="Tiempo que falta para el despegue">
          {unidades.map(([etiqueta, valor]) => (
            <div key={etiqueta} className="min-w-16 rounded-token border border-borde bg-fondo px-3 py-2 text-center">
              <dd className="font-titulos text-3xl font-bold tabular-nums">{dos(valor)}</dd>
              <dt className="text-xs text-suave">{etiqueta}</dt>
            </div>
          ))}
        </dl>
      ) : (
        ahora !== null && <p className="mt-5 text-suave">La ventana de lanzamiento ya abrió.</p>
      )}
    </div>
  );
}

function Detalle({ dato }: { dato: DatoEnVivo }) {
  switch (dato.widget) {
    case "auroras":
      return <MedidorKp kp={dato.kp} />;
    case "iss":
      return <div className="mt-5"><MiniMapa latitud={dato.latitud} longitud={dato.longitud} /></div>;
    case "asteroides":
      return dato.masCercano ? (
        <p className="mt-4 text-suave">
          El más cercano es {dato.masCercano.nombre}, a {new Intl.NumberFormat("es-CO").format(Math.round(dato.masCercano.distanciaKm))} km.
        </p>
      ) : null;
    default:
      return null;
  }
}

/** Alto reservado mientras carga: el mismo de la tarjeta con el dato, para no mover la página. */
const ALTO = "min-h-64 md:min-h-56";

export function Componente({ seccion }: { seccion: Seccion; tokens: Tokens }) {
  const datos = leerSeccion<z.infer<typeof schema>>(seccion);
  const variante = varianteDe("dato-en-vivo", seccion.variante);
  const { vistaPrevia } = useLanding();
  const estado = useDatoEnVivo(widgetDe(variante), !vistaPrevia);
  if (!datos) return <SeccionInvalida tipo="dato-en-vivo" />;
  if (estado.fase === "oculto") return null;

  const { ajustes } = datos;
  const dato = estado.fase === "listo" ? estado.dato : null;
  return (
    <section className="px-5 py-espacio" data-widget={widgetDe(variante)} data-estado={estado.fase}>
      <div className={`borde-token mx-auto max-w-3xl rounded-tarjeta bg-superficie p-6 md:p-10 ${ALTO}`}>
        <Titular className="text-balance font-titulos text-h2 font-semibold tracking-tight">{ajustes.titulo}</Titular>
        {dato ? (
          <div className="mt-6 flex flex-col items-start gap-6 md:flex-row md:items-center">
            {dato.widget === "fase-lunar" && dato.iluminacion !== null && <Luna iluminacion={dato.iluminacion} creciente={esCreciente(dato.fase)} />}
            <div className="min-w-0 flex-1">
              {dato.widget === "lanzamiento" ? <Lanzamiento dato={dato} /> : <p className="text-pretty text-lead">{frase(dato)}</p>}
              <Detalle dato={dato} />
              {ajustes.contexto && <p className="mt-4 text-pretty text-suave">{ajustes.contexto}</p>}
              <p className="mt-4 text-sm text-suave">{horaActualizacion(dato.actualizadoEn)}</p>
            </div>
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-3" aria-hidden="true" data-esqueleto="">
            <span className="h-6 w-4/5 rounded-token bg-borde motion-safe:animate-pulse" />
            <span className="h-6 w-3/5 rounded-token bg-borde motion-safe:animate-pulse" />
            <span className="mt-4 h-3 w-full rounded-full bg-borde motion-safe:animate-pulse" />
          </div>
        )}
      </div>
    </section>
  );
}
